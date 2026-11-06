"""Builds fake spreadsheets in memory for tests (no real files or personal data)."""

import csv
import io

from openpyxl import Workbook, load_workbook


def make_xlsx(*sheets: tuple[str, list[list[object]]]) -> bytes:
    workbook = Workbook()
    workbook.remove(workbook.active)
    for title, rows in sheets:
        sheet = workbook.create_sheet(title)
        for row in rows:
            sheet.append(row)
    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


def make_csv(rows: list[list[str]], delimiter: str = ",", encoding: str = "utf-8") -> bytes:
    buffer = io.StringIO()
    csv.writer(buffer, delimiter=delimiter).writerows(rows)
    return buffer.getvalue().encode(encoding)


def read_xlsx(content: bytes, sheet: str | None = None) -> list[list[object]]:
    workbook = load_workbook(io.BytesIO(content))
    worksheet = workbook[sheet] if sheet else workbook.active
    return [list(row) for row in worksheet.iter_rows(values_only=True)]


JOBS_HEADER = ["Employer", "Job Title", "E-mail", "Link", "City", "Comments"]
JOBS_ROWS = [
    [
        "Acme Ltd",
        "Backend Developer",
        "jobs@example.com",
        "https://example.com/acme/1",
        "Leeds",
        "",
    ],
    ["Globex", "Data Analyst", "", "example.org/globex", "Remote", "Referral"],
    ["Initech", "QA Engineer", "hr@example.net", "", "Manchester", ""],
]
