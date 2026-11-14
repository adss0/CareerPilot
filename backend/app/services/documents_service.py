"""Saves tailored CVs and cover letters as PDFs in a folder the user can browse.

Default: Documents\\CareerPilot, with "CVs" and "Cover Letters" inside. Each file is named
after the company and role. Files are only written when the user applies or asks for it.
"""

import os
import subprocess
import sys
from pathlib import Path

from sqlmodel import Session

from app.core.errors import BadRequestError
from app.models import Application, AppSetting
from app.schemas.documents import DocumentSettingsRead, DocumentSettingsUpdate
from app.schemas.profile import ProfileDetails
from app.schemas.tailored_cv import TailoredContent
from app.services.cv_export import CvLayout, build_cv_pdf, cv_filename
from app.services.letter_export import build_pdf, letter_filename

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

    @property
    def cv_dir(self) -> Path:
        return self.folder / CV_FOLDER

    @property
    def letter_dir(self) -> Path:
        return self.folder / LETTER_FOLDER

    def save_cv(
        self,
        application: Application,
        content: TailoredContent,
        profile: ProfileDetails,
        layout: CvLayout | None = None,
    ) -> Path:
        name = cv_filename(profile.full_name, "pdf", application.company, application.role)
        return self._write(self.cv_dir / name, build_cv_pdf(content, profile, layout))

    def save_letter(self, application: Application, letter: str, profile: ProfileDetails) -> Path:
        name = letter_filename(application.company, application.role, "pdf")
        return self._write(self.letter_dir / name, build_pdf(letter, profile))

    @staticmethod
    def _write(path: Path, content: bytes) -> Path:
        path.parent.mkdir(parents=True, exist_ok=True)
        temp = path.with_name(f".{path.name}.tmp")
        temp.write_bytes(content)
        os.replace(temp, path)  # a file open elsewhere fails here, not half-written
        return path

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
