"""Jooble, the shortlist (it survives a restart) and adding a job from any website."""

import json

import httpx

from app.integrations.jobs import JoobleBoard
from app.services import job_service
from tests.test_ai import FakeAI
from tests.test_jobs import boards  # noqa: F401  (fixture: fake Reed and Adzuna)

JOOBLE = {
    "totalCount": 1,
    "jobs": [
        {
            "id": 444,
            "title": "Graduate <b>Engineer</b>",
            "company": "Initech",
            "location": "Bristol",
            "snippet": "&nbsp;Build things...",
            "salary": "£27k",
            "type": "Full-time",
            "link": "https://jooble.org/desc/444",
            "updated": "2026-11-11T09:30:00.0000000",
        }
    ],
}


def test_jooble_board():
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, json=JOOBLE)

    board = JoobleBoard("my-key", transport=httpx.MockTransport(handler))
    [listing] = board.search("software", "", True, 2)
    assert (listing.id, listing.title, listing.company) == (
        "jooble:444",
        "Graduate Engineer",
        "Initech",
    )
    assert (listing.salary, listing.posted, listing.snippet) == (
        "£27k",
        "11/11/2026",
        "Build things...",
    )
    request = seen[0]
    assert request.method == "POST" and request.url.path == "/api/my-key"
    assert json.loads(request.content) == {
        "keywords": "software graduate",
        "location": "United Kingdom",
        "page": 2,
        "ResultOnPage": 25,
    }
    assert board.details(listing).description == "Build things..."


def test_shortlist_survives_a_restart(client, ai, boards):  # noqa: F811
    client.get("/api/jobs/search?q=software")
    assert client.get("/api/jobs/shortlist").json() == []
    starred = client.post("/api/jobs/shortlist?id=reed:111")
    assert starred.status_code == 201 and starred.json()["shortlisted"] is True
    client.post("/api/jobs/shortlist?id=reed:111")  # starring twice keeps one
    jobs = client.get("/api/jobs/search?q=software").json()["jobs"]
    assert [j["shortlisted"] for j in jobs] == [True, False]

    # The app restarts: the search cache is empty, but the shortlist still works.
    job_service.CACHE.items.clear()
    job_service.CACHE.summaries.clear()
    [saved] = client.get("/api/jobs/shortlist").json()
    assert saved["title"] == "Graduate Software Engineer" and saved["shortlisted"] is True
    assert client.get("/api/jobs/details?id=reed:111").json()["shortlisted"] is True

    # A summary made later is kept with the starred job.
    ai["provider"] = FakeAI({"summary": "Kept.", "match_score": 70})
    client.put("/api/profile", json={"full_name": "Jane Example"})
    client.post("/api/jobs/summary?id=reed:111")
    job_service.CACHE.items.clear()
    job_service.CACHE.summaries.clear()
    assert client.get("/api/jobs/details?id=reed:111").json()["summary"]["summary"] == "Kept."
    assert client.post("/api/jobs/save?id=reed:111").status_code == 201  # apply from it

    assert client.delete("/api/jobs/shortlist?id=reed:111").status_code == 204
    assert client.get("/api/jobs/shortlist").json() == []
    assert client.delete("/api/jobs/shortlist?id=reed:111").status_code == 404


def test_add_a_job_from_any_site(client, ai):
    ad = "Graduate Software Engineer at Acme Ltd, Manchester. £30,000. Apply by 30/11/2099."
    # Without AI the company and role must be typed.
    assert client.post("/api/jobs/paste", json={"text": ad}).status_code == 400
    manual = client.post(
        "/api/jobs/paste",
        json={
            "text": ad,
            "company": "Acme Ltd",
            "role": "Graduate Engineer",
            "url": "www.gradcracker.com/hub/1/acme",
        },
    ).json()
    assert (manual["company"], manual["source"]) == ("Acme Ltd", "pasted")
    assert manual["job_url"] == "https://www.gradcracker.com/hub/1/acme"
    assert manual["job_description"] == ad

    client.put("/api/profile", json={"full_name": "Jane Example", "skills": ["Python"]})
    ai["provider"] = FakeAI(
        {
            "company": "Globex",
            "role": "Graduate Developer",
            "deadline": "30/11/2099",
            "salary": "£30,000",
            "location": "Manchester",
            "summary": "A graduate developer role.",
            "match_score": 66,
        }
    )
    found = client.post("/api/jobs/paste", json={"text": ad}).json()
    assert (found["company"], found["role"]) == ("Globex", "Graduate Developer")
    assert (found["salary"], found["location"]) == ("£30,000", "Manchester")
    assert found["application_deadline"] == "30/11/2099"
    assert found["job_summary"]["summary"] == "A graduate developer role."
    system, prompt = ai["provider"].calls[0]
    assert '"company"' in system and ad in prompt
    bad = client.post("/api/jobs/paste", json={"text": ad, "url": "not a link"})
    assert bad.status_code == 400
    too_short = client.post("/api/jobs/paste", json={"text": "short"})
    assert too_short.status_code == 422
