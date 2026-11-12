import imaplib
from datetime import UTC, date, datetime, timedelta

import pytest
from sqlmodel import Session

from app.integrations.email.imap import IncomingMessage, fetch_recent
from app.integrations.email.smtp import EmailError
from app.models import Application
from app.schemas.email import EmailSettings
from app.services.stats_service import StatsService
from app.services.tracking_service import TrackingService, classify
from tests.test_ai import FakeAI
from tests.test_email import READY, configure, send
from tests.test_letters import PROFILE, ai_reply

NOW = datetime.now(UTC)


@pytest.fixture
def sent_job(client, ai, make_application, email_queue):
    """A job whose application email has really been sent (test mode off)."""
    client.put("/api/profile", json=PROFILE)
    ai["provider"] = FakeAI(ai_reply())
    application = make_application(company="Acme Ltd", contact_email="hiring@example.org")
    client.post(f"/api/applications/{application['id']}/letters", json={"tone": "friendly"})
    configure(client, test_mode=False, follow_up_days=5)
    send(client, application["id"])
    assert email_queue.tick() == "sent"
    ai["provider"] = None
    return application


def sent_log(client, application_id):
    return client.get("/api/emails", params={"application_id": application_id}).json()[0]


def tracking(session, env_settings, ai=None):
    return TrackingService(session, env_settings, ai)


def message_id_of(session, application_id) -> str:
    from sqlmodel import select

    from app.models import EmailLog

    return session.exec(
        select(EmailLog.message_id).where(EmailLog.application_id == application_id)
    ).first()


# ---------- follow-ups ----------


def test_sending_sets_follow_up_date(client, sent_job):
    application = client.get(f"/api/applications/{sent_job['id']}").json()
    assert application["status"] == "sent"
    follow_up = datetime.fromisoformat(application["follow_up_at"]).replace(tzinfo=UTC)
    assert timedelta(days=4, hours=23) < follow_up - NOW < timedelta(days=5, hours=1)


def test_follow_up_needs_a_sent_application(client, make_application):
    application = make_application()
    response = client.post(f"/api/applications/{application['id']}/follow-up/draft")
    assert response.status_code == 400
    assert "Send the application email first" in response.json()["detail"]


def test_follow_up_draft_from_template_or_ai(client, ai, sent_job):
    draft = client.post(f"/api/applications/{sent_job['id']}/follow-up/draft").json()
    assert draft["source"] == "template"
    assert draft["subject"].startswith("Re: ")
    assert "Junior Developer role at Acme Ltd" in draft["body"]
    assert draft["body"].endswith("Jane Example")
    assert draft["deliver_to"] == "hiring@example.org"

    ai["provider"] = FakeAI(
        {"subject": "x", "body": "Dear Hiring Manager, just checking in on my application. " * 2}
    )
    assert (
        client.post(f"/api/applications/{sent_job['id']}/follow-up/draft").json()["source"] == "ai"
    )

    ai["provider"] = FakeAI(error="Gemini's free-tier limit was reached.")
    assert (
        client.post(f"/api/applications/{sent_job['id']}/follow-up/draft").json()["source"]
        == "template"
    )


def test_follow_up_threads_and_updates_status(client, session, sent_job, email_queue, sent_emails):
    original_id = message_id_of(session, sent_job["id"])
    queued = client.post(
        f"/api/applications/{sent_job['id']}/follow-up/send",
        json={"subject": "Re: Junior Developer", "body": "Just following up.", "confirm": True},
    )
    assert queued.status_code == 202
    assert queued.json()["kind"] == "follow_up"
    assert queued.json()["attachments"] == []

    email_queue.next_allowed_at = None
    assert email_queue.tick() == "sent"
    message = sent_emails[-1][2]
    assert message["In-Reply-To"] == original_id
    assert message["References"] == original_id
    assert not list(message.iter_attachments())

    application = client.get(f"/api/applications/{sent_job['id']}").json()
    assert application["status"] == "followed_up"
    assert application["follow_up_at"] is None


def test_follow_up_send_needs_confirmation(client, sent_job):
    body = {"subject": "Re: x", "body": "Hi"}
    assert (
        client.post(f"/api/applications/{sent_job['id']}/follow-up/send", json=body).status_code
        == 422
    )


# ---------- replies ----------


def reply(
    message_id,
    *,
    references=(),
    sender="hiring@example.org",
    text="Thanks!",
    subject="Re: Application",
    received=None,
):
    return IncomingMessage(
        message_id=message_id,
        from_address=sender,
        subject=subject,
        received_at=received or NOW + timedelta(hours=2),
        references=list(references),
        text=text,
    )


def test_classify():
    assert classify("We'd like to invite you to an interview next week") == "interview"
    assert classify("Unfortunately we will not be progressing your interview") == "rejection"
    assert classify("Thanks, we received your application") == "other"


def test_reply_matched_by_thread(client, session, env_settings, sent_job):
    original_id = message_id_of(session, sent_job["id"])
    inbox = [
        reply(
            "<r1@example.org>",
            references=[original_id],
            text="We'd like to invite you to an interview.",
        ),
        reply("<spam@example.net>", sender="news@example.net"),  # unrelated
        reply(original_id, sender="jane@example.com"),  # our own sent copy
    ]
    result = tracking(session, env_settings).check_replies(fetcher=lambda *args: inbox)

    assert (result.checked, result.new_replies) == (True, 1)
    (found,) = client.get("/api/replies").json()
    assert found["classification"] == "interview"
    assert found["seen"] is False
    application = client.get(f"/api/applications/{sent_job['id']}").json()
    assert application["status"] == "replied"
    assert application["follow_up_at"] is None
    assert (
        client.get(f"/api/applications/{sent_job['id']}/history").json()[-1]["to_status"]
        == "replied"
    )
    assert sent_log(client, sent_job["id"])["status"] == "replied"

    # Checking again doesn't add the same reply twice
    again = tracking(session, env_settings).check_replies(fetcher=lambda *args: inbox)
    assert again.new_replies == 0


def test_reply_matched_by_sender_address(client, session, env_settings, sent_job):
    inbox = [
        reply("<old@example.org>", received=NOW - timedelta(days=3)),  # before we sent: ignored
        reply(
            "<new@example.org>",
            text="Unfortunately we have decided to proceed with other candidates.",
        ),
    ]
    assert (
        tracking(session, env_settings).check_replies(fetcher=lambda *args: inbox).new_replies == 1
    )
    assert client.get("/api/replies").json()[0]["classification"] == "rejection"


def test_reply_check_needs_email_set_up(session, env_settings):
    result = tracking(session, env_settings).check_replies(fetcher=lambda *args: [])
    assert result.checked is False
    assert "From" in result.message or "from" in result.message


def test_reply_check_reports_inbox_errors(client, session, env_settings, sent_job):
    def broken(*args):
        raise EmailError("The inbox rejected the login.")

    result = tracking(session, env_settings).check_replies(fetcher=broken)
    assert (result.checked, result.message) == (False, "The inbox rejected the login.")


def test_seen_and_notifications(client, session, env_settings, sent_job):
    original_id = message_id_of(session, sent_job["id"])
    tracking(session, env_settings).check_replies(
        fetcher=lambda *args: [reply("<r@example.org>", references=[original_id])]
    )
    summary = client.get("/api/notifications").json()
    assert summary["unseen_replies"] == 1
    assert summary["last_reply_check"] is not None

    reply_id = client.get("/api/replies", params={"unseen": True}).json()[0]["id"]
    assert client.post(f"/api/replies/{reply_id}/seen").status_code == 204
    assert client.get("/api/notifications").json()["unseen_replies"] == 0


# ---------- IMAP ----------


RAW_REPLY = (
    b"Message-ID: <reply-1@example.org>\r\n"
    b"From: Hiring Team <Hiring@Example.org>\r\n"
    b"Subject: =?utf-8?q?Re=3A_Your_application_=E2=9C=93?=\r\n"
    b"In-Reply-To: <sent-1@example.com>\r\n"
    b"Date: Wed, 11 Nov 2026 10:00:00 +0000\r\n"
    b"Content-Type: text/plain; charset=utf-8\r\n\r\n"
    b"We'd like to invite you to an interview.\r\n"
)


class FakeIMAP:
    def __init__(self, host, port, fail_login=False):
        self.calls = []
        self.fail_login = fail_login

    def login(self, user, password):
        self.calls.append(("login", user))
        if self.fail_login:
            raise imaplib.IMAP4.error("AUTHENTICATIONFAILED")

    def select(self, mailbox, readonly=False):
        self.calls.append(("select", mailbox, readonly))
        return "OK", [b"1"]

    def search(self, charset, *criteria):
        self.calls.append(("search", criteria))
        return "OK", [b"1"]

    def fetch(self, message_id, parts):
        self.calls.append(("fetch", parts))
        return "OK", [(b"1 (BODY[] {123}", RAW_REPLY), b")"]

    def logout(self):
        self.calls.append(("logout",))


def test_imap_reads_inbox_read_only():
    fake = FakeIMAP("imap.example.com", 993)
    settings = EmailSettings(**{**READY, "imap_host": "imap.example.com"})
    (message,) = fetch_recent(
        settings, "app-password", date(2026, 11, 1), imap_factory=lambda h, p: fake
    )

    assert message.message_id == "<reply-1@example.org>"
    assert message.from_address == "hiring@example.org"
    assert message.subject == "Re: Your application ✓"
    assert message.references == ["<sent-1@example.com>"]
    assert "invite you to an interview" in message.text
    assert ("select", "INBOX", True) in fake.calls  # read-only: nothing marked as read
    assert ("search", ("SINCE", "01-Nov-2026")) in fake.calls
    assert ("fetch", "(BODY.PEEK[])") in fake.calls
    assert fake.calls[-1] == ("logout",)


def test_imap_login_failure_is_friendly():
    settings = EmailSettings(**READY)
    with pytest.raises(EmailError, match="App Password"):
        fetch_recent(
            settings,
            "wrong",
            date(2026, 11, 1),
            imap_factory=lambda h, p: FakeIMAP(h, p, fail_login=True),
        )


# ---------- calendar and insights ----------


def test_calendar_and_interviews(client, sent_job, make_application):
    interview = (NOW + timedelta(days=2)).replace(microsecond=0)
    other = make_application(company="Globex")
    client.patch(f"/api/applications/{other['id']}", json={"interview_at": interview.isoformat()})

    events = client.get(
        "/api/calendar",
        params={
            "start": (NOW - timedelta(days=1)).isoformat(),
            "end": (NOW + timedelta(days=30)).isoformat(),
        },
    ).json()
    assert [(e["kind"], e["company"]) for e in events] == [
        ("interview", "Globex"),
        ("follow_up", "Acme Ltd"),
    ]
    assert client.get("/api/notifications").json()["interviews_soon"] == 1

    too_long = {"start": NOW.isoformat(), "end": (NOW + timedelta(days=200)).isoformat()}
    assert client.get("/api/calendar", params=too_long).status_code == 400


def test_stats_insights(client, session: Session, env_settings, sent_job, make_application):
    original_id = message_id_of(session, sent_job["id"])
    tracking(session, env_settings).check_replies(
        fetcher=lambda *args: [
            reply("<r@example.org>", references=[original_id], received=NOW + timedelta(days=2))
        ]
    )
    assisted = make_application(company="Portal Co")
    client.post(f"/api/applications/{assisted['id']}/mark-applied")

    stats = StatsService(session).get()
    assert stats.response_rate == 0.5  # replied + one still waiting
    assert stats.avg_days_to_reply == pytest.approx(2.0, abs=0.1)
    assert [(b.label, b.sent, b.responses) for b in stats.by_tone] == [("Friendly", 1, 1)]
    assert [(b.label, b.sent) for b in stats.by_cv] == [("No CV", 2)]
    assert session.get(Application, assisted["id"]).status == "sent"
