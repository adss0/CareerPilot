"""CV layouts seen in real graduate CVs (all names and details here are made up)."""

from app.services.cv_parser import parse_cv
from app.services.cv_text import clean_text, fix_glyph_names


def test_small_capitals_from_latex_fonts_become_letters():
    # What a PDF reader returns for a small-caps heading font without a Unicode mapping.
    raw = (
        "J/u.sc/n.sc/i.sc/o.sc/r.sc D/e.sc/v.sc/e.sc/l.sc/o.sc/p.sc/e.sc/r.sc"
        " | E/x.sc/a.sc/m.sc/p.sc/l.sc/e.sc Ltd"
    )
    assert fix_glyph_names(raw) == "Junior Developer | Example Ltd"
    assert fix_glyph_names("/f_i.sc/period.sc /zero.sc/one.sc") == "fi. 01"
    assert fix_glyph_names("/unknownglyph.sc") == "/unknownglyph.sc"  # left alone


def test_ligatures_and_kerning_gaps_are_joined():
    assert clean_text("Placement Y ear, ﬁnance and T echnology") == (
        "Placement Year, finance and Technology"
    )
    # Real one-letter words are never glued to the next word.
    assert clean_text("A team I led") == "A team I led"


GRAD_CV = """Jane Example
jane@example.com | +44 7700 900123

Education
Example University September 2023 - June 2027
BSc Computer Science (with Placement Year) | Expected - First Class
Example College September 2021 - June 2023
A-Levels | Maths - A, Physics - B

Experience
Software Developer Intern | Example Ltd September 2025 - Present
• Built internal tools in C#

Projects
Shop App (Coursework) Java, Spring Boot, JPA
• Built a REST API for a shop
• Used JPA for the database layer, keeping the
code clean and scalable.
Event Finder (Personal) JavaScript, Node.js, .Net
• A full-stack web app for local events

Extra-curricular Activities and Leadership
• Treasurer of the Example Society
"""


def test_graduate_cv_layout():
    profile = parse_cv(clean_text(GRAD_CV))

    assert [(e.qualification, e.institution) for e in profile.education] == [
        ("BSc Computer Science (with Placement Year)", "Example University"),
        ("A-Levels", "Example College"),
    ]
    assert profile.education[0].details == "Expected - First Class"

    # Projects without dates are still split, and the extra-curricular section isn't one.
    assert [p.name for p in profile.projects] == [
        "Shop App (Coursework)",
        "Event Finder (Personal)",
    ]
    assert profile.projects[0].summary.startswith(
        "Tech: Java, Spring Boot, JPA\n- Built a REST API"
    )
    assert "code clean and scalable." in profile.projects[0].summary  # wrapped bullet kept

    # No skills section: the tech listed on the projects is used.
    assert profile.skills == ["Java", "Spring Boot", "JPA", "JavaScript", "Node.js", ".Net"]
    assert profile.experience[0].company == "Example Ltd"
