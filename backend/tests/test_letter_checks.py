from app.services.letter_checks import check_letter

PROFILE = (
    "Jane Example. Skills: Python, React, SQL. Software Developer Intern at Example Ltd, "
    "built a FastAPI service used by 3 teams. BSc Computer Science, Example University."
)
JOB = "Company: Globex\nRole: Backend Developer\nJob description: Python and SQL. 2 days in office."

GOOD_LETTER = """Dear Hiring Manager,

At Example Ltd I built a FastAPI service used by 3 teams, using Python and SQL daily.
I'd love to bring that to Globex as a Backend Developer, two days a week in the office.

Kind regards,
Jane Example"""


def test_honest_letter_has_no_flags():
    assert check_letter(GOOD_LETTER, profile_text=PROFILE, job_text=JOB) == []


def test_flags_invented_numbers_and_tools():
    letter = GOOD_LETTER.replace(
        "using Python and SQL daily.",
        "cutting costs by 40% and managing Kubernetes clusters for 12 clients.",
    )
    flags = check_letter(letter, profile_text=PROFILE, job_text=JOB)
    assert any("'40%'" in f for f in flags)
    assert any("'12 clients'" in f for f in flags)
    assert any("'Kubernetes'" in f for f in flags)


def test_flags_placeholders_and_missing_job_description():
    flags = check_letter(
        "Dear Hiring Manager,\nI admire [Company] greatly.",
        profile_text=PROFILE,
        job_text="Company: Globex\nJob description: (not provided; write a general letter)",
    )
    assert any("placeholder" in f for f in flags)
    assert any("no job description" in f for f in flags)


def test_sentence_starts_and_common_words_are_not_flagged():
    letter = "Dear Hiring Manager,\nHaving used Python, I can start in June.\nThank you."
    assert check_letter(letter, profile_text=PROFILE, job_text=JOB) == []
