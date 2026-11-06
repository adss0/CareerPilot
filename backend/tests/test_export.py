import json

from app.services.excel_export import TEMPLATE_HEADERS
from tests.spreadsheets import read_xlsx

XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def test_export_contains_applications(client, make_application):
    make_application(company="Acme Ltd", role="Dev", status="sent")
    make_application(company="Globex", role="Analyst", contact_email="jobs@example.com")

    response = client.get("/api/applications/export")
    assert response.status_code == 200
    assert response.headers["content-type"] == XLSX
    assert "careerpilot-applications-" in response.headers["content-disposition"]

    rows = read_xlsx(response.content)
    assert rows[0][:3] == ["Company", "Role", "Status"]
    assert {(r[0], r[2]) for r in rows[1:]} == {("Acme Ltd", "Sent"), ("Globex", "Imported")}


def test_export_filters_by_status(client, make_application):
    make_application(company="Acme Ltd", status="sent")
    make_application(company="Globex")

    rows = read_xlsx(client.get("/api/applications/export", params={"status": "sent"}).content)
    assert [r[0] for r in rows[1:]] == ["Acme Ltd"]


def test_export_neutralises_formulas(client, make_application):
    make_application(company='=HYPERLINK("https://example.com","click")', role="+1 Dev")

    rows = read_xlsx(client.get("/api/applications/export").content)
    assert rows[1][0] == '\'=HYPERLINK("https://example.com","click")'
    assert rows[1][1] == "'+1 Dev"


def test_export_with_no_applications_has_header_only(client):
    rows = read_xlsx(client.get("/api/applications/export").content)
    assert len(rows) == 1


def test_exported_file_can_be_reimported_without_duplicates(client, make_application):
    make_application(company="Acme Ltd", role="Dev", job_url="https://example.com/1")
    make_application(company="Globex", role="Analyst")
    exported = client.get("/api/applications/export").content
    files = {"file": ("export.xlsx", exported, XLSX)}

    preview = client.post("/api/imports/preview", files=files).json()
    mapping = preview["suggested_mapping"]
    assert mapping["company"] == "Company"
    assert mapping["job_url"] == "Job URL"

    result = client.post(
        "/api/imports/commit", files=files, data={"mapping": json.dumps(mapping)}
    ).json()
    assert result["imported"] == 0
    assert result["duplicates"] == 2


def test_template_downloads_and_matches_every_field(client):
    response = client.get("/api/imports/template")
    assert response.status_code == 200
    assert response.headers["content-type"] == XLSX

    rows = read_xlsx(response.content, "Jobs")
    assert rows[0] == TEMPLATE_HEADERS
    assert all("example" in str(row[2]) for row in rows[1:])  # fake example data only

    files = {"file": ("template.xlsx", response.content, XLSX)}
    preview = client.post("/api/imports/preview", files=files).json()
    assert all(preview["suggested_mapping"].values())
