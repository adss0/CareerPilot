from app.services.column_mapping import suggest_mapping


def test_matches_common_header_names():
    headers = ["Employer", "Job Title", "E-mail", "Link", "Recruiter", "City", "Pay", "Comments"]
    mapping = suggest_mapping(headers, [])

    assert mapping == {
        "company": "Employer",
        "role": "Job Title",
        "contact_email": "E-mail",
        "job_url": "Link",
        "contact_name": "Recruiter",
        "job_description": None,
        "location": "City",
        "salary": "Pay",
        "notes": "Comments",
    }


def test_matches_typos_and_extra_words():
    mapping = suggest_mapping(["Compnay", "Position (required)", "Job Description"], [])
    assert mapping["company"] == "Compnay"
    assert mapping["role"] == "Position (required)"
    assert mapping["job_description"] == "Job Description"


def test_contact_email_and_name_are_not_mixed_up():
    mapping = suggest_mapping(["Contact Email", "Contact"], [])
    assert mapping["contact_email"] == "Contact Email"
    assert mapping["contact_name"] == "Contact"


def test_unrelated_columns_are_left_unmapped():
    mapping = suggest_mapping(["Company", "Role", "Status", "Date applied"], [])
    assert "Status" not in mapping.values()
    assert "Date applied" not in mapping.values()


def test_each_column_is_used_once():
    mapping = suggest_mapping(["Job", "Job"], [])
    used = [header for header in mapping.values() if header]
    assert len(used) == len(set(used))


def test_falls_back_to_column_contents_for_email_and_links():
    headers = ["Company", "Role", "Column C", "Info"]
    rows = [
        ["Acme Ltd", "Dev", "a@example.com", "https://example.com/1"],
        ["Globex", "Analyst", "b@example.com", "www.example.org/2"],
    ]
    mapping = suggest_mapping(headers, rows)
    assert mapping["contact_email"] == "Column C"
    assert mapping["job_url"] == "Info"
