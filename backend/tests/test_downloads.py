"""Desktop downloads: saved in the Downloads folder, never overwriting, opened only from there."""

from pathlib import Path

import pytest

from app.api import downloads


@pytest.fixture
def folder(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    path = tmp_path / "Downloads"
    monkeypatch.setenv("CAREERPILOT_DOWNLOADS", str(path))
    return path


def save(client, name: str, content: bytes = b"%PDF-1.4 test"):
    return client.post(
        "/api/downloads",
        files={"file": ("blob", content, "application/octet-stream")},
        data={"filename": name},
    )


def test_saves_in_downloads_without_overwriting(client, folder: Path):
    first = save(client, "CV - Jane Example.pdf").json()
    assert first == {
        "name": "CV - Jane Example.pdf",
        "path": str(folder / "CV - Jane Example.pdf"),
        "folder": str(folder),
    }
    second = save(client, "CV - Jane Example.pdf", b"second").json()
    assert second["name"] == "CV - Jane Example (2).pdf"
    assert (folder / "CV - Jane Example.pdf").read_bytes() == b"%PDF-1.4 test"
    assert (folder / "CV - Jane Example (2).pdf").read_bytes() == b"second"


@pytest.mark.parametrize(
    ("given", "saved"),
    [("../../evil.exe", "evil.exe"), ('a:b*c?"d.pdf', "abcd.pdf"), ("...", "download")],
)
def test_file_names_are_made_safe(client, folder: Path, given, saved):
    assert save(client, given).json()["name"] == saved
    assert (folder / saved).exists()


def test_opens_only_files_in_downloads(client, folder: Path, monkeypatch, tmp_path: Path):
    opened: list[tuple] = []
    monkeypatch.setattr(downloads.sys, "platform", "win32")
    monkeypatch.setattr(
        downloads.os, "startfile", lambda p: opened.append(("open", p)), raising=False
    )
    monkeypatch.setattr(
        downloads.subprocess, "Popen", lambda args: opened.append(("explorer", args))
    )

    path = save(client, "Letter.pdf").json()["path"]
    assert client.post("/api/downloads/open", json={"path": path}).status_code == 204
    assert (
        client.post("/api/downloads/open", json={"path": path, "show_in_folder": True}).status_code
        == 204
    )
    assert opened[0] == ("open", Path(path).resolve())
    assert opened[1][1][:2] == ["explorer", "/select,"]

    outside = tmp_path / "secret.txt"
    outside.write_text("no")
    for bad in (str(outside), str(folder / "missing.pdf"), str(folder / ".." / "secret.txt")):
        response = client.post("/api/downloads/open", json={"path": bad})
        assert response.status_code == 400
    assert len(opened) == 2


def test_too_big(client, folder: Path, monkeypatch):
    monkeypatch.setattr(downloads, "MAX_BYTES", 10)
    assert save(client, "big.pdf", b"x" * 11).status_code == 400
