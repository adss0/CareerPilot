"""The ATS check: run on every tailored CV, with a score and a pass/warn checklist."""

from app.models import Application
from app.schemas.profile import ExperienceItem, ProfileDetails, ProjectItem
from app.schemas.tailored_cv import TailoredContent
from app.services.ats_check import check_cv, job_keywords
from tests.test_ai import FakeAI

PROFILE = ProfileDetails(
    full_name="Jane Example",
    email="jane@example.com",
    phone="+44 7700 900123",
    location="Leeds, UK",
    skills=["Python", "SQL", "Docker", "C#"],
    experience=[ExperienceItem(title="Intern", company="Example Ltd", summary="Used Docker daily")],
)
JOB = Application(
    company="Acme Ltd",
    role="Graduate Software Engineer",
    job_description=(
        "You'll build REST APIs in Python and SQL, deploy with Docker on AWS, and work in an "
        "Agile team. Kubernetes is a plus. Good communication matters. We might go far."
    ),
)


def strong_cv(**changes) -> TailoredContent:
    cv = TailoredContent(
        summary="Graduate developer building REST APIs in Python and SQL in Agile teams.",
        skills=["Python", "SQL", "REST APIs", "Agile", "Git"],
        experience=[
            ExperienceItem(
                title="Software Developer Intern",
                company="Example Ltd",
                start="Jun 2024",
                end="Sep 2024",
                summary=(
                    "- Built 4 REST APIs in Python used by 3 teams\n"
                    "- Reduced report time by 40% with SQL views\n"
                    "- Wrote unit tests and improved coverage to 85%\n"
                    "- Presented weekly demos to stakeholders, sharing communication across teams"
                ),
            )
        ],
        education=[{"qualification": "BSc Computer Science", "institution": "Example University"}],
        projects=[
            ProjectItem(name="Job tracker", summary="- Built a Python tool with SQLite " * 3)
        ],
    )
    return cv.model_copy(update=changes)


def by_id(report):
    return {check.id: check for check in report.checks}


def test_keywords_come_from_the_job_and_skip_ordinary_words():
    words = job_keywords(JOB, PROFILE)
    assert set(words) >= {"Python", "SQL", "Docker", "rest apis", "aws", "agile", "kubernetes"}
    assert "go" not in words  # "We might go far" isn't the Go language
    assert "api" not in words and "apis" not in words  # covered by "rest apis"


def test_a_strong_cv_scores_well():
    report = check_cv(strong_cv(), PROFILE, JOB)
    checks = by_id(report)
    assert checks["readable"].status == "pass"
    assert checks["contact"].status == "pass"
    assert checks["sections"].status == "pass"
    assert checks["results"].status == "pass"
    assert checks["dates"].status == "pass"
    assert checks["bullets"].status == "pass"
    assert report.level in ("good", "ok") and report.score >= 70
    assert {"Python", "SQL", "rest apis", "agile"} <= set(report.matched_keywords)
    # Docker is in the profile but not this CV: worth adding. AWS and Kubernetes aren't: gaps.
    assert report.missing_in_profile == ["Docker"]
    assert set(report.missing_gaps) >= {"aws", "kubernetes"}
    assert "Docker" in checks["keywords"].detail


def test_a_weak_cv_gets_clear_warnings():
    weak = TailoredContent(
        summary="",
        skills=[],
        experience=[
            ExperienceItem(
                title="Intern",
                company="Example Ltd",
                summary="- I did some work on things\n- Responsible for tasks",
            )
        ],
    )
    profile = PROFILE.model_copy(update={"phone": ""})
    report = check_cv(weak, profile, JOB)
    checks = by_id(report)
    assert checks["keywords"].status == "fail"
    assert checks["contact"].status == "warn" and "phone" in checks["contact"].detail
    assert "Skills, Education" in checks["sections"].detail
    assert checks["length"].status == "warn" and "words" in checks["length"].detail
    assert checks["bullets"].status == "warn" and "Responsible for" in checks["bullets"].detail
    assert checks["results"].status == "warn"
    assert checks["dates"].status == "warn" and "Intern" in checks["dates"].detail
    assert report.level == "needs_work" and report.score < 60


def test_no_job_ad_and_no_email():
    report = check_cv(
        strong_cv(), PROFILE.model_copy(update={"email": ""}), Application(company="A", role="B")
    )
    checks = by_id(report)
    assert checks["keywords"].status == "warn" and "job ad" in checks["keywords"].detail
    assert checks["contact"].status == "fail"


def test_every_tailored_cv_comes_with_its_ats_report(client, ai, make_application):
    from tests.test_tailored_documents import PROFILE as PROFILE_JSON
    from tests.test_tailored_documents import TAILORED

    client.put("/api/profile", json=PROFILE_JSON)
    ai["provider"] = FakeAI(TAILORED)
    application = make_application(job_description="Python and SQL developer, Docker a plus")
    url = f"/api/applications/{application['id']}/tailored-cv"

    report = client.post(url).json()["ats"]
    assert 0 <= report["score"] <= 100
    assert {c["id"] for c in report["checks"]} == {
        "readable", "keywords", "contact", "sections", "length", "bullets", "results", "dates",
    }  # fmt: skip
    assert "Python" in report["matched_keywords"]

    # Edited: checked again straight away.
    content = client.get(url).json()["content"]
    content["skills"] = []
    content["summary"] = "Short."
    edited = client.put(url, json={"content": content}).json()["ats"]
    assert edited["score"] < report["score"]


def test_present_tense_and_non_bullet_lines_are_understood():
    from app.services.ats_check import is_bullet, starts_with_verb

    for line in (
        "Built 4 APIs in Python for three teams",
        "Resolve 100+ hardware issues for staff and students",
        "Maintain and troubleshoot campus printing systems",
        "Represent the University at open days and events",
        "Encrypted sensitive data before storing it safely",
        "Supports placement events with practical guidance",
    ):
        assert starts_with_verb(line), line
    assert not starts_with_verb("A full-stack web application for events")
    for line in (
        "Tech: Python, FastAPI, SQLite",
        "Part-Time Manchester, UK",
        "Placement Year, then Part-Time | C#, .NET , WPF",
        "working with cross-functional teams to improve reliability",
    ):
        assert not is_bullet(line), line
    assert is_bullet("Built a REST API for product search and baskets")
