from datetime import datetime

import pytest

from app.services import spreadsheet_reader
from app.services.spreadsheet_reader import SpreadsheetError, read_spreadsheet
from tests.spreadsheets import make_csv, make_xlsx


def test_reads_messy_xlsx():
    content = make_xlsx(
        (
            "Jobs",
            [
                [],
                [None, None],  # blank rows above the table
                ["Company", "Role", None, "Role", "Salary", "Applied"],
                ["Acme Ltd", "Dev", "extra", "Senior", 30000.0, datetime(2026, 1, 5)],
                [None, None, None, None, None, None],  # blank row in the middle
                ["  Globex  ", "Analyst", None, None, 2.5, datetime(2026, 1, 6, 9, 30)],
            ],
        )
    )
    data = read_spreadsheet("jobs.xlsx", content)

    assert data.sheet_names == ["Jobs"]
    assert data.headers == ["Company", "Role", "Column C", "Role (2)", "Salary", "Applied"]
    assert data.rows == [
        (4, ["Acme Ltd", "Dev", "extra", "Senior", "30000", "2026-01-05"]),
        (6, ["Globex", "Analyst", "", "", "2.5", "2026-01-06 09:30"]),
    ]


def test_picks_requested_sheet():
    content = make_xlsx(
        ("Notes", [["Nothing here"], ["x"]]),
        ("Jobs", [["Company", "Role"], ["Acme Ltd", "Dev"]]),
    )
    data = read_spreadsheet("jobs.xlsx", content, sheet="Jobs")
    assert data.sheet_names == ["Notes", "Jobs"]
    assert data.sheet == "Jobs"
    assert data.headers == ["Company", "Role"]

    with pytest.raises(SpreadsheetError, match="not found"):
        read_spreadsheet("jobs.xlsx", content, sheet="Missing")


def test_formulas_are_never_evaluated_or_returned():
    content = make_xlsx(("Jobs", [["Company", "Role"], ["=1+1", "Dev"]]))
    data = read_spreadsheet("jobs.xlsx", content)
    assert data.rows[0][1][0] != "=1+1"


def test_reads_semicolon_csv_with_bom_and_windows_encoding():
    utf8 = b"\xef\xbb\xbf" + make_csv([["Company", "Salary"], ["Acme Ltd", "£30k"]], ";")
    assert read_spreadsheet("jobs.csv", utf8).rows == [(2, ["Acme Ltd", "£30k"])]

    cp1252 = make_csv([["Company", "Salary"], ["Acme Ltd", "£30k"]], encoding="cp1252")
    assert read_spreadsheet("jobs.csv", cp1252).rows == [(2, ["Acme Ltd", "£30k"])]


@pytest.mark.parametrize(
    ("filename", "content", "message"),
    [
        ("jobs.xlsx", b"not a real workbook", "couldn't be read"),
        ("jobs.xls", b"not a real workbook", "couldn't be read"),
        ("jobs.csv", b"\n\n", "empty"),
        ("jobs.csv", b"Company,Role\n", "no data rows"),
        ("jobs.pdf", b"%PDF", "Unsupported"),
    ],
)
def test_rejects_unreadable_files(filename, content, message):
    with pytest.raises(SpreadsheetError, match=message):
        read_spreadsheet(filename, content)


def test_rejects_too_many_rows(monkeypatch):
    monkeypatch.setattr(spreadsheet_reader, "MAX_ROWS", 2)
    content = make_csv([["Company", "Role"]] + [[f"Company {i}", "Dev"] for i in range(3)])
    with pytest.raises(SpreadsheetError, match="more than 2 rows"):
        read_spreadsheet("jobs.csv", content)
