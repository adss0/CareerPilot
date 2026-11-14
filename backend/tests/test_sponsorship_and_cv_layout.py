"""Sponsorship, clickable totals, one-page CVs in a chosen layout, a backup before updates."""

import io
import sqlite3
from contextlib import closing

import pytest
from pypdf import PdfReader

from app.core.db import database_url, needs_upgrade, run_migrations
from app.schemas.profile import ExperienceItem, ProfileDetails, ProjectItem
from app.schemas.tailored_cv import TailoredContent
from app.services.cv_export import (
    JAKE_ORDER,
    fit_one_page,
    layout_for,
    render_cv,
    section_order,
)
from app.services.sponsorship import detect_sponsorship
from tests.test_ai import FakeAI
from tests.test_tailored_documents import PROFILE, TAILORED

MAIN_CV = """Jane Example
jane@example.com

PROFILE
Graduate developer.

TECHNICAL SKILLS
Python, SQL

WORK EXPERIENCE
Software Developer Intern, Example Ltd

EDUCATION
BSc Computer Science
"""


# ---------- sponsorship ----------


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("We are unable to offer visa sponsorship for this role.", "no"),
        ("You must have the right to work in the UK without sponsorship.", "no"),
        ("Unfortunately we cannot provide Tier 2 sponsorship.", "no"),
        ("Skilled Worker visa sponsorship is available.", "yes"),
        ("We're a licensed sponsor and can sponsor visas. No sponsorship fee.", "no"),
        ("A great Python role in Manchester.", "unsure"),
        ("", "unsure"),
    ],
)
def test_sponsorship_is_read_from_the_job_ad(text, expected):
    assert detect_sponsorship(text) == expected


def test_sponsorship_follows_the_ad_until_the_user_chooses(client, make_application):
    job = make_application(job_description="Visa sponsorship is available for this role.")
    assert job["sponsorship"] == "yes"
    url = f"/api/applications/{job['id']}"
    assert make_application()["sponsorship"] == "unsure"  # the ad doesn't say

    # A new ad is read again while it's still "unsure"...
    vague = make_application()
    updated = client.patch(
        f"/api/applications/{vague['id']}", json={"job_description": "No sponsorship, sorry."}
    ).json()
    assert updated["sponsorship"] == "no"
    # ...but the user's own answer is never overwritten.
    client.patch(url, json={"sponsorship": "no"})
    kept = client.patch(url, json={"job_description": "Sponsorship is available."}).json()
    assert kept["sponsorship"] == "no"
    assert client.patch(url, json={"sponsorship": "maybe"}).status_code == 422


# ---------- the totals are filters ----------


def test_each_total_filters_the_list_by_the_same_rule(client, make_application):
    make_application(company="Waiting", status="sent")
    make_application(company="Closed", status="rejected")
    make_application(
        company="Testing",
        status="sent",
        stages=[
            {"kind": "online_test", "result": "passed"},
            {"kind": "video", "date": "2099-01-01"},
        ],
    )
    summary = client.get("/api/applications/summary").json()
    for group in ("applied", "rejected", "assessments_done", "in_progress", "interviews"):
        page = client.get(f"/api/applications?group={group}").json()
        assert page["total"] == summary[group] == len(page["items"]), group
    names = {a["company"] for a in client.get("/api/applications?group=interviews").json()["items"]}
    assert names == {"Testing"}
    assert client.get("/api/applications?group=nonsense").status_code == 422


# ---------- layout ----------


def test_the_layout_follows_the_main_cv_or_falls_back_to_jakes():
    assert section_order(MAIN_CV) == ("summary", "skills", "experience", "education")
    own = layout_for("own", MAIN_CV)
    assert own.style == "own"
    assert own.order == ("summary", "skills", "experience", "education", "projects")
    # No main CV (or one with no headings we recognise): Jake's Resume.
    assert layout_for("own", "").order == JAKE_ORDER
    assert layout_for("own", "just one long paragraph").style == "jake"
    assert layout_for("jake", MAIN_CV).order == JAKE_ORDER


def long_cv() -> tuple[TailoredContent, ProfileDetails]:
    bullets = "\n".join(
        f"Delivered project number {n} for a team of {n + 2} people, improving it by {n}0%"
        for n in range(1, 9)
    )
    content = TailoredContent(
        skills=["Python", "SQL"],
        experience=[
            ExperienceItem(title=f"Engineer {i}", company=f"Company {i}", summary=bullets)
            for i in range(6)
        ],
        projects=[ProjectItem(name=f"Project {i}", summary=bullets) for i in range(4)],
    )
    return content, ProfileDetails(full_name="Jane Example", email="jane@example.com")


def test_a_long_cv_is_trimmed_from_the_end_to_one_page():
    content, profile = long_cv()
    assert render_cv(content, profile)[1] > 1
    fitted, cuts = fit_one_page(content, profile)
    pdf, pages = render_cv(fitted, profile)
    assert pages == 1 and cuts > 0
    assert len(PdfReader(io.BytesIO(pdf)).pages) == 1
    # The first (most relevant) entry and its first bullet always survive.
    assert fitted.experience[0].company == "Company 0"
    assert fitted.experience[0].summary.startswith("Delivered project number 1 ")
    assert content.experience[0].summary.count("\n") == 7  # the original isn't changed


def upload_cv(client, text: str, name: str = "cv.txt") -> dict:
    response = client.post("/api/cvs", files={"file": (name, text.encode(), "text/plain")})
    assert response.status_code == 201, response.text
    return response.json()["cv"]


def test_tailored_cv_uses_the_chosen_layout_and_cv(client, ai, make_application):
    client.put("/api/profile", json=PROFILE)
    ai["provider"] = FakeAI(TAILORED)
    job = make_application()
    url = f"/api/applications/{job['id']}/tailored-cv"

    assert client.post(url).json()["style"] == "jake"  # nothing uploaded yet
    upload_cv(client, MAIN_CV)  # the first CV becomes the main one
    own = client.post(url, json={"style": "own"}).json()
    assert own["style"] == "own" and own["pages"] == 1 and own["source_cv_id"] is None
    text = PdfReader(io.BytesIO(client.get(f"{url}/export").content)).pages[0].extract_text()
    assert text.index("PROFILE") < text.index("TECHNICAL SKILLS") < text.index("EXPERIENCE")
    assert "\x7f" not in text  # bullets read back as text, not a control character

    # Changing only the layout doesn't need the AI and doesn't count as an edit.
    calls = len(ai["provider"].calls)
    jake = client.put(url, json={"content": own["content"], "style": "jake"}).json()
    assert jake["style"] == "jake" and jake["edited"] is False
    assert len(ai["provider"].calls) == calls
    text = PdfReader(io.BytesIO(client.get(f"{url}/export").content)).pages[0].extract_text()
    assert "PROFILE" not in text and text.index("EDUCATION") < text.index("EXPERIENCE")

    # Based on another uploaded CV: read once, with contact details still from the profile.
    other = upload_cv(client, "Jane Example\n\nEXPERIENCE\nData Analyst, Numbers Ltd\n", "data.txt")
    built = client.post(url, json={"cv_id": other["id"]})
    assert built.status_code == 201, built.text
    assert built.json()["source_cv_id"] == other["id"]
    assert client.post(url, json={"cv_id": 9999}).status_code == 400


# ---------- updates ----------


def test_a_database_from_an_older_version_is_noticed(tmp_path):
    db_file = tmp_path / "careerpilot.db"
    assert needs_upgrade(db_file) is False  # first run: nothing to back up
    run_migrations(database_url(str(db_file)), "8101912eacd1")  # as v1.6 left it
    assert needs_upgrade(db_file) is True
    run_migrations(database_url(str(db_file)))
    assert needs_upgrade(db_file) is False
    with closing(sqlite3.connect(db_file)) as db:
        columns = {row[1] for row in db.execute("PRAGMA table_info(application)")}
    assert "sponsorship" in columns
