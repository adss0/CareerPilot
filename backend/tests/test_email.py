import email
import smtplib
import socket
from datetime import UTC, datetime, timedelta

import pytest
from aiosmtpd.controller import Controller

from app.integrations.email import smtp as smtp_module
from app.integrations.email.smtp import EmailError, check_login, send_message
from app.schemas.email import EmailSettings
from tests.test_ai import FakeAI
from tests.test_letters import PROFILE, ai_reply

LOCAL = {"smtp_host": "localhost", "smtp_port": 2525, "smtp_security": "none"}
READY = {**LOCAL, "from_name": "Jane Example", "from_address": "jane@example.com"}


def configure(client, **settings):
    response = client.put("/api/settings/email", json={**READY, **settings})
    assert response.status_code == 200, response.text
    return response.json()


@pytest.fixture
def job_with_letter(client, ai, make_application):
    """A job with a contact email, a written letter and an uploaded CV."""
    client.put("/api/profile", json=PROFILE)
    ai["provider"] = FakeAI(ai_reply())
    client.post("/api/cvs", files={"file": ("Jane CV.txt", b"Jane Example CV", "text/plain")})
    application = make_application(contact_email="hiring@example.org")
    client.post(f"/api/applications/{application['id']}/letters", json={})
    return application


def send(client, application_id, **body):
    return client.post(
        f"/api/applications/{application_id}/email/send", json=body or {"confirm": True}
    )


# ---------- settings ----------


def test_settings_default_to_test_mode_and_never_expose_password(client):
    body = client.get("/api/settings/email").json()
    assert body["test_mode"] is True
    assert body["ready"] is False
    assert "password" not in {k for k in body if k != "password_set"}
    assert body["password_set"] is False
    assert any("from" in p.lower() for p in body["problems"])


def test_settings_validation(client):
    bad_host = client.put(
        "/api/settings/email", json={"smtp_host": "smtp.example.com", "smtp_security": "none"}
    )
    assert bad_host.status_code == 400
    assert "Unencrypted" in bad_host.json()["detail"]
    bad_gap = client.put(
        "/api/settings/email", json={"min_gap_seconds": 100, "max_gap_seconds": 10}
    )
    assert bad_gap.status_code == 400
    assert client.put("/api/settings/email", json={"password": "secret"}).status_code == 422
    assert client.put("/api/settings/email", json={"from_address": "nope"}).status_code == 400


def test_remote_server_needs_password(client):
    body = configure(client, smtp_host="smtp.gmail.com", smtp_security="starttls", smtp_port=587)
    assert body["ready"] is False
    assert any("App Password" in p for p in body["problems"])
    assert configure(client)["ready"] is True  # localhost needs no password


# ---------- preview and approval ----------


def test_preview_explains_what_blocks_sending(client, make_application):
    application = make_application()
    preview = client.get(f"/api/applications/{application['id']}/email/preview").json()
    assert preview["can_send"] is False
    joined = " ".join(preview["problems"])
    assert "Write a cover letter" in joined
    assert "no contact email" in joined
    assert "from" in joined.lower()


def test_preview_in_test_mode(client, job_with_letter):
    configure(client, signature="Jane Example\n07700 900123", test_address="me@example.com")
    preview = client.get(f"/api/applications/{job_with_letter['id']}/email/preview").json()

    assert preview["can_send"] is True
    assert preview["to"] == "hiring@example.org"
    assert preview["deliver_to"] == "me@example.com"
    assert preview["test_mode"] is True
    assert preview["body"].endswith("07700 900123")
    assert [a["name"] for a in preview["attachments"]] == [
        "Cover letter - Acme Ltd - Junior Developer.pdf",
        "Jane CV.txt",
    ]
    assert any("Test mode" in w for w in preview["warnings"])


def test_sending_needs_explicit_confirmation(client, job_with_letter):
    configure(client)
    assert (
        client.post(f"/api/applications/{job_with_letter['id']}/email/send", json={}).status_code
        == 422
    )
    assert send(client, job_with_letter["id"], confirm=False).status_code == 422

    queued = send(client, job_with_letter["id"])
    assert queued.status_code == 202
    log = queued.json()
    assert log["status"] == "queued"
    assert log["is_test"] is True
    assert log["subject"].startswith("[TEST] ")
    assert log["to_address"] == "jane@example.com"  # test mode, no test address → yourself

    again = send(client, job_with_letter["id"])
    assert again.status_code == 400
    assert "already waiting" in again.json()["detail"]


def test_bulk_send_skips_with_reasons(client, job_with_letter, make_application):
    configure(client)
    no_email = make_application(company="Portal Co")
    result = client.post(
        "/api/emails/bulk",
        json={"application_ids": [job_with_letter["id"], no_email["id"], 999], "confirm": True},
    ).json()
    assert result["queued"] == 1
    reasons = {s["application_id"]: s["reason"] for s in result["skipped"]}
    assert "no contact email" in reasons[no_email["id"]]
    assert "not found" in reasons[999]


# ---------- the send queue ----------


def test_queue_sends_in_test_mode_without_changing_status(
    client, job_with_letter, email_queue, sent_emails
):
    configure(client, test_address="me@example.com")
    send(client, job_with_letter["id"])

    assert email_queue.tick() == "sent"
    ((_, _, message),) = sent_emails
    assert message["To"] == "me@example.com"
    assert message["Subject"].startswith("[TEST]")
    names = [part.get_filename() for part in message.iter_attachments()]
    assert names == ["Cover letter - Acme Ltd - Junior Developer.pdf", "Jane CV.txt"]

    log = client.get("/api/emails", params={"application_id": job_with_letter["id"]}).json()[0]
    assert log["status"] == "sent"
    assert client.get(f"/api/applications/{job_with_letter['id']}").json()["status"] == "drafted"


def test_real_send_marks_application_sent(client, job_with_letter, email_queue, sent_emails):
    configure(client, test_mode=False)
    send(client, job_with_letter["id"])
    assert email_queue.tick() == "sent"

    _, _, message = sent_emails[0]
    assert message["To"] == "hiring@example.org"
    assert not message["Subject"].startswith("[TEST]")
    application = client.get(f"/api/applications/{job_with_letter['id']}").json()
    assert application["status"] == "sent"
    assert application["applied_at"] is not None
    history = client.get(f"/api/applications/{job_with_letter['id']}/history").json()
    assert history[-1]["to_status"] == "sent"


def test_queue_respects_gap_and_daily_limit(client, ai, email_queue, sent_emails, make_application):
    client.put("/api/profile", json=PROFILE)
    ai["provider"] = FakeAI(ai_reply())
    configure(client, daily_limit=2, min_gap_seconds=60, max_gap_seconds=120)
    for i in range(3):
        a = make_application(company=f"C{i}", contact_email=f"jobs{i}@example.org")
        client.post(f"/api/applications/{a['id']}/letters", json={})
        send(client, a["id"])

    clock = {"now": datetime(2026, 11, 11, 9, tzinfo=UTC)}
    email_queue.now = lambda: clock["now"]

    assert email_queue.tick() == "sent"
    assert email_queue.tick() == "waiting"  # 120s gap (the fake gap picks the maximum)
    clock["now"] += timedelta(seconds=121)
    assert email_queue.tick() == "sent"
    clock["now"] += timedelta(seconds=121)
    assert email_queue.tick() == "daily_limit"
    status = client.get("/api/emails/queue").json()
    assert (status["queued"], status["sent_today"], status["daily_limit"]) == (1, 2, 2)
    assert len(sent_emails) == 2


def test_failed_send_can_be_retried_or_cancelled(client, job_with_letter, email_queue):
    configure(client)

    def broken(settings, password, message):
        raise EmailError("Couldn't connect to localhost:2525.")

    email_queue.sender = broken
    log = send(client, job_with_letter["id"]).json()
    assert email_queue.tick() == "failed"
    failed = client.get("/api/emails").json()[0]
    assert (failed["status"], failed["error"]) == ("failed", "Couldn't connect to localhost:2525.")

    assert client.post(f"/api/emails/{log['id']}/cancel").status_code == 400  # not queued
    assert client.post(f"/api/emails/{log['id']}/retry").json()["status"] == "queued"
    assert client.post(f"/api/emails/{log['id']}/cancel").json()["status"] == "cancelled"
    assert email_queue.tick() == "idle"


def test_queue_does_nothing_until_ready(client, job_with_letter, email_queue):
    assert email_queue.tick() == "not_ready"


def test_mark_applied_for_portal_jobs(client, make_application):
    application = make_application()
    assert client.post(f"/api/applications/{application['id']}/mark-applied").status_code == 204
    body = client.get(f"/api/applications/{application['id']}").json()
    assert body["status"] == "sent"
    assert body["applied_at"] is not None


# ---------- a real SMTP round trip ----------


class Collector:
    def __init__(self):
        self.messages = []

    async def handle_DATA(self, server, session, envelope):
        self.messages.append(envelope)
        return "250 OK"


@pytest.fixture
def smtp_server():
    collector = Collector()
    with (
        socket.socket() as probe
    ):  # pick a free port (port=0 doesn't work with aiosmtpd on Windows)
        probe.bind(("127.0.0.1", 0))
        port = probe.getsockname()[1]
    controller = Controller(collector, hostname="127.0.0.1", port=port)
    controller.start()
    yield controller, collector
    controller.stop()


def test_real_smtp_round_trip(client, job_with_letter, engine, env_settings, cv_dir, smtp_server):
    controller, collector = smtp_server
    configure(
        client, smtp_host="127.0.0.1", smtp_port=controller.port, test_address="me@example.com"
    )
    send(client, job_with_letter["id"])

    from sqlmodel import Session

    from app.services.email_queue import EmailQueue

    real_queue = EmailQueue(lambda: Session(engine), env_settings, cv_dir)  # the real SMTP sender
    assert real_queue.tick() == "sent"

    (envelope,) = collector.messages
    assert envelope.rcpt_tos == ["me@example.com"]
    received = email.message_from_bytes(envelope.content)
    assert received["From"] == "Jane Example <jane@example.com>"
    assert received["Message-ID"].endswith("@example.com>")
    attachments = [p.get_filename() for p in received.walk() if p.get_filename()]
    assert attachments == ["Cover letter - Acme Ltd - Junior Developer.pdf", "Jane CV.txt"]


def test_smtp_errors_are_friendly(monkeypatch):
    settings = EmailSettings(**{**READY, "smtp_port": 1})  # nothing listens on port 1
    with pytest.raises(EmailError, match="Couldn't connect"):
        check_login(settings, "")

    class FakeSMTP:
        def __init__(self, *args, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def login(self, user, password):
            raise smtplib.SMTPAuthenticationError(535, b"bad credentials")

    monkeypatch.setattr(smtp_module.smtplib, "SMTP", FakeSMTP)
    with pytest.raises(EmailError, match="App Password"):
        send_message(settings, "wrong", email.message.EmailMessage())


def test_header_injection_is_blocked():
    from app.services.email_builder import build_email

    message = build_email(
        settings=EmailSettings(**READY),
        to="a@example.com\nBcc: everyone@example.com",
        subject="Hi\r\nBcc: everyone@example.com",
        body="Hello",
        message_id="<1@example.com>",
        attachments=[],
    )
    assert message["Bcc"] is None
    assert "\n" not in message["Subject"]
