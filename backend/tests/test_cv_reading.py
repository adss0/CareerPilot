import pytest

from app.services.cv_parser import details_from_dict, parse_cv
from app.services.cv_text import CvReadError, extract_text
from tests.cv_files import SAMPLE_CV, make_docx, make_pdf


def test_extracts_text_from_pdf():
    text = extract_text("cv.pdf", make_pdf(["Jane Example", "jane@example.com", "Skills (Python)"]))
    assert "Jane Example" in text
    assert "jane@example.com" in text
    assert "Skills (Python)" in text


def test_extracts_text_from_docx_including_tables():
    content = make_docx(["Jane Example", "Profile"], table=[["Python", "SQL"], ["React", "Git"]])
    text = extract_text("cv.DOCX", content)
    assert "Jane Example" in text
    assert "Python" in text and "Git" in text


def test_extracts_text_from_txt_and_tidies_whitespace():
    text = extract_text("cv.txt", b"Jane   Example\r\n\r\n\r\n\r\nSkills\t Python")
    assert text == "Jane Example\n\nSkills Python"


@pytest.mark.parametrize(
    ("filename", "content", "message"),
    [
        ("cv.pdf", b"not a pdf", "couldn't be read as a PDF"),
        ("cv.docx", b"not a docx", "couldn't be read as a Word"),
        ("cv.doc", b"old word", "Unsupported"),
    ],
)
def test_rejects_unreadable_cvs(filename, content, message):
    with pytest.raises(CvReadError, match=message):
        extract_text(filename, content)


def test_basic_parser_reads_sample_cv():
    details = parse_cv(SAMPLE_CV)

    assert details.full_name == "Jane Example"
    assert details.email == "jane@example.com"
    assert details.phone == "+44 7700 900123"
    assert details.location == "Leeds, UK"
    assert details.linkedin_url == "https://linkedin.com/in/jane-example"
    assert details.github_url == "https://github.com/jane-example"
    assert details.summary.startswith("Graduate software developer")
    assert details.skills == ["Python", "TypeScript", "SQL", "Git", "Docker", "React"]

    first, second = details.experience
    assert (first.title, first.company) == ("Software Developer Intern", "Example Ltd")
    assert (first.start, first.end) == ("Jun 2024", "Sep 2024")
    assert "- Built a FastAPI service used by 3 teams" in first.summary
    assert (second.title, second.company) == ("Teaching Assistant", "Example University")
    assert (second.start, second.end) == ("Sep 2023", "Present")

    (education,) = details.education
    assert education.qualification == "BSc Computer Science"
    assert education.institution == "Example University"
    assert (education.start, education.end) == ("2021", "2024")
    assert education.details == "First Class Honours"

    (project,) = details.projects
    assert project.name == "CareerPilot"
    assert project.link == "https://example.com/careerpilot"
    assert "free AI" in project.summary


def test_basic_parser_copes_with_unstructured_text():
    details = parse_cv("just some words without any sections")
    assert details.full_name == ""
    assert details.experience == []


def test_details_from_dict_trims_and_ignores_bad_data():
    details = details_from_dict(
        {
            "full_name": "x" * 500,
            "skills": ["Python", "python", "", 42],
            "experience": [{"title": "Dev", "unknown": "ignored"}, "not a dict"],
            "projects": "not a list",
        }
    )
    assert len(details.full_name) == 200
    assert details.skills == ["Python", "42"]
    assert len(details.experience) == 1 and details.experience[0].title == "Dev"
    assert details.projects == []
