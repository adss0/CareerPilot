"""Preview mode: the PDF from the text on screen, without saving anything."""

import io

from pypdf import PdfReader


def text_of(content: bytes) -> str:
    return "".join(page.extract_text() for page in PdfReader(io.BytesIO(content)).pages)


def test_letter_preview_uses_unsaved_text(client):
    client.put("/api/profile", json={"full_name": "Jane Example", "email": "jane@example.com"})
    response = client.post(
        "/api/preview/letter", json={"content": "Dear Hiring Manager,\n\nNot saved yet."}
    )
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.headers["content-disposition"].startswith("inline")
    text = text_of(response.content)
    assert "Jane Example" in text and "Not saved yet." in text
    assert client.post("/api/preview/letter", json={"content": ""}).status_code == 422


def test_cv_preview_uses_unsaved_content(client):
    client.put("/api/profile", json={"full_name": "Jane Example"})
    content = {
        "summary": "Graduate developer, edited a moment ago.",
        "skills": ["Python", "SQL"],
        "experience": [{"title": "Intern", "company": "Example Ltd", "summary": "- Built APIs"}],
        "education": [],
        "projects": [],
    }
    response = client.post("/api/preview/cv", json={"content": content})
    assert response.status_code == 200
    text = text_of(response.content)
    assert "edited a moment ago" in text and "Built APIs" in text and "Python, SQL" in text
