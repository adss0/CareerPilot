"""Reading a job ad from its web page (only the one page the user pasted)."""

import json

import httpx
import pytest

from app.integrations.job_page import JobPageError, check_public, fetch_job_page, read_job_page
from app.services import job_service
from tests.test_ai import FakeAI

POSTING = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    "title": "Graduate Software Engineer",
    "hiringOrganization": {"@type": "Organization", "name": "Acme Ltd"},
    "jobLocation": {
        "@type": "Place",
        "address": {"addressLocality": "Manchester", "addressRegion": "Greater Manchester"},
    },
    "baseSalary": {
        "@type": "MonetaryAmount",
        "currency": "GBP",
        "value": {"minValue": 28000, "maxValue": 32000, "unitText": "YEAR"},
    },
    "validThrough": "2099-11-30T23:59:00Z",
    "description": "<p>Build APIs in <b>Python</b>.</p><ul><li>A computing degree</li></ul>",
}


def page_with(posting: object, extra: str = "") -> str:
    return (
        "<html><head><title>Job | Acme</title>"
        f'<script type="application/ld+json">{json.dumps(posting)}</script></head>'
        f"<body><nav>Home Jobs Login</nav><main>{extra}</main><footer>Cookies</footer>"
        "<script>var tracking = 1;</script></body></html>"
    )


PUBLIC = lambda host: ["93.184.216.34"]  # noqa: E731  (example.com's public address)


def test_reads_the_job_record_in_the_page():
    page = read_job_page("https://example.com/job", page_with(POSTING))
    assert page.found == {
        "role": "Graduate Software Engineer",
        "company": "Acme Ltd",
        "location": "Manchester, Greater Manchester",
        "salary": "£28,000 – £32,000 a year",
        "deadline": "30/11/2099",
    }
    assert page.text == "Build APIs in Python.\n\n- A computing degree"


def test_finds_the_record_inside_a_graph_and_handles_odd_salaries():
    graph = {"@graph": [{"@type": "WebPage"}, {**POSTING, "baseSalary": {"value": 25}}]}
    page = read_job_page("https://example.com/job", page_with(graph))
    assert page.found["salary"] == "£25 a year"
    remote = {**POSTING, "jobLocation": None, "jobLocationType": "TELECOMMUTE"}
    assert read_job_page("u", page_with(remote)).found["location"] == "Remote"


def test_falls_back_to_the_page_text_without_menus_and_scripts():
    body = "<h1>Junior Developer</h1><p>" + "We build things in Java. " * 6 + "</p>"
    page = read_job_page("https://example.com/job", page_with({"@type": "WebPage"}, body))
    assert page.found == {}
    assert page.text.startswith("Job | Acme\n\nJunior Developer")
    assert "Home Jobs Login" not in page.text and "tracking" not in page.text
    assert "Cookies" not in page.text
    with pytest.raises(JobPageError, match="didn't contain a readable job ad"):
        read_job_page("u", "<html><body><p>Please enable JavaScript</p></body></html>")


@pytest.mark.parametrize(
    ("url", "addresses", "message"),
    [
        ("ftp://example.com/x", ["93.184.216.34"], "Only web links"),
        ("http://localhost:8765/api", ["127.0.0.1"], "this computer or a private network"),
        ("http://router.home/", ["192.168.1.1"], "private network"),
        ("http://[::1]/", ["::1"], "private network"),
        ("http://169.254.169.254/latest", ["169.254.169.254"], "private network"),
    ],
)
def test_never_reads_this_computer_or_the_local_network(url, addresses, message):
    with pytest.raises(JobPageError, match=message):
        check_public(url, lambda host: addresses)


def test_fetch_follows_redirects_but_checks_each_one():
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/go":
            return httpx.Response(302, headers={"location": "/job"})
        if request.url.path == "/inside":
            return httpx.Response(302, headers={"location": "http://10.0.0.5/admin"})
        assert "CareerPilot" in request.headers["user-agent"]
        return httpx.Response(200, html=page_with(POSTING))

    transport = httpx.MockTransport(handler)

    def resolve(host: str) -> list[str]:
        return ["10.0.0.5"] if host == "10.0.0.5" else ["93.184.216.34"]

    page = fetch_job_page("https://example.com/go", transport, resolve)
    assert page.url == "https://example.com/job" and page.found["company"] == "Acme Ltd"
    with pytest.raises(JobPageError, match="private network"):
        fetch_job_page("https://example.com/inside", transport, resolve)


@pytest.mark.parametrize(
    ("status", "message"), [(403, "doesn't let apps read"), (404, r"couldn't be opened \(404\)")]
)
def test_fetch_explains_blocked_pages(status, message):
    transport = httpx.MockTransport(lambda request: httpx.Response(status))
    with pytest.raises(JobPageError, match=message):
        fetch_job_page("https://example.com/job", transport, PUBLIC)


def test_add_a_job_from_just_its_link(client, ai, monkeypatch):
    fetched: list[str] = []

    def fake_fetch(url):
        fetched.append(url)
        return read_job_page(url, page_with(POSTING))

    monkeypatch.setattr(job_service, "fetch_job_page", fake_fetch)
    # Without AI: the page's job record is enough.
    job = client.post("/api/jobs/paste", json={"url": "https://example.com/jobs/1"}).json()
    assert fetched == ["https://example.com/jobs/1"]
    assert (job["company"], job["role"]) == ("Acme Ltd", "Graduate Software Engineer")
    assert (job["salary"], job["application_deadline"]) == (
        "£28,000 – £32,000 a year",
        "30/11/2099",
    )
    assert job["job_description"].startswith("Build APIs in Python.")

    # With AI: it summarises, but the page's own record wins for the facts.
    client.put("/api/profile", json={"full_name": "Jane Example"})
    ai["provider"] = FakeAI({"company": "Wrong Co", "role": "Wrong", "summary": "Python APIs."})
    job = client.post("/api/jobs/paste", json={"url": "https://example.com/jobs/2"}).json()
    assert job["company"] == "Acme Ltd" and job["job_summary"]["summary"] == "Python APIs."

    # Pasted text is used as it is; the page isn't fetched.
    client.post(
        "/api/jobs/paste",
        json={"url": "https://example.com/jobs/3", "text": "x" * 30, "company": "A", "role": "B"},
    )
    assert fetched == ["https://example.com/jobs/1", "https://example.com/jobs/2"]


def test_link_errors_are_shown(client, monkeypatch):
    def blocked(url):
        raise JobPageError("That site doesn't let apps read the page.")

    monkeypatch.setattr(job_service, "fetch_job_page", blocked)
    response = client.post("/api/jobs/paste", json={"url": "https://www.linkedin.com/jobs/1"})
    assert response.status_code == 400
    assert "doesn't let apps read" in response.json()["detail"]
    assert client.post("/api/jobs/paste", json={}).status_code == 422
