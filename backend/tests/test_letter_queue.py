from app.integrations.ai import AIError, AIRateLimitError
from tests.test_letters import PROFILE, ai_reply


class ScriptedAI:
    """Returns or raises the next item in a script for each call."""

    name = "fake"
    model = "fake-model"

    def __init__(self, *script):
        self.script = list(script)
        self.calls = 0

    def generate_json(self, system, prompt):
        self.calls += 1
        step = self.script.pop(0) if self.script else ai_reply()
        if isinstance(step, Exception):
            raise step
        return step


def bulk(client, ids, **body):
    response = client.post("/api/letters/bulk", json={"application_ids": ids, **body})
    assert response.status_code == 202, response.text
    return response.json()


def test_bulk_writes_letters_and_skips_existing(client, ai, sleeps, make_application):
    client.put("/api/profile", json=PROFILE)
    ai["provider"] = ScriptedAI()
    ids = [make_application(company=f"Company {i}")["id"] for i in range(3)]
    client.post(f"/api/applications/{ids[0]}/letters", json={})  # already has a letter

    job = bulk(client, ids, tone="friendly")

    assert job["status"] == "done"
    assert job["processed"] == 3
    assert job["skipped"] == [ids[0]]
    assert job["succeeded"] == ids[1:]
    assert sleeps == [4.0]  # one pause between the two AI calls, none before the first
    assert client.get(f"/api/letters/jobs/{job['id']}").json()["status"] == "done"


def test_bulk_retries_rate_limits_and_reports_failures(client, ai, sleeps, make_application):
    client.put("/api/profile", json=PROFILE)
    ai["provider"] = ScriptedAI(
        AIRateLimitError("limit"),  # app 1: waits 15s, then works
        ai_reply(),
        AIError("The AI didn't return a usable letter."),  # app 2: fails, job carries on
        ai_reply(),  # app 3
    )
    ids = [make_application(company=f"Company {i}")["id"] for i in range(3)]

    job = bulk(client, ids)

    assert job["status"] == "done"
    assert job["succeeded"] == [ids[0], ids[2]]
    assert [(f["application_id"], f["company"]) for f in job["failed"]] == [(ids[1], "Company 1")]
    assert sleeps == [15, 4.0, 4.0]


def test_bulk_gives_up_after_repeated_rate_limits(client, ai, sleeps, make_application):
    client.put("/api/profile", json=PROFILE)
    ai["provider"] = ScriptedAI(*[AIRateLimitError("limit")] * 4)
    job = bulk(client, [make_application()["id"]])
    assert job["failed"][0]["error"] == "limit"
    assert sleeps == [15, 30, 60]


def test_bulk_stops_when_profile_is_empty(client, ai, make_application):
    ai["provider"] = ScriptedAI()
    ids = [make_application()["id"], make_application(company="Other")["id"]]
    job = bulk(client, ids)
    assert job["status"] == "failed"
    assert "Fill in your profile" in job["message"]
    assert ai["provider"].calls == 0


def test_bulk_without_ai_fails_clearly(client, make_application):
    client.put("/api/profile", json=PROFILE)
    job = bulk(client, [make_application()["id"]])
    assert job["status"] == "failed"
    assert "isn't set up" in job["message"]


def test_bulk_reports_deleted_applications(client, ai, make_application):
    client.put("/api/profile", json=PROFILE)
    ai["provider"] = ScriptedAI()
    job = bulk(client, [make_application()["id"], 999])
    assert job["failed"] == [{"application_id": 999, "company": "", "error": "Not found."}]


def test_cancel_and_unknown_jobs(client, letter_queue):
    letter_queue.run_inline = False  # keep the job queued so it can be cancelled
    letter_queue._ensure_worker = lambda: None
    job = bulk(client, [1])
    cancelled = client.post(f"/api/letters/jobs/{job['id']}/cancel").json()
    assert cancelled["status"] == "cancelled"
    assert client.get("/api/letters/jobs/nope").status_code == 400


def test_bulk_validates_request(client):
    assert client.post("/api/letters/bulk", json={"application_ids": []}).status_code == 422
    too_many = {"application_ids": list(range(201))}
    assert client.post("/api/letters/bulk", json=too_many).status_code == 422


def test_bulk_runs_in_a_real_background_thread(client, ai, letter_queue, make_application):
    import time

    client.put("/api/profile", json=PROFILE)
    ai["provider"] = ScriptedAI()
    letter_queue.run_inline = False
    ids = [make_application(company=f"Company {i}")["id"] for i in range(2)]

    job = bulk(client, ids)
    deadline = time.monotonic() + 5
    while job["status"] in ("queued", "running") and time.monotonic() < deadline:
        time.sleep(0.05)
        job = client.get(f"/api/letters/jobs/{job['id']}").json()

    assert job["status"] == "done"
    assert job["succeeded"] == ids
