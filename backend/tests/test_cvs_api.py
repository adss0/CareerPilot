from pathlib import Path

from app.api import cvs as cvs_api
from tests.cv_files import SAMPLE_CV, make_docx, make_pdf
from tests.test_ai import FakeAI

PDF = "application/pdf"


SAMPLE_BYTES = SAMPLE_CV.encode()


def upload(client, filename="Jane CV.txt", content=SAMPLE_BYTES, **data):
    return client.post(
        "/api/cvs", files={"file": (filename, content, "application/octet-stream")}, data=data
    )


def test_upload_stores_file_and_reads_details(client, cv_dir: Path):
    response = upload(client)
    assert response.status_code == 201, response.text
    body = response.json()

    assert body["parser"] == "basic"
    assert body["warnings"] == []
    assert body["details"]["full_name"] == "Jane Example"
    assert body["details"]["skills"][:2] == ["Python", "TypeScript"]

    cv = body["cv"]
    assert cv["label"] == "Jane CV"
    assert cv["original_filename"] == "Jane CV.txt"
    assert cv["is_default"] is True
    assert cv["has_text"] is True

    # Stored under a random name, never the user's file name
    (stored,) = list(cv_dir.iterdir())
    assert stored.name != "Jane CV.txt"
    assert stored.read_bytes() == SAMPLE_CV.encode()


def test_upload_pdf_and_docx(client):
    pdf = upload(client, "cv.pdf", make_pdf(["Jane Example", "jane@example.com"]))
    assert pdf.json()["details"]["email"] == "jane@example.com"

    docx = upload(client, "cv.docx", make_docx(["Jane Example", "SKILLS", "Python, SQL"]))
    assert docx.json()["details"]["skills"] == ["Python", "SQL"]
    assert docx.json()["cv"]["is_default"] is False  # only the first CV becomes default


def test_upload_warns_when_no_text_found(client):
    body = upload(client, "scan.pdf", make_pdf([])).json()
    assert body["cv"]["has_text"] is False
    assert "No text was found" in body["warnings"][0]


def test_upload_rejects_bad_files(client, monkeypatch):
    assert upload(client, "cv.exe", b"MZ").status_code == 415
    assert upload(client, "cv.txt", b"").status_code == 400
    broken = upload(client, "cv.pdf", b"not a pdf")
    assert broken.status_code == 400
    assert "couldn't be read as a PDF" in broken.json()["detail"]

    monkeypatch.setattr(cvs_api, "MAX_CV_BYTES", 10)
    assert upload(client).status_code == 413


def test_path_in_filename_is_ignored(client, cv_dir: Path):
    body = upload(client, "..\\..\\secret\\my-cv.txt").json()
    assert body["cv"]["original_filename"] == "my-cv.txt"
    assert all(path.parent == cv_dir for path in cv_dir.iterdir())


def test_ai_requested_but_not_set_up_falls_back(client):
    body = upload(client, use_ai="true").json()
    assert body["parser"] == "basic"
    assert "AI isn't set up" in body["warnings"][0]


def test_ai_parsing_when_set_up(client, ai):
    ai["provider"] = FakeAI({"full_name": "Jane Example", "skills": ["Python"]})
    body = upload(client, use_ai="true").json()
    assert body["parser"] == "ai"
    assert body["details"]["skills"] == ["Python"]

    ai["provider"] = FakeAI(error="Gemini's free-tier limit was reached.")
    reparsed = client.post(f"/api/cvs/{body['cv']['id']}/parse", data={"use_ai": "true"}).json()
    assert reparsed["parser"] == "basic"
    assert "free-tier limit" in reparsed["warnings"][0]


def test_ai_not_used_unless_asked(client, ai):
    fake = FakeAI({"full_name": "Should not be used"})
    ai["provider"] = fake
    body = upload(client).json()
    assert body["parser"] == "basic"
    assert fake.calls == []


def test_list_rename_set_default_and_download(client):
    first = upload(client, "first.txt").json()["cv"]
    second = upload(client, "second.pdf", make_pdf(["Hello"])).json()["cv"]

    renamed = client.patch(
        f"/api/cvs/{second['id']}", json={"label": "Data CV", "is_default": True}
    )
    assert renamed.json()["label"] == "Data CV"
    listed = client.get("/api/cvs").json()
    assert [(c["id"], c["is_default"]) for c in listed] == [
        (second["id"], True),
        (first["id"], False),
    ]

    download = client.get(f"/api/cvs/{second['id']}/file")
    assert download.status_code == 200
    assert download.headers["content-type"] == PDF
    assert 'filename="second.pdf"' in download.headers["content-disposition"]
    assert download.content.startswith(b"%PDF")


def test_delete_removes_file_and_moves_default(client, cv_dir: Path, make_application):
    first = upload(client, "first.txt").json()["cv"]
    second = upload(client, "second.txt").json()["cv"]
    application = make_application(cv_id=first["id"])

    assert client.delete(f"/api/cvs/{first['id']}").status_code == 204
    assert len(list(cv_dir.iterdir())) == 1
    assert client.get("/api/cvs").json()[0] == {**second, "is_default": True}
    assert client.get(f"/api/applications/{application['id']}").json()["cv_id"] is None
    assert client.delete(f"/api/cvs/{first['id']}").status_code == 404


def test_application_cv_must_exist(client, make_application):
    response = client.post(
        "/api/applications", json={"company": "Acme Ltd", "role": "Dev", "cv_id": 999}
    )
    assert response.status_code == 400

    cv = upload(client).json()["cv"]
    application = make_application()
    updated = client.patch(f"/api/applications/{application['id']}", json={"cv_id": cv["id"]})
    assert updated.json()["cv_id"] == cv["id"]
    cleared = client.patch(f"/api/applications/{application['id']}", json={"cv_id": None})
    assert cleared.json()["cv_id"] is None


def test_profile_saves_structured_details(client):
    assert client.get("/api/profile").json()["has_cv"] is False
    upload(client)

    response = client.put(
        "/api/profile",
        json={
            "full_name": "Jane Example",
            "experience": [
                {"title": "Developer", "company": "Example Ltd", "start": "2024", "end": "Present"},
                {"title": "", "company": "", "summary": "  "},  # blank entries are dropped
            ],
            "education": [{"qualification": "BSc", "institution": "Example University"}],
            "projects": [{"name": "CareerPilot", "link": "https://example.com"}],
            "skills": ["Python", "python", " SQL "],
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["has_cv"] is True
    assert [e["title"] for e in body["experience"]] == ["Developer"]
    assert body["education"][0]["institution"] == "Example University"
    assert body["projects"][0]["name"] == "CareerPilot"
    assert body["skills"] == ["Python", "SQL"]


def test_health_reports_ai_status(client, ai):
    assert client.get("/api/health").json()["ai_configured"] is False
    ai["provider"] = FakeAI()
    assert client.get("/api/health").json()["ai_configured"] is True
