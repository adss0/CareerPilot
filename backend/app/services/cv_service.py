import re
import uuid
from pathlib import Path, PurePath

from sqlmodel import Session

from app.core.errors import BadRequestError, NotFoundError
from app.integrations.ai import AIError, AIProvider
from app.models import CvDocument
from app.repositories.cv_repository import CvRepository
from app.schemas.cv import CvParseResult, CvRead, CvUpdate
from app.services.cv_ai_parser import parse_cv_with_ai
from app.services.cv_parser import parse_cv
from app.services.cv_text import CV_TYPES, CvReadError, cv_extension, extract_text

STORED_NAME_RE = re.compile(r"^[0-9a-f]{32}\.(pdf|docx|txt)$")


def to_read(cv: CvDocument) -> CvRead:
    return CvRead(
        id=cv.id,
        label=cv.label,
        original_filename=cv.original_filename,
        content_type=cv.content_type,
        size_bytes=cv.size_bytes,
        is_default=cv.is_default,
        has_text=bool(cv.text.strip()),
        created_at=cv.created_at,
    )


class CvService:
    def __init__(self, session: Session, storage_dir: Path, ai: AIProvider | None):
        self.session = session
        self.repo = CvRepository(session)
        self.storage_dir = storage_dir
        self.ai = ai

    def list(self) -> list[CvRead]:
        return [to_read(cv) for cv in self.repo.all()]

    def get(self, cv_id: int) -> CvDocument:
        cv = self.repo.get(cv_id)
        if cv is None:
            raise NotFoundError("CV", cv_id)
        return cv

    def upload(
        self, filename: str, content: bytes, label: str | None, use_ai: bool
    ) -> CvParseResult:
        extension = cv_extension(filename)
        if extension is None:
            raise BadRequestError("Unsupported file type. Upload a .pdf, .docx or .txt file.")
        try:
            text = extract_text(filename, content)
        except CvReadError as exc:
            raise BadRequestError(str(exc)) from exc

        # Random file name: nothing from the user's file name is used on disk.
        stored_name = f"{uuid.uuid4().hex}{extension}"
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        (self.storage_dir / stored_name).write_bytes(content)

        original = PurePath(filename.replace("\\", "/")).name[:200] or f"cv{extension}"
        cv = CvDocument(
            label=(label or "").strip()[:100] or PurePath(original).stem[:100] or "My CV",
            original_filename=original,
            stored_name=stored_name,
            content_type=CV_TYPES[extension],
            size_bytes=len(content),
            text=text,
            is_default=not self.repo.exists(),
        )
        try:
            self.repo.add(cv)
            self.session.commit()
        except Exception:
            (self.storage_dir / stored_name).unlink(missing_ok=True)
            raise
        return self._parse(cv, use_ai)

    def parse(self, cv_id: int, use_ai: bool) -> CvParseResult:
        return self._parse(self.get(cv_id), use_ai)

    def update(self, cv_id: int, data: CvUpdate) -> CvRead:
        cv = self.get(cv_id)
        if data.label is not None:
            cv.label = data.label.strip()
        if data.is_default:
            self.repo.clear_default()
            cv.is_default = True
        self.session.commit()
        self.session.refresh(cv)
        return to_read(cv)

    def delete(self, cv_id: int) -> None:
        cv = self.get(cv_id)
        path = self.file_path(cv)
        was_default = cv.is_default
        self.repo.delete(cv)
        self.session.flush()
        if was_default:
            remaining = self.repo.all()
            if remaining:
                remaining[0].is_default = True
        self.session.commit()
        path.unlink(missing_ok=True)

    def file_path(self, cv: CvDocument) -> Path:
        if not STORED_NAME_RE.fullmatch(cv.stored_name):
            raise BadRequestError("This CV's file name is invalid.")
        return self.storage_dir / cv.stored_name

    def _parse(self, cv: CvDocument, use_ai: bool) -> CvParseResult:
        warnings: list[str] = []
        if not cv.text.strip():
            warnings.append(
                "No text was found in this file. If it's a scanned PDF, fill in your profile "
                "by hand or upload a Word or text version."
            )

        if use_ai and cv.text.strip():
            if self.ai is None:
                warnings.append(
                    "AI isn't set up (add your Gemini key in Settings), "
                    "so the basic reader was used."
                )
            else:
                try:
                    details, ai_warnings = parse_cv_with_ai(self.ai, cv.text)
                    return CvParseResult(
                        cv=to_read(cv),
                        details=details,
                        parser="ai",
                        warnings=warnings + ai_warnings,
                    )
                except AIError as exc:
                    warnings.append(f"{exc} The basic reader was used instead.")

        return CvParseResult(
            cv=to_read(cv), details=parse_cv(cv.text), parser="basic", warnings=warnings
        )
