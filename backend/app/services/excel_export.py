"""Builds .xlsx files: the applications export and the import template."""

import io
from datetime import datetime

from openpyxl import Workbook
from openpyxl.cell.cell import ILLEGAL_CHARACTERS_RE
from openpyxl.styles import Font, PatternFill
from openpyxl.worksheet.worksheet import Worksheet

from app.models import Application

XLSX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")
HEADER_FONT = Font(bold=True, color="FFFFFF")
HEADER_FILL = PatternFill("solid", fgColor="4F46E5")

EXPORT_COLUMNS: list[tuple[str, str, int]] = [
    # (header, Application attribute, column width)
    ("Company", "company", 24),
    ("Role", "role", 28),
    ("Status", "status", 13),
    ("Priority", "priority", 9),
    ("Job URL", "job_url", 40),
    ("Contact name", "contact_name", 20),
    ("Contact email", "contact_email", 28),
    ("Location", "location", 18),
    ("Salary", "salary", 14),
    ("Source", "source", 10),
    ("Applied at", "applied_at", 17),
    ("Follow up at", "follow_up_at", 17),
    ("Notes", "notes", 40),
    ("Job description", "job_description", 60),
    ("Added at", "created_at", 17),
]

TEMPLATE_HEADERS = [
    "Company",
    "Role",
    "Job URL",
    "Contact name",
    "Contact email",
    "Location",
    "Salary",
    "Job description",
    "Notes",
    "Status",
    "Application deadline",
]
TEMPLATE_EXAMPLES = [
    [
        "Example Ltd",
        "Junior Software Developer",
        "https://example.com/careers/123",
        "Alex Recruiter",
        "careers@example.com",
        "London (hybrid)",
        "£30,000",
        "Paste the job description here. The AI uses it to tailor your cover letter.",
        "Example row: delete it before importing",
        "To apply",
        "31/12/2026",
    ],
    [
        "Sample Analytics",
        "Data Analyst",
        "https://example.org/jobs/data-analyst",
        "",
        "",
        "Remote",
        "",
        "",
        "Contact details are optional",
        "Applied",
        "Rolling",
    ],
]


def safe_cell(value: object) -> object:
    """Stops text from being run as a formula when the file is opened (CSV/formula injection)."""
    if isinstance(value, datetime):
        return value.replace(tzinfo=None)
    if not isinstance(value, str):
        return value
    value = ILLEGAL_CHARACTERS_RE.sub("", value)
    if value.startswith(FORMULA_PREFIXES):
        return f"'{value}"
    return value


def build_applications_workbook(applications: list[Application]) -> bytes:
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Applications"
    _write_header(sheet, [(header, width) for header, _, width in EXPORT_COLUMNS])

    for application in applications:
        row = []
        for _, attribute, _ in EXPORT_COLUMNS:
            value = getattr(application, attribute)
            if attribute == "status":
                value = value.value.replace("_", " ").capitalize()
            row.append(safe_cell(value))
        sheet.append(row)

    for row in sheet.iter_rows(min_row=2):
        for cell in row:
            if isinstance(cell.value, datetime):
                cell.number_format = "yyyy-mm-dd hh:mm"
    return _to_bytes(workbook)


def build_template_workbook() -> bytes:
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Jobs"
    _write_header(sheet, [(h, 40 if h == "Job description" else 22) for h in TEMPLATE_HEADERS])
    for example in TEMPLATE_EXAMPLES:
        sheet.append(example)

    help_sheet = workbook.create_sheet("How to use")
    help_sheet.column_dimensions["A"].width = 100
    for line in (
        "How to fill in this template",
        "",
        "1. Add one job per row on the 'Jobs' sheet. Company and Role are required.",
        "2. Everything else is optional. Columns can be in any order or renamed:",
        "   CareerPilot matches them for you, and you can fix the matching before importing.",
        "3. Delete the example rows, save the file, then import it in CareerPilot.",
        "",
        "Rows already in your tracker (same company, role and link) are skipped automatically.",
    ):
        help_sheet.append([line])
    help_sheet["A1"].font = Font(bold=True, size=14)
    return _to_bytes(workbook)


def _write_header(sheet: Worksheet, columns: list[tuple[str, int]]) -> None:
    sheet.append([header for header, _ in columns])
    for index, (_, width) in enumerate(columns, start=1):
        cell = sheet.cell(row=1, column=index)
        cell.font = HEADER_FONT
        cell.fill = HEADER_FILL
        sheet.column_dimensions[cell.column_letter].width = width
    sheet.freeze_panes = "A2"
    sheet.auto_filter.ref = sheet.dimensions


def _to_bytes(workbook: Workbook) -> bytes:
    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()
