"""Saving downloads in the desktop app: files go to the user's Downloads folder, and the app can
open them or show them in File Explorer afterwards.

Only files in the Downloads folder can be opened this way, so the endpoint can't be used to
open anything else on the computer.
"""

import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, File, Form, UploadFile
from pydantic import BaseModel

from app.core.errors import BadRequestError

router = APIRouter(prefix="/downloads", tags=["downloads"])

MAX_BYTES = 50 * 1024 * 1024
# FOLDERID_Downloads: the real Downloads folder, even if it was moved (e.g. to OneDrive).
DOWNLOADS_GUID = "{374DE290-123F-4565-9164-39C4925E467B}"


def downloads_dir() -> Path:
    if override := os.environ.get("CAREERPILOT_DOWNLOADS"):  # tests
        return Path(override)
    if sys.platform == "win32":
        import ctypes
        from ctypes import wintypes
        from uuid import UUID

        class GUID(ctypes.Structure):
            _fields_ = [
                ("Data1", wintypes.DWORD),
                ("Data2", wintypes.WORD),
                ("Data3", wintypes.WORD),
                ("Data4", ctypes.c_ubyte * 8),
            ]

        uuid = UUID(DOWNLOADS_GUID)
        guid = GUID(uuid.fields[0], uuid.fields[1], uuid.fields[2])
        guid.Data4[:] = uuid.bytes[8:]
        path = ctypes.c_wchar_p()
        if (
            ctypes.windll.shell32.SHGetKnownFolderPath(
                ctypes.byref(guid), 0, None, ctypes.byref(path)
            )
            == 0
        ):
            folder = Path(path.value)
            ctypes.windll.ole32.CoTaskMemFree(path)
            return folder
    return Path.home() / "Downloads"


def safe_name(name: str) -> str:
    name = name.replace("\\", "/").rsplit("/", 1)[-1]  # never a folder or drive ("C:")
    name = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "", name).strip(" .")[:150]
    return name or "download"


def unique_path(folder: Path, name: str) -> Path:
    """ "CV.pdf", then "CV (2).pdf", "CV (3).pdf"... never overwrites."""
    path = folder / name
    stem, suffix = path.stem, path.suffix
    counter = 2
    while path.exists():
        path = folder / f"{stem} ({counter}){suffix}"
        counter += 1
    return path


class SavedDownload(BaseModel):
    name: str
    path: str
    folder: str


class OpenDownload(BaseModel):
    path: str
    show_in_folder: bool = False


@router.post("", response_model=SavedDownload)
async def save_download(
    file: Annotated[UploadFile, File()], filename: Annotated[str, Form()]
) -> SavedDownload:
    content = await file.read(MAX_BYTES + 1)
    if len(content) > MAX_BYTES:
        raise BadRequestError("That file is too big to save.")
    folder = downloads_dir()
    folder.mkdir(parents=True, exist_ok=True)
    path = unique_path(folder, safe_name(filename))
    path.write_bytes(content)
    return SavedDownload(name=path.name, path=str(path), folder=str(folder))


@router.post("/open", status_code=204)
def open_download(data: OpenDownload) -> None:
    folder = downloads_dir().resolve()
    path = Path(data.path).resolve()
    if path.parent != folder or not path.is_file():
        raise BadRequestError("That file isn't in your Downloads folder any more.")
    if sys.platform == "win32":
        if data.show_in_folder:
            subprocess.Popen(["explorer", "/select,", str(path)])  # noqa: S603, S607
        else:
            os.startfile(path)  # noqa: S606 - the user's own downloaded file
    else:  # pragma: no cover - the desktop app is Windows-only
        subprocess.Popen(["xdg-open", str(path.parent if data.show_in_folder else path)])  # noqa: S603, S607
