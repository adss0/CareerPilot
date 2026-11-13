import json
from datetime import date

import pytest
from sqlmodel import Session, select

from app.api import imports as imports_api
from app.models import Application, ImportBatch, StatusHistory
from tests.spreadsheets import JOBS_HEADER, JOBS_ROWS, make_csv, make_xlsx

XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
MAPPING = {
    "company": "Employer",
    "role": "Job Title",
    "contact_email": "E-mail",
    "job_url": "Link",
    "location": "City",
    "notes": "Comments",
}


def jobs_file(rows=None, header=None, filename="jobs.xlsx"):
    content = make_xlsx(("Jobs", [header or JOBS_HEADER, *(rows or JOBS_ROWS)]))
    return {"file": (filename, content, XLSX)}


def commit(client, files, mapping=None, **data):
    return client.post(
        "/api/imports/commit",
        files=files,
        data={"mapping": json.dumps(mapping or MAPPING), **data},
    )


def test_preview_suggests_mapping(client):
    response = client.post("/api/imports/preview", files=jobs_file())
    assert response.status_code == 200
    body = response.json()

    assert body["filename"] == "jobs.xlsx"
    assert body["sheets"] == ["Jobs"]
    assert body["headers"] == JOBS_HEADER
    assert body["total_rows"] == 3
    assert body["sample_rows"][0][0] == "Acme Ltd"
    assert {f["key"] for f in body["fields"] if f["required"]} == {"company", "role"}
    for field, header in MAPPING.items():
        assert body["suggested_mapping"][field] == header


def test_commit_imports_rows(client, session: Session):
    response = commit(client, jobs_file())
    assert response.status_code == 200
    result = response.json()
    assert result["imported"] == 3
    assert result["duplicates"] == result["invalid"] == result["warnings"] == 0

    applications = session.exec(select(Application).order_by(Application.id)).all()
    assert [a.company for a in applications] == ["Acme Ltd", "Globex", "Initech"]
    assert all(a.source == "excel" and a.status == "imported" for a in applications)
    assert applications[1].job_url == "https://example.org/globex"  # https:// added
    assert applications[1].notes == "Referral"

    batch = session.get(ImportBatch, result["batch_id"])
    assert (batch.rows_total, batch.rows_imported, batch.rows_skipped) == (3, 3, 0)
    assert all(a.import_batch_id == batch.id for a in applications)
    assert len(session.exec(select(StatusHistory)).all()) == 3


def test_skips_duplicates_in_tracker_and_in_file(client, make_application):
    make_application(
        company="ACME LTD", role="backend developer", job_url="https://example.com/acme/1/"
    )
    rows = [*JOBS_ROWS, ["Globex", "Data Analyst", "", "https://example.org/globex", "", ""]]

    result = commit(client, jobs_file(rows)).json()

    assert result["imported"] == 2
    assert result["duplicates"] == 2
    assert [(i["row"], i["message"]) for i in result["issues"]] == [
        (2, "Already in your tracker, so the row was skipped."),
        (5, "Same job as row 3, so the row was skipped."),
    ]

    # Importing the same file again adds nothing
    again = commit(client, jobs_file(rows)).json()
    assert again["imported"] == 0
    assert again["duplicates"] == 4


def test_reports_invalid_rows_and_cleans_bad_values(client, session: Session):
    rows = [
        ["", "Developer", "", "", "", ""],  # no company
        ["Hooli", "", "", "", "", ""],  # no role
        ["", "", "", "", "", "only a comment"],  # nothing mapped except notes
        ["Acme Ltd", "Dev", "not-an-email", "javascript:alert(1)", "", ""],
        ["Long Co", "x" * 300, "", "", "", ""],
    ]
    result = commit(client, jobs_file(rows)).json()

    assert result["imported"] == 2
    assert result["invalid"] == 3
    assert result["warnings"] == 2
    messages: dict[tuple[int, str], list[str]] = {}
    for issue in result["issues"]:
        messages.setdefault((issue["row"], issue["kind"]), []).append(issue["message"])
    assert "Missing company" in messages[(2, "invalid")][0]
    assert "Missing role" in messages[(3, "invalid")][0]
    assert "Missing company and role" in messages[(4, "invalid")][0]
    row_5 = " ".join(messages[(5, "warning")])
    assert "valid email" in row_5
    assert "web link" in row_5

    acme = session.exec(select(Application).where(Application.company == "Acme Ltd")).one()
    assert acme.contact_email == ""
    assert acme.job_url == ""  # javascript: link never stored
    long_role = session.exec(select(Application).where(Application.company == "Long Co")).one()
    assert len(long_role.role) == 200


def test_rows_with_all_mapped_cells_empty_are_counted_as_empty(client):
    rows = [*JOBS_ROWS, ["", "", "", "", "", ""], ["", "", "", "", "Leeds", ""]]
    mapping = {"company": "Employer", "role": "Job Title"}  # City isn't mapped
    result = commit(client, jobs_file(rows), mapping).json()
    assert result["imported"] == 3
    assert result["empty"] == 1


def test_imports_csv_and_chosen_sheet(client):
    csv_file = {"file": ("jobs.csv", make_csv([JOBS_HEADER, *JOBS_ROWS], ";"), "text/csv")}
    assert commit(client, csv_file).json()["imported"] == 3

    workbook = make_xlsx(
        ("Readme", [["Fill in the Jobs sheet"], ["thanks"]]),
        ("Jobs", [JOBS_HEADER, ["Umbrella", "Researcher", "", "", "", ""]]),
    )
    files = {"file": ("multi.xlsx", workbook, XLSX)}
    assert commit(client, files, sheet="Jobs").json()["imported"] == 1


@pytest.mark.parametrize(
    ("mapping", "message"),
    [
        ({"company": "Employer"}, "Choose a column for: role"),
        ({"company": "Employer", "role": "Nope"}, "not in the file"),
        ({"company": "Employer", "role": "Employer"}, "mapped to both"),
        ({"company": "Employer", "role": "Job Title", "salary_max": "City"}, "Unknown field"),
    ],
)
def test_rejects_bad_mapping(client, mapping, message):
    response = commit(client, jobs_file(), mapping)
    assert response.status_code == 400
    assert message in response.json()["detail"]


def test_rejects_malformed_mapping_json(client):
    response = client.post("/api/imports/commit", files=jobs_file(), data={"mapping": "{oops"})
    assert response.status_code == 400
    response = client.post("/api/imports/commit", files=jobs_file(), data={"mapping": "[1]"})
    assert response.status_code == 400


def test_rejects_bad_uploads(client, monkeypatch):
    wrong_type = {"file": ("notes.txt", b"hello", "text/plain")}
    assert client.post("/api/imports/preview", files=wrong_type).status_code == 415

    empty = {"file": ("jobs.csv", b"", "text/csv")}
    assert client.post("/api/imports/preview", files=empty).status_code == 400

    monkeypatch.setattr(imports_api, "MAX_UPLOAD_BYTES", 10)
    assert client.post("/api/imports/preview", files=jobs_file()).status_code == 413


def test_broken_file_returns_readable_error(client):
    broken = {"file": ("jobs.xlsx", b"definitely not excel", XLSX)}
    response = client.post("/api/imports/preview", files=broken)
    assert response.status_code == 400
    assert "couldn't be read" in response.json()["detail"]


def test_only_the_file_name_is_stored(client, session: Session):
    result = commit(client, jobs_file(filename="C:\\Users\\someone\\Desktop\\jobs.xlsx")).json()
    assert result["filename"] == "jobs.xlsx"
    assert session.get(ImportBatch, result["batch_id"]).filename == "jobs.xlsx"


# A personal tracker: a title, a totals block, then the table (like a real "grad jobs" sheet).
TRACKER = [
    ["Grad Job Application Tracker"],
    [],
    ["Total Applications", 4, "Applied", 2, "Rejected", 1],
    ["Assessments Done", 1, "In Progress", 0, "Interviews", 0],
    [],
    [
        "Company",
        "Role",
        "Application Deadline",
        "Status",
        "Pre-assessment",
        "Deadline",
        "Recruiter notes",
    ],
    ["Acme Ltd", "Software Engineer", "Rolling", "Rejected", "Done", "25/11/2026", None],
    ["Globex", "Cloud Engineer", "Rolling", "Applied ", None, None, "Called me"],
    ["Initech", "Tech Graduate", "Rolling", "Interview booked", "Pending", "16/11/2026", None],
    ["Umbrella", "Grad Software", "31/12/2026", "Something odd", "Maybe", "soon", None],
]


def test_finds_the_table_under_a_title_and_totals(client):
    files = {"file": ("tracker.xlsx", make_xlsx(("Tracker", TRACKER)), XLSX)}
    preview = client.post("/api/imports/preview", files=files).json()
    assert preview["headers"][:4] == ["Company", "Role", "Application Deadline", "Status"]
    assert preview["total_rows"] == 4
    mapping = preview["suggested_mapping"]
    assert mapping["company"] == "Company" and mapping["role"] == "Role"
    assert mapping["status"] == "Status"
    assert mapping["application_deadline"] == "Application Deadline"
    assert mapping["assessment"] == "Pre-assessment"
    assert mapping["assessment_due"] == "Deadline"
    assert mapping["job_url"] is None  # "Application Deadline" isn't a link


def test_imports_tracker_status_and_keeps_other_columns_in_notes(client, session: Session):
    files = {"file": ("tracker.xlsx", make_xlsx(("Tracker", TRACKER)), XLSX)}
    mapping = {
        "company": "Company",
        "role": "Role",
        "status": "Status",
        "application_deadline": "Application Deadline",
        "assessment": "Pre-assessment",
        "assessment_due": "Deadline",
    }
    result = commit(client, files, mapping).json()
    assert result["imported"] == 4
    assert [i["message"] for i in result["issues"]] == [
        "Status 'Something odd' wasn't recognised, so it's Imported."
    ]
    apps = {a.company: a for a in session.exec(select(Application)).all()}
    assert apps["Acme Ltd"].status == "rejected"
    assert apps["Globex"].status == "sent"
    assert apps["Initech"].status == "interview"
    assert apps["Umbrella"].status == "imported"
    acme = apps["Acme Ltd"]
    assert (acme.application_deadline, acme.assessment) == ("Rolling", "done")
    assert acme.assessment_due == date(2026, 11, 25)
    assert acme.notes == ""
    assert apps["Initech"].assessment == "pending"
    assert apps["Umbrella"].application_deadline == "31/12/2026"
    # What doesn't fit a field is kept in the notes.
    assert apps["Umbrella"].notes == "Pre-assessment: Maybe\nAssessment deadline: soon"
    assert apps["Globex"].notes == "Recruiter notes: Called me"
    history = session.exec(
        select(StatusHistory).where(StatusHistory.application_id == apps["Acme Ltd"].id)
    ).all()
    assert [h.to_status for h in history] == ["rejected"]


@pytest.mark.parametrize(
    ("text", "status"),
    [
        ("", "imported"),
        ("Applied", "sent"),
        ("Not applied yet", "withdrawn"),
        ("Unsuccessful", "rejected"),
        ("Offer received!", "offer"),
        ("Online test pending", "sent"),
        ("To apply", "imported"),
        ("??", None),
    ],
)
def test_parse_status(text, status):
    from app.services.import_service import parse_status

    assert parse_status(text) == status
