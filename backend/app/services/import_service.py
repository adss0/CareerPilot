import re
from datetime import date, datetime
from pathlib import PurePath
from urllib.parse import urlsplit

from annotated_types import MaxLen
from email_validator import EmailNotValidError, validate_email
from sqlmodel import Session

from app.core.errors import BadRequestError
from app.models import Application, ApplicationStatus, ImportBatch, StatusHistory
from app.repositories.application_repository import ApplicationRepository
from app.schemas.application import ApplicationBase
from app.schemas.imports import ImportFieldInfo, ImportIssue, ImportPreview, ImportResult
from app.services.column_mapping import FIELD_KEYS, IMPORT_FIELDS, REQUIRED_KEYS, suggest_mapping
from app.services.spreadsheet_reader import SheetData, read_spreadsheet

PREVIEW_ROWS = 10
NOTES_LIMIT = 5000

# Words people use in their own trackers, checked in this order ("not applied" before "applied").
STATUS_WORDS: tuple[tuple[tuple[str, ...], ApplicationStatus], ...] = (
    (("withdrawn", "withdrew", "not applied", "declined offer"), ApplicationStatus.WITHDRAWN),
    (
        ("reject", "unsuccessful", "declined", "not progressed", "no longer"),
        ApplicationStatus.REJECTED,
    ),
    (("offer",), ApplicationStatus.OFFER),
    (
        ("interview", "assessment centre", "assessment center", "final round"),
        ApplicationStatus.INTERVIEW,
    ),
    (("replied", "response", "responded"), ApplicationStatus.REPLIED),
    (("followed up", "follow up", "chased"), ApplicationStatus.FOLLOWED_UP),
    (
        ("applied", "sent", "submitted", "in progress", "pending", "assessment", "online test"),
        ApplicationStatus.SENT,
    ),
    (("ready",), ApplicationStatus.READY),
    (("draft",), ApplicationStatus.DRAFTED),
    (
        ("to apply", "not started", "new", "todo", "to do", "saved", "imported", "wishlist"),
        ApplicationStatus.IMPORTED,
    ),
)


ASSESSMENT_DONE = ("done", "complete", "completed", "submitted", "passed", "finished", "sat")
ASSESSMENT_PENDING = ("pending", "to do", "todo", "invited", "received", "in progress", "booked")


def parse_assessment(value: str) -> str:
    """ "Done" → "done", "Pending" → "pending", anything else → "" (kept in the notes)."""
    text = " ".join(value.casefold().split())
    if any(word in text for word in ASSESSMENT_DONE):
        return "done"
    if any(word in text for word in ASSESSMENT_PENDING) or text in ("yes", "y"):
        return "pending"
    return ""


DAY_FORMATS = ("%Y-%m-%d", "%d/%m/%Y", "%d/%m/%y", "%d-%m-%Y", "%d.%m.%Y", "%d %b %Y", "%d %B %Y")


def parse_day(value: str) -> date | None:
    """A UK-style date from a spreadsheet: 25/11/2026, 2026-11-25 or 25 Nov 2026."""
    text = value.strip().split(" ")[0] if re.match(r"^\d{4}-\d\d-\d\d ", value) else value.strip()
    for fmt in DAY_FORMATS:
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def parse_status(value: str) -> ApplicationStatus | None:
    """Maps a tracker's status text (e.g. "Applied", "Rejected") to a CareerPilot status."""
    text = " ".join(value.casefold().replace("-", " ").split())
    if not text:
        return ApplicationStatus.IMPORTED
    for words, status in STATUS_WORDS:
        if any(word in text for word in words):
            return status
    return None


def dedupe_key(company: str, role: str, job_url: str) -> tuple[str, str, str]:
    return (
        company.strip().casefold(),
        role.strip().casefold(),
        job_url.strip().casefold().rstrip("/"),
    )


def normalize_url(value: str) -> str | None:
    """Returns a safe http(s) URL, "" for blank, or None if it isn't a usable web link."""
    value = value.strip()
    if not value:
        return ""
    if "://" not in value and " " not in value and "." in value:
        value = f"https://{value}"
    parts = urlsplit(value)
    # Only http(s): blocks javascript:, file: and similar links from ever reaching the UI.
    if parts.scheme.lower() not in ("http", "https") or not parts.netloc or " " in value:
        return None
    return value


def _max_length(field: str) -> int | None:
    info = ApplicationBase.model_fields.get(field)
    if info is None:
        return None
    return next((m.max_length for m in info.metadata if isinstance(m, MaxLen)), None)


MAX_LENGTHS = {key: _max_length(key) for key in FIELD_KEYS}


class ImportService:
    def __init__(self, session: Session):
        self.session = session
        self.repo = ApplicationRepository(session)

    def preview(self, filename: str, content: bytes, sheet: str | None) -> ImportPreview:
        data = read_spreadsheet(filename, content, sheet)
        sample = [cells for _, cells in data.rows[:PREVIEW_ROWS]]
        return ImportPreview(
            filename=_safe_filename(filename),
            sheets=data.sheet_names,
            sheet=data.sheet,
            headers=data.headers,
            sample_rows=sample,
            total_rows=len(data.rows),
            fields=[
                ImportFieldInfo(key=f.key, label=f.label, required=f.required)
                for f in IMPORT_FIELDS
            ],
            suggested_mapping=suggest_mapping(data.headers, [c for _, c in data.rows[:50]]),
        )

    def commit(
        self, filename: str, content: bytes, sheet: str | None, mapping: dict[str, str | None]
    ) -> ImportResult:
        data = read_spreadsheet(filename, content, sheet)
        columns = self._resolve_mapping(data, mapping)

        batch = ImportBatch(filename=_safe_filename(filename), rows_total=len(data.rows))
        self.session.add(batch)
        self.session.flush()

        seen = {dedupe_key(*row) for row in self.repo.identity_rows()}
        seen_in_file: dict[tuple[str, str, str], int] = {}
        issues: list[ImportIssue] = []
        new_applications: list[Application] = []
        counts = {"duplicate": 0, "invalid": 0, "empty": 0, "warning": 0}

        mapped = set(columns.values())
        extra_columns = [
            (index, header) for index, header in enumerate(data.headers) if index not in mapped
        ]

        for row_number, cells in data.rows:
            values = {key: cells[index] for key, index in columns.items()}
            if not any(values.values()):
                counts["empty"] += 1
                continue

            row_issues: list[ImportIssue] = []
            values = self._clean_row(row_number, values, row_issues)
            company, role = values.get("company", ""), values.get("role", "")

            status_text = values.pop("status", "")
            status = parse_status(status_text)
            if status is None:
                status = ApplicationStatus.IMPORTED
                row_issues.append(
                    ImportIssue(
                        row=row_number,
                        kind="warning",
                        message=f"Status '{status_text[:40]}' wasn't recognised, so it's Imported.",
                        company=company,
                        role=role,
                    )
                )
            extra: list[tuple[str, str]] = []
            assessment_text = values.pop("assessment", "")
            values["assessment"] = parse_assessment(assessment_text)
            if assessment_text and not values["assessment"]:
                extra.append(("Pre-assessment", assessment_text))
            due_text = values.pop("assessment_due", "")
            values["assessment_due"] = parse_day(due_text)
            if due_text and values["assessment_due"] is None:
                extra.append(("Assessment deadline", due_text))
            # Columns without a field of their own are kept in the notes, so nothing is lost.
            extra += [(header, cells[index].strip()) for index, header in extra_columns]
            note_lines = [f"{label}: {value}" for label, value in extra if value]
            if note_lines:
                notes = "\n".join(filter(None, [values.get("notes", ""), *note_lines]))
                values["notes"] = notes[:NOTES_LIMIT]

            missing = [
                label
                for key, label in (("company", "company"), ("role", "role"))
                if not values.get(key)
            ]
            if missing:
                counts["invalid"] += 1
                issues.append(
                    ImportIssue(
                        row=row_number,
                        kind="invalid",
                        message=f"Missing {' and '.join(missing)}, so the row was skipped.",
                        company=company,
                        role=role,
                    )
                )
                continue

            key = dedupe_key(company, role, values.get("job_url", ""))
            if key in seen or key in seen_in_file:
                counts["duplicate"] += 1
                where = (
                    f"Same job as row {seen_in_file[key]}"
                    if key in seen_in_file
                    else "Already in your tracker"
                )
                issues.append(
                    ImportIssue(
                        row=row_number,
                        kind="duplicate",
                        message=f"{where}, so the row was skipped.",
                        company=company,
                        role=role,
                    )
                )
                continue
            seen_in_file[key] = row_number

            counts["warning"] += len(row_issues)
            issues.extend(row_issues)
            new_applications.append(
                Application(**values, source="excel", status=status, import_batch_id=batch.id)
            )

        self.repo.add_many(new_applications)
        for application in new_applications:
            self.repo.add_history(
                StatusHistory(application_id=application.id, to_status=application.status)
            )

        batch.rows_imported = len(new_applications)
        batch.rows_skipped = len(data.rows) - len(new_applications)
        self.session.commit()

        return ImportResult(
            batch_id=batch.id,
            filename=batch.filename,
            rows_total=len(data.rows),
            imported=len(new_applications),
            duplicates=counts["duplicate"],
            invalid=counts["invalid"],
            empty=counts["empty"],
            warnings=counts["warning"],
            issues=sorted(issues, key=lambda issue: issue.row),
        )

    @staticmethod
    def _resolve_mapping(data: SheetData, mapping: dict[str, str | None]) -> dict[str, int]:
        unknown = set(mapping) - set(FIELD_KEYS)
        if unknown:
            raise BadRequestError(f"Unknown field(s) in mapping: {', '.join(sorted(unknown))}.")

        columns: dict[str, int] = {}
        used: dict[str, str] = {}
        for key, header in mapping.items():
            if not header:
                continue
            if header not in data.headers:
                raise BadRequestError(f"Column '{header}' is not in the file.")
            if header in used:
                raise BadRequestError(
                    f"Column '{header}' is mapped to both {used[header]} and {key}."
                )
            used[header] = key
            columns[key] = data.headers.index(header)

        missing = [key for key in REQUIRED_KEYS if key not in columns]
        if missing:
            raise BadRequestError(f"Choose a column for: {', '.join(missing)}.")
        return columns

    @staticmethod
    def _clean_row(row: int, values: dict[str, str], issues: list[ImportIssue]) -> dict[str, str]:
        cleaned = {key: value.strip() for key, value in values.items()}

        email = cleaned.get("contact_email", "")
        if email:
            try:
                cleaned["contact_email"] = validate_email(
                    email, check_deliverability=False
                ).normalized
            except EmailNotValidError:
                cleaned["contact_email"] = ""
                issues.append(
                    ImportIssue(
                        row=row,
                        kind="warning",
                        message=f"'{email[:80]}' isn't a valid email, so it was left out.",
                        company=cleaned.get("company", ""),
                        role=cleaned.get("role", ""),
                    )
                )

        url = cleaned.get("job_url", "")
        if url:
            normalized = normalize_url(url)
            if normalized is None:
                cleaned["job_url"] = ""
                issues.append(
                    ImportIssue(
                        row=row,
                        kind="warning",
                        message=f"'{url[:80]}' isn't a web link, so it was left out.",
                        company=cleaned.get("company", ""),
                        role=cleaned.get("role", ""),
                    )
                )
            else:
                cleaned["job_url"] = normalized

        for key, value in cleaned.items():
            limit = MAX_LENGTHS.get(key)
            if limit and len(value) > limit:
                cleaned[key] = value[:limit]
        return cleaned


def _safe_filename(filename: str) -> str:
    # Keep only the file's own name, never a path the browser may have sent.
    return PurePath(filename.replace("\\", "/")).name[:200] or "upload"
