"""Saves tailored CVs and cover letters as Word + PDF files in a folder the user can browse.

Default: Documents\\CareerPilot, with "CVs" and "Cover Letters" inside, one folder per company.
"""

import logging
import os
import re
import subprocess
import sys
from pathlib import Path

from sqlmodel import Session

from app.core.errors import BadRequestError
from app.models import Application, AppSetting
from app.schemas.documents import DocumentSettingsRead, DocumentSettingsUpdate
from app.schemas.profile import ProfileDetails
from app.schemas.tailored_cv import TailoredContent
from app.services.cv_export import build_cv_docx, build_cv_pdf, cv_filename
from app.services.letter_export import build_docx, build_pdf, letter_filename

logger = logging.getLogger(__name__)

SETTINGS_KEY = "documents"
CV_FOLDER = "CVs"
LETTER_FOLDER = "Cover Letters"


def documents_dir() -> Path:
    """The user's Documents folder (follows OneDrive or a moved Documents folder on Windows)."""
    if sys.platform == "win32":
        import ctypes
        from ctypes import wintypes

        buffer = ctypes.create_unicode_buffer(wintypes.MAX_PATH)
        # CSIDL_PERSONAL (5) is "Documents"; SHGFP_TYPE_CURRENT (0) is where it is right now.
        if ctypes.windll.shell32.SHGetFolderPathW(None, 5, None, 0, buffer) == 0 and buffer.value:
            return Path(buffer.value)
    return Path.home() / "Documents"


def default_folder() -> Path:
    # CAREERPILOT_DOCUMENTS lets automated tests keep files out of the real Documents folder.
    if override := os.environ.get("CAREERPILOT_DOCUMENTS"):
        return Path(override)
    return documents_dir() / "CareerPilot"


def folder_name(value: str) -> str:
    """A safe Windows folder name for a company (no \\ / : * ? " < > |, no trailing dots)."""
    safe = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "", value)
    safe = re.sub(r"\s+", " ", safe).strip(" .")[:80]
    if safe.upper() in {"CON", "PRN", "AUX", "NUL"} or re.fullmatch(r"(?i)(COM|LPT)\d", safe):
        safe = f"_{safe}"
    return safe or "Other"


class DocumentsService:
    def __init__(self, session: Session):
        self.session = session

    # ---------- settings ----------

    def _stored(self) -> dict:
        row = self.session.get(AppSetting, SETTINGS_KEY)
        return dict(row.value) if row else {}

    @property
    def folder(self) -> Path:
        stored = self._stored().get("folder")
        return Path(stored) if stored else default_folder()

    @property
    def auto_save(self) -> bool:
        return bool(self._stored().get("auto_save", True))

    def settings(self) -> DocumentSettingsRead:
        return DocumentSettingsRead(
            folder=str(self.folder),
            default_folder=str(default_folder()),
            auto_save=self.auto_save,
        )

    def update(self, data: DocumentSettingsUpdate) -> DocumentSettingsRead:
        stored = self._stored()
        if data.folder is not None:
            folder = data.folder.strip()
            if folder:
                path = Path(os.path.expandvars(folder)).expanduser()
                if not path.is_absolute():
                    raise BadRequestError("Enter a full folder path, such as C:\\Users\\you\\...")
                try:
                    path.mkdir(parents=True, exist_ok=True)
                    probe = path / ".careerpilot-write-test"
                    probe.write_text("ok")
                    probe.unlink()
                except OSError as exc:
                    raise BadRequestError(
                        "CareerPilot can't save files in that folder. Choose one you can write to "
                        "(Program Files needs admin rights)."
                    ) from exc
                stored["folder"] = str(path)
            else:
                stored.pop("folder", None)  # back to the default
        if data.auto_save is not None:
            stored["auto_save"] = data.auto_save
        row = self.session.get(AppSetting, SETTINGS_KEY) or AppSetting(key=SETTINGS_KEY)
        row.value = stored
        self.session.add(row)
        self.session.commit()
        return self.settings()

    # ---------- saving files ----------

    def cv_dir(self, application: Application) -> Path:
        return self.folder / CV_FOLDER / folder_name(application.company)

    def letter_dir(self, application: Application) -> Path:
        return self.folder / LETTER_FOLDER / folder_name(application.company)

    def save_cv(
        self, application: Application, content: TailoredContent, profile: ProfileDetails
    ) -> Path:
        folder = self.cv_dir(application)
        name = profile.full_name
        files = {
            cv_filename(name, "docx", application.company, application.role): build_cv_docx(
                content, profile
            ),
            cv_filename(name, "pdf", application.company, application.role): build_cv_pdf(
                content, profile
            ),
        }
        return self._write(folder, files)

    def save_letter(self, application: Application, letter: str, profile: ProfileDetails) -> Path:
        folder = self.letter_dir(application)
        files = {
            letter_filename(application.company, application.role, "docx"): build_docx(
                letter, profile
            ),
            letter_filename(application.company, application.role, "pdf"): build_pdf(
                letter, profile
            ),
        }
        return self._write(folder, files)

    def try_auto_save(self, save, *args) -> str | None:
        """Saves if auto-save is on. Never fails the request: a locked file is only logged."""
        if not self.auto_save:
            return None
        try:
            return str(save(*args))
        except OSError:
            logger.warning("Couldn't save documents to %s", self.folder, exc_info=True)
            return None

    @staticmethod
    def _write(folder: Path, files: dict[str, bytes]) -> Path:
        folder.mkdir(parents=True, exist_ok=True)
        for name, content in files.items():
            temp = folder / f".{name}.tmp"
            temp.write_bytes(content)
            os.replace(temp, folder / name)  # an open file in Word fails here, not half-written
        return folder

    # ---------- opening in Explorer ----------

    def open_folder(self, path: Path | None = None) -> str:
        folder = path or self.folder
        folder.mkdir(parents=True, exist_ok=True)
        if sys.platform == "win32":
            os.startfile(folder)  # noqa: S606 - opens Explorer on the user's own folder
        elif sys.platform == "darwin":
            subprocess.Popen(["open", str(folder)])  # noqa: S603, S607
        else:
            subprocess.Popen(["xdg-open", str(folder)])  # noqa: S603, S607
        return str(folder)
