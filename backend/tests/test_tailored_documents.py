"""Tailored CVs, letter highlights, and saving PDFs to the documents folder when applying."""

import io
from pathlib import Path

import docx
import pytest
from pypdf import PdfReader

from tests.test_ai import FakeAI
from tests.test_letters import ai_reply

PROFILE = {
    "full_name": "Jane Example",
    "email": "jane@example.com",
    "phone": "+44 7700 900123",
    "summary": "Computer science graduate who builds web APIs.",
    "skills": ["Python", "SQL", "React", "Docker"],
    "experience": [
        {
            "title": "Barista",
            "company": "Coffee Co",
            "start": "2021",
            "end": "2023",
            "summary": "Served customers\nTrained new staff",
        },
        {
            "title": "Software Developer Intern",
            "company": "Example Ltd",
            "start": "2024",
            "end": "2024",
            "summary": "Built a FastAPI service used by 3 teams",
        },
    ],
    "education": [{"qualification": "BSc Computer Science", "institution": "Example University"}],
    "projects": [
        {"name": "Budget app", "summary": "A React app for budgets"},
        {"name": "Job tracker", "summary": "A Python tool to track job applications"},
    ],
}

TAILORED = {
    "summary": "Graduate developer who builds Python APIs, most recently a FastAPI service.",
    "skills": ["sql", "Python", "Kubernetes", "Python"],  # Kubernetes isn't in the profile
    "experience": [
        {"index": 1, "bullets": ["- Built a FastAPI service used by 3 teams", ""]},
        {"index": 7, "bullets": ["made up job"]},  # no such index
        {"index": 1, "bullets": ["duplicate"]},
    ],
    "projects": [{"index": 1, "summary": "Python tool that tracks job applications"}],
    "changes": ["Put the internship first", "Led with Python and SQL"],
}


@pytest.fixture
def ready(client, ai):
    client.put("/api/profile", json=PROFILE)
    ai["provider"] = FakeAI(TAILORED)
    return ai["provider"]


def tailor(client, application_id):
    return client.post(f"/api/applications/{application_id}/tailored-cv")


def test_tailoring_needs_ai_and_a_profile(client, ai, make_application):
    application = make_application()
    assert "isn't set up" in tailor(client, application["id"]).json()["detail"]
    ai["provider"] = FakeAI(TAILORED)
    assert "Fill in your profile" in tailor(client, application["id"]).json()["detail"]
    assert tailor(client, 999).status_code == 404


def test_tailored_cv_only_rewords_and_reorders(client, ready, make_application):
    application = make_application(job_description="Python and SQL developer")
    response = tailor(client, application["id"])
    assert response.status_code == 201, response.text
    cv = response.json()
    content = cv["content"]

    # Skills: the profile's own names, in the AI's order; the made-up one is dropped.
    assert content["skills"] == ["SQL", "Python", "React", "Docker"]
    # Experience: new bullets; titles and dates come from the profile. What the AI left out
    # stays out, which is how the CV is kept to one page.
    assert [e["company"] for e in content["experience"]] == ["Example Ltd"]
    assert content["experience"][0]["summary"] == "Built a FastAPI service used by 3 teams"
    assert content["experience"][0]["start"] == "2024"
    assert [p["name"] for p in content["projects"]] == ["Job tracker"]
    assert cv["pages"] == 1 and cv["style"] == "jake"
    assert content["education"] == [
        {
            "qualification": "BSc Computer Science",
            "institution": "Example University",
            "start": "",
            "end": "",
            "details": "",
        }
    ]
    assert cv["changes"] == ["Put the internship first", "Led with Python and SQL"]
    assert cv["model_used"] == "fake/fake-model"

    # Contact details are never sent to the AI.
    _system, prompt = ready.calls[0]
    assert "jane@example.com" not in prompt and "7700" not in prompt
    assert "Python and SQL developer" in prompt


def test_documents_are_saved_as_pdf_only_when_applying(
    client, ready, make_application, documents_folder: Path
):
    application = make_application(company="Acme Ltd", role="Junior Developer")
    tailor(client, application["id"])
    assert not documents_folder.exists()  # nothing is written just because a CV was built

    saved = client.post(f"/api/applications/{application['id']}/documents/save?on_apply=true")
    pdf_path = documents_folder / "CVs" / "CV - Jane Example - Acme Ltd - Junior Developer.pdf"
    assert saved.json() == {"files": [str(pdf_path)]}
    # One PDF, straight in "CVs": no Word copy and no folder per company.
    assert [p.name for p in (documents_folder / "CVs").iterdir()] == [pdf_path.name]
    pdf = "".join(page.extract_text() for page in PdfReader(pdf_path).pages)
    assert "Jane Example" in pdf and "jane@example.com" in pdf
    assert "Built a FastAPI service used by 3 teams" in pdf


def test_edit_export_and_delete_tailored_cv(client, ready, make_application):
    application = make_application()
    url = f"/api/applications/{application['id']}/tailored-cv"
    assert client.get(url).status_code == 404
    content = tailor(client, application["id"]).json()["content"]

    content["summary"] = "My own words, with 99 achievements."
    updated = client.put(url, json={"content": content}).json()
    assert updated["edited"] is True
    assert updated["content"]["summary"] == "My own words, with 99 achievements."
    assert any("99" in flag for flag in updated["flags"])  # not in the profile: check it

    pdf = client.get(f"{url}/export?format=pdf")
    assert pdf.headers["content-type"] == "application/pdf"
    assert (
        "CV - Jane Example - Acme Ltd - Junior Developer.pdf" in pdf.headers["content-disposition"]
    )
    word = client.get(f"{url}/export?format=docx")
    assert docx.Document(io.BytesIO(word.content)).paragraphs[0].text == "Jane Example"

    # Tailoring again replaces the edited version.
    again = tailor(client, application["id"]).json()
    assert again["edited"] is False

    assert client.delete(url).status_code == 204
    assert client.get(url).status_code == 404
    assert client.delete(url).status_code == 404


def test_application_email_attaches_the_tailored_cv(client, ready, make_application):
    application = make_application(contact_email="hiring@example.org")
    url = f"/api/applications/{application['id']}/email/preview"
    tailor(client, application["id"])
    preview = client.get(url).json()
    assert [a["name"] for a in preview["attachments"]] == ["CV - Jane Example.pdf"]


def test_letters_are_saved_with_highlights(client, ai, make_application, documents_folder):
    client.put("/api/profile", json=PROFILE)
    ai["provider"] = FakeAI(ai_reply())
    application = make_application(company="Acme Ltd", role="Junior Developer")
    response = client.post(
        f"/api/applications/{application['id']}/letters",
        json={"tone": "formal", "highlights": ["Job tracker", "Python"]},
    )
    assert response.status_code == 201
    _system, prompt = ai["provider"].calls[0]
    assert "<focus>" in prompt and "- Job tracker\n- Python" in prompt

    assert not documents_folder.exists()
    client.post(f"/api/applications/{application['id']}/documents/save")
    assert [p.name for p in (documents_folder / "Cover Letters").iterdir()] == [
        "Cover letter - Acme Ltd - Junior Developer.pdf"
    ]


def test_the_main_cover_letter_guides_new_letters(client, ai, make_application):
    mine = "Dear Hiring Manager,\n\nI build things people use.\n\nYours sincerely,\nJane"
    saved = client.put("/api/profile", json={**PROFILE, "main_cover_letter": mine}).json()
    assert saved["main_cover_letter"] == mine
    ai["provider"] = FakeAI(ai_reply())
    application = make_application()
    client.post(f"/api/applications/{application['id']}/letters", json={})
    system, prompt = ai["provider"].calls[0]
    assert f"<example_letter>\n{mine}\n</example_letter>" in prompt
    assert "Follow its\n  structure" in system


def test_auto_save_can_be_turned_off_and_folder_changed(
    client, ai, make_application, tmp_path: Path, documents_folder: Path
):
    settings = client.get("/api/settings/documents").json()
    assert settings == {
        "folder": str(documents_folder),
        "default_folder": str(documents_folder),
        "auto_save": True,
    }
    client.put("/api/settings/documents", json={"auto_save": False})
    client.put("/api/profile", json=PROFILE)
    ai["provider"] = FakeAI(ai_reply())
    application = make_application()
    client.post(f"/api/applications/{application['id']}/letters", json={})
    url = f"/api/applications/{application['id']}/documents/save"
    assert client.post(f"{url}?on_apply=true").json() == {"files": []}
    assert not documents_folder.exists()

    # "Save to folder" still works on demand, into a folder the user picked.
    mine = tmp_path / "My CVs"
    changed = client.put("/api/settings/documents", json={"folder": str(mine)}).json()
    assert changed["folder"] == str(mine)
    saved = client.post(url).json()
    letter = mine / "Cover Letters" / "Cover letter - Acme Ltd - Junior Developer.pdf"
    assert saved == {"files": [str(letter)]}

    # Back to the default.
    assert client.put("/api/settings/documents", json={"folder": ""}).json()["folder"] == str(
        documents_folder
    )


def test_bad_folders_and_nothing_to_save(client, make_application):
    relative = client.put("/api/settings/documents", json={"folder": "just/a/name"})
    assert relative.status_code == 400
    application = make_application()
    nothing = client.post(f"/api/applications/{application['id']}/documents/save")
    assert nothing.status_code == 400
    assert "first" in nothing.json()["detail"]


def test_open_folder_opens_the_jobs_folder(client, ready, make_application, monkeypatch):
    from app.services import documents_service

    opened: list[Path] = []
    monkeypatch.setattr(documents_service.os, "startfile", opened.append, raising=False)
    monkeypatch.setattr(documents_service.sys, "platform", "win32")
    application = make_application(company="Acme Ltd")
    tailor(client, application["id"])
    client.post(f"/api/applications/{application['id']}/documents/save")
    result = client.post(f"/api/documents/open?application_id={application['id']}").json()
    assert opened == [Path(result["folder"])]
    assert result["folder"].endswith("CVs")
