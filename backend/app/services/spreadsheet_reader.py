"""Reads uploaded spreadsheets (.xlsx, .xls, .csv) into a header row and text rows.

Formulas are never evaluated: Excel files are read with their last saved values.
"""

import csv
import io
import zipfile
from collections.abc import Iterator
from dataclasses import dataclass
from datetime import date, datetime, time

import openpyxl
import xlrd
from openpyxl.utils import get_column_letter
from openpyxl.utils.exceptions import InvalidFileException

from app.services.column_mapping import find_header_row

MAX_UPLOAD_BYTES = 5 * 1024 * 1024
MAX_ROWS = 5000
SUPPORTED_EXTENSIONS = (".xlsx", ".xls", ".csv")


class SpreadsheetError(ValueError):
    """The file can't be read as a spreadsheet; the message is shown to the user."""


@dataclass
class SheetData:
    sheet_names: list[str]  # empty for CSV files
    sheet: str | None
    headers: list[str]
    rows: list[tuple[int, list[str]]]  # (row number as shown in Excel, cells aligned to headers)


def read_spreadsheet(filename: str, content: bytes, sheet: str | None = None) -> SheetData:
    name = filename.lower()
    if name.endswith(".xlsx"):
        sheet_names, sheet, raw_rows = _read_xlsx(content, sheet)
    elif name.endswith(".xls"):
        sheet_names, sheet, raw_rows = _read_xls(content, sheet)
    elif name.endswith(".csv"):
        sheet_names, sheet, raw_rows = [], None, _read_csv(content)
    else:
        raise SpreadsheetError("Unsupported file type. Upload a .xlsx, .xls or .csv file.")

    headers, rows = _split_header(raw_rows)
    return SheetData(sheet_names=sheet_names, sheet=sheet, headers=headers, rows=rows)


def cell_to_text(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, bool):
        return "TRUE" if value else "FALSE"
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    if isinstance(value, datetime):
        if value.time() == time(0, 0):
            return value.date().isoformat()
        return value.isoformat(sep=" ", timespec="minutes")
    if isinstance(value, date | time):
        return value.isoformat()
    return str(value).strip()


def _pick_sheet(sheet_names: list[str], sheet: str | None) -> str:
    if not sheet_names:
        raise SpreadsheetError("The workbook has no sheets.")
    if sheet is None:
        return sheet_names[0]
    if sheet not in sheet_names:
        raise SpreadsheetError(f"Sheet '{sheet}' was not found in the workbook.")
    return sheet


def _read_xlsx(content: bytes, sheet: str | None) -> tuple[list[str], str, list[list[str]]]:
    try:
        workbook = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    except (zipfile.BadZipFile, InvalidFileException, KeyError, OSError) as exc:
        raise SpreadsheetError("This file couldn't be read as an Excel (.xlsx) workbook.") from exc
    try:
        chosen = _pick_sheet(workbook.sheetnames, sheet)
        rows = _limit_rows(
            [cell_to_text(v) for v in row] for row in workbook[chosen].iter_rows(values_only=True)
        )
        return workbook.sheetnames, chosen, rows
    finally:
        workbook.close()


def _read_xls(content: bytes, sheet: str | None) -> tuple[list[str], str, list[list[str]]]:
    try:
        book = xlrd.open_workbook(file_contents=content, on_demand=True)
    except xlrd.XLRDError as exc:
        raise SpreadsheetError("This file couldn't be read as an Excel (.xls) workbook.") from exc

    def cells(row) -> list[str]:
        values = []
        for cell in row:
            if cell.ctype == xlrd.XL_CELL_DATE:
                values.append(cell_to_text(xlrd.xldate_as_datetime(cell.value, book.datemode)))
            else:
                values.append(cell_to_text(cell.value))
        return values

    try:
        names = book.sheet_names()
        chosen = _pick_sheet(names, sheet)
        worksheet = book.sheet_by_name(chosen)
        rows = _limit_rows(cells(worksheet.row(i)) for i in range(worksheet.nrows))
        return names, chosen, rows
    finally:
        book.release_resources()


def _read_csv(content: bytes) -> list[list[str]]:
    text = None
    for encoding in ("utf-8-sig", "cp1252", "latin-1"):
        try:
            text = content.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    assert text is not None  # latin-1 can decode any bytes

    try:
        dialect = csv.Sniffer().sniff(text[:4096], delimiters=",;\t|")
    except csv.Error:
        dialect = csv.excel
    return _limit_rows(
        [cell_to_text(v) for v in row] for row in csv.reader(io.StringIO(text), dialect)
    )


def _limit_rows(rows: Iterator[list[str]]) -> list[list[str]]:
    # Header row + MAX_ROWS data rows. Blank rows don't count towards the limit.
    result: list[list[str]] = []
    non_empty = 0
    for row in rows:
        result.append(row)
        if any(row):
            non_empty += 1
            if non_empty > MAX_ROWS + 1:
                raise SpreadsheetError(
                    f"This file has more than {MAX_ROWS} rows. Split it into smaller files."
                )
    return result


def _split_header(raw_rows: list[list[str]]) -> tuple[list[str], list[tuple[int, list[str]]]]:
    # The header is the row that looks most like column names, so titles, totals and blank
    # rows above the table are skipped.
    header_index = find_header_row(raw_rows)
    if header_index is None:
        raise SpreadsheetError("The file is empty.")

    raw_header = raw_rows[header_index]
    width = max(i for i, value in enumerate(raw_header) if value) + 1
    headers = _unique_headers(raw_header[:width])

    rows = []
    for index in range(header_index + 1, len(raw_rows)):
        cells = (raw_rows[index] + [""] * width)[:width]
        if any(cells):
            rows.append((index + 1, cells))
    if not rows:
        raise SpreadsheetError("The file has a header row but no data rows.")
    return headers, rows


def _unique_headers(raw: list[str]) -> list[str]:
    headers: list[str] = []
    seen: dict[str, int] = {}
    for position, value in enumerate(raw, start=1):
        name = value or f"Column {get_column_letter(position)}"
        count = seen.get(name.casefold(), 0) + 1
        seen[name.casefold()] = count
        headers.append(name if count == 1 else f"{name} ({count})")
    return headers
