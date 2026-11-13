"""A second common grad CV layout: a skills block, "Name | tech Label" projects, "&" headings."""

from app.services.cv_parser import parse_cv
from app.services.cv_text import clean_text

CV = """Jane Example
Leeds, UK | jane@example.com

EDUCATION
Example University Sep 2023 - Jun 2027
BSc (Hons) Computer Science | Expected: First Class

TECHNICAL SKILLS
Languages: C#, Java, T ypeScript
Frameworks & Libraries: .NET , WPF , Spring Boot, JP A

PROJECTS
Shop App | Java, Spring Boot, JP A Coursework
• Built a REST API for a shop
Budget Tracker | React, T ypeScript Personal Project
• Tracks spending
Notes | A notes app
• Saves notes

LEADERSHIP & ACTIVITIES
• Treasurer of the Example Society
"""


def test_kerning_inside_words_and_between_capitals():
    assert clean_text("T ypeScript and JP A, WPF , Y ear") == "TypeScript and JPA, WPF , Year"
    assert clean_text("A team I led in the UK") == "A team I led in the UK"


def test_second_grad_layout():
    profile = parse_cv(clean_text(CV))
    assert profile.skills == ["C#", "Java", "TypeScript", ".NET", "WPF", "Spring Boot", "JPA"]
    assert [p.name for p in profile.projects] == [
        "Shop App (Coursework)",
        "Budget Tracker (Personal Project)",
        "Notes | A notes app",
    ]
    assert profile.projects[0].summary.startswith("Tech: Java, Spring Boot, JPA\n- Built")
    assert profile.projects[2].summary == "- Saves notes"
    assert [(e.qualification, e.institution) for e in profile.education] == [
        ("BSc (Hons) Computer Science", "Example University")
    ]
