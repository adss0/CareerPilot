"""Find jobs: the job board clients (with fake HTTP), summaries, and saving to the tracker."""

import base64

import httpx
import pytest

from app.api.deps import get_job_boards
from app.integrations.jobs import AdzunaBoard, JobBoardError, ReedBoard, html_to_text, salary_text
from app.main import app
from app.services import job_service
from tests.test_ai import FakeAI

REED_SEARCH = {
    "results": [
        {
            "jobId": 111,
            "employerName": "Acme Ltd",
            "jobTitle": "Graduate Software Engineer",
            "locationName": "Manchester",
            "minimumSalary": 28000.0,
            "maximumSalary": 32000.0,
            "date": "10/11/2026",
            "expirationDate": "30/11/2026",
            "jobDescription": "Join our <b>graduate</b> scheme&nbsp;building APIs...",
            "jobUrl": "https://www.reed.co.uk/jobs/graduate-software-engineer/111",
        }
    ],
    "totalResults": 1,
}
REED_DETAILS = {
    "jobId": 111,
    "jobDescription": "<p>Build APIs in C#.</p><ul><li>C# or Java</li><li>SQL</li></ul>",
    "externalUrl": "https://careers.example.com/apply/111",
    "contractType": "permanent",
    "fullTime": True,
}
ADZUNA_SEARCH = {
    "results": [
        {
            "id": "222",
            "title": "Graduate <strong>Developer</strong>",
            "company": {"display_name": "Globex"},
            "location": {"display_name": "Leeds, West Yorkshire"},
            "salary_min": 30000,
            "salary_max": 30000,
            "salary_is_predicted": "1",
            "created": "2026-11-09T08:00:00Z",
            "description": "A graduate role writing Java...",
            "redirect_url": "https://www.adzuna.co.uk/jobs/land/ad/222",
        },
        {  # the same job as on Reed: shown once
            "id": "333",
            "title": "Graduate Software Engineer",
            "company": {"display_name": "Acme Ltd"},
            "location": {"display_name": "Manchester"},
            "description": "Same job",
            "redirect_url": "https://www.adzuna.co.uk/jobs/land/ad/333",
        },
    ]
}


def reed(handler=None) -> tuple[ReedBoard, list[httpx.Request]]:
    seen: list[httpx.Request] = []

    def default(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        if request.url.path.endswith("/search"):
            return httpx.Response(200, json=REED_SEARCH)
        return httpx.Response(200, json=REED_DETAILS)

    return ReedBoard("reed-test-key", transport=httpx.MockTransport(handler or default)), seen


def adzuna() -> tuple[AdzunaBoard, list[httpx.Request]]:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, json=ADZUNA_SEARCH)

    return AdzunaBoard("app-id", "app-key", transport=httpx.MockTransport(handler)), seen


@pytest.fixture
def boards(client):
    """Fake Reed and Adzuna, and an empty listing cache for every test."""
    reed_board, reed_requests = reed()
    adzuna_board, adzuna_requests = adzuna()
    app.dependency_overrides[get_job_boards] = lambda: [reed_board, adzuna_board]
    job_service.CACHE.items.clear()
    job_service.CACHE.summaries.clear()
    return {"reed": reed_requests, "adzuna": adzuna_requests}


def test_helpers():
    assert salary_text(28000, 32000) == "£28,000 – £32,000 a year"
    assert salary_text(30000, 30000) == "£30,000 a year"
    assert salary_text(None, None) == ""
    assert html_to_text("<p>Hello&nbsp;<b>you</b></p><ul><li>One</li><li>Two</li></ul>") == (
        "Hello you\n\n- One\n- Two"
    )


def test_search_both_boards(client, boards):
    result = client.get("/api/jobs/search?q=software engineer&location=Manchester").json()
    assert result["boards"] == ["Reed", "Adzuna"]
    assert result["problems"] == [] and result["needs_setup"] is False
    jobs = result["jobs"]
    assert [j["id"] for j in jobs] == ["reed:111", "adzuna:222"]  # duplicate dropped
    assert jobs[0] == {
        "id": "reed:111",
        "source": "reed",
        "title": "Graduate Software Engineer",
        "company": "Acme Ltd",
        "location": "Manchester",
        "salary": "£28,000 – £32,000 a year",
        "posted": "10/11/2026",
        "closes": "30/11/2026",
        "snippet": "Join our graduate scheme building APIs...",
        "url": "https://www.reed.co.uk/jobs/graduate-software-engineer/111",
        "application_id": None,
    }
    assert jobs[1]["title"] == "Graduate Developer"
    assert jobs[1]["salary"] == "£30,000 a year (estimated)"
    assert jobs[1]["posted"] == "09/11/2026"

    # Reed: key as the username, graduate filter on. Adzuna: graduate added to the keywords.
    reed_request = boards["reed"][0]
    token = base64.b64encode(b"reed-test-key:").decode()
    assert reed_request.headers["authorization"] == f"Basic {token}"
    assert reed_request.url.params["graduate"] == "true"
    assert reed_request.url.params["locationName"] == "Manchester"
    adzuna_request = boards["adzuna"][0]
    assert adzuna_request.url.params["what"] == "software engineer graduate"
    assert adzuna_request.url.params["where"] == "Manchester"


def test_search_without_keys_asks_for_setup(client):
    app.dependency_overrides[get_job_boards] = lambda: []
    result = client.get("/api/jobs/search?q=developer").json()
    assert result == {"jobs": [], "boards": [], "problems": [], "needs_setup": True}


def test_a_failing_board_doesnt_stop_the_other(client):
    broken, _ = reed(lambda request: httpx.Response(401, json={}))
    adzuna_board, _ = adzuna()
    app.dependency_overrides[get_job_boards] = lambda: [broken, adzuna_board]
    result = client.get("/api/jobs/search?q=developer").json()
    assert result["problems"] == ["Reed didn't accept your key. Paste it again in Settings."]
    assert len(result["jobs"]) == 2


def test_board_errors_are_friendly():
    board, _ = reed(lambda request: httpx.Response(429, json={}))
    with pytest.raises(JobBoardError, match="free limit"):
        board.search("x", "", True, 1)


def test_details_summary_and_save(client, ai, boards):
    client.get("/api/jobs/search?q=software")
    details = client.get("/api/jobs/details?id=reed:111").json()
    assert details["description"] == "Build APIs in C#.\n\n- C# or Java\n- SQL"
    assert details["url"] == "https://careers.example.com/apply/111"
    assert details["work_type"] == "Permanent · Full-time"
    assert details["summary"] is None

    # Summary needs AI.
    assert client.post("/api/jobs/summary?id=reed:111").status_code == 400
    client.put("/api/profile", json={"full_name": "Jane Example", "skills": ["C#", "SQL"]})
    ai["provider"] = FakeAI(
        {
            "summary": "A graduate scheme building APIs in C#.",
            "salary": "£28,000 – £32,000",
            "location": "Manchester (hybrid)",
            "requirements": ["C# or Java", "SQL"],
            "match_score": "81",
            "strengths": ["C# at Example Ltd"],
            "gaps": [],
        }
    )
    summary = client.post("/api/jobs/summary?id=reed:111").json()["summary"]
    assert summary["summary"] == "A graduate scheme building APIs in C#."
    assert summary["match_score"] == 81
    assert summary["work_type"] == "Permanent · Full-time"  # from the board when AI has none
    _system, prompt = ai["provider"].calls[0]
    assert "Build APIs in C#." in prompt and "jane@" not in prompt

    saved = client.post("/api/jobs/save?id=reed:111")
    assert saved.status_code == 201
    application = saved.json()
    assert application["company"] == "Acme Ltd"
    assert application["role"] == "Graduate Software Engineer"
    assert application["job_url"] == "https://careers.example.com/apply/111"
    assert application["external_id"] == "reed:111"
    assert application["application_deadline"] == "30/11/2026"
    assert application["job_summary"]["match_score"] == 81
    assert application["next_step"] == "Apply by 30/11/2026"

    # Saving again returns the same job, and search shows it's saved.
    assert client.post("/api/jobs/save?id=reed:111").json()["id"] == application["id"]
    jobs = client.get("/api/jobs/search?q=software").json()["jobs"]
    assert jobs[0]["application_id"] == application["id"]


def test_unknown_or_invalid_job_ids(client, boards):
    assert client.get("/api/jobs/details?id=reed:999").status_code == 404
    assert client.get("/api/jobs/details?id=evil:1").status_code == 422
    assert client.get("/api/jobs/search?q=x").status_code == 422  # too short


def test_summarize_a_tracked_job(client, ai, make_application):
    ai["provider"] = FakeAI({"summary": "Short.", "salary": "£25,000", "match_score": 60})
    empty = make_application()
    no_text = client.post(f"/api/applications/{empty['id']}/summary")
    assert no_text.status_code == 400
    application = make_application(company="Globex", job_description="We need Java.")
    result = client.post(f"/api/applications/{application['id']}/summary").json()
    assert result["job_summary"]["summary"] == "Short."
    assert result["salary"] == "£25,000"  # filled in when the job had none


def test_use_tailored_cv_as_main(client, ai, make_application, cv_dir):
    from tests.test_tailored_documents import PROFILE, TAILORED

    client.put("/api/profile", json=PROFILE)
    ai["provider"] = FakeAI(TAILORED)
    application = make_application(company="Acme Ltd")
    url = f"/api/applications/{application['id']}/tailored-cv"
    assert client.post(f"{url}/use-as-main").status_code == 404
    client.post(url)
    cv = client.post(f"{url}/use-as-main").json()
    assert cv["label"] == "Tailored for Acme Ltd"
    assert cv["is_default"] is True
    assert cv["original_filename"] == "CV - Jane Example.pdf"
    assert [c["is_default"] for c in client.get("/api/cvs").json()] == [True]
    assert len(list(cv_dir.iterdir())) == 1
