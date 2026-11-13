"""Turns a tailored CV into a clean, ATS-friendly Word (.docx) or PDF file.

One column, real text, standard headings: easy for both people and applicant-tracking systems.
"""

import io
import re
from xml.sax.saxutils import escape

import docx
from docx.shared import Pt, RGBColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import ListFlowable, ListItem, Paragraph, SimpleDocTemplate, Spacer

from app.schemas.profile import ProfileDetails
from app.schemas.tailored_cv import TailoredContent

ACCENT = "#1F4E79"


def cv_filename(full_name: str, extension: str, company: str = "", role: str = "") -> str:
    parts = ["CV", full_name or "", company, role]
    raw = " - ".join(p for p in parts if p.strip())
    safe = re.sub(r"[^\w\s.-]", "", raw, flags=re.UNICODE)
    safe = re.sub(r"\s+", " ", safe).strip(" .")[:110] or "CV"
    return f"{safe}.{extension}"


def contact_line(profile: ProfileDetails) -> str:
    items = (
        profile.email,
        profile.phone,
        profile.location,
        profile.linkedin_url,
        profile.github_url,
        profile.portfolio_url,
    )
    return "  |  ".join(item for item in items if item)


def bullets(text: str) -> list[str]:
    return [line.strip().lstrip("-•* ").strip() for line in text.splitlines() if line.strip()]


def _dates(start: str, end: str) -> str:
    return " – ".join(d for d in (start, end) if d)


def _sections(content: TailoredContent):
    """(heading, [(title, right-hand text, subtitle, bullets)]) in CV order."""
    experience = [
        (e.title, _dates(e.start, e.end), e.company, bullets(e.summary)) for e in content.experience
    ]
    projects = [(p.name, "", p.link, bullets(p.summary)) for p in content.projects]
    education = [
        (e.qualification, _dates(e.start, e.end), e.institution, bullets(e.details))
        for e in content.education
    ]
    return [
        ("Experience", experience),
        ("Projects", projects),
        ("Education", education),
    ]


def build_cv_docx(content: TailoredContent, profile: ProfileDetails) -> bytes:
    document = docx.Document()
    normal = document.styles["Normal"]
    normal.font.name = "Calibri"
    normal.font.size = Pt(10.5)
    normal.paragraph_format.space_after = Pt(2)

    name = document.add_paragraph()
    run = name.add_run(profile.full_name or "Your name")
    run.bold, run.font.size = True, Pt(20)
    if contact := contact_line(profile):
        document.add_paragraph(contact).runs[0].font.size = Pt(9.5)

    def heading(text: str) -> None:
        paragraph = document.add_paragraph()
        paragraph.paragraph_format.space_before = Pt(10)
        run = paragraph.add_run(text.upper())
        run.bold, run.font.size = True, Pt(11)
        run.font.color.rgb = RGBColor.from_string(ACCENT.lstrip("#"))

    if content.summary:
        heading("Profile")
        document.add_paragraph(content.summary)
    if content.skills:
        heading("Skills")
        document.add_paragraph(", ".join(content.skills))

    for title, entries in _sections(content):
        if not entries:
            continue
        heading(title)
        for name_text, right, subtitle, points in entries:
            line = document.add_paragraph()
            line.paragraph_format.space_before = Pt(4)
            line.add_run(name_text).bold = True
            if right:
                line.add_run(f"   {right}")
            if subtitle:
                document.add_paragraph(subtitle).runs[0].italic = True
            for point in points:
                document.add_paragraph(point, style="List Bullet")

    buffer = io.BytesIO()
    document.save(buffer)
    return buffer.getvalue()


def build_cv_pdf(content: TailoredContent, profile: ProfileDetails) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=1.8 * cm,
        rightMargin=1.8 * cm,
        topMargin=1.5 * cm,
        bottomMargin=1.5 * cm,
        title=f"CV - {profile.full_name}" if profile.full_name else "CV",
        author=profile.full_name or "",
        creator="CareerPilot",
    )
    body = ParagraphStyle("body", fontName="Helvetica", fontSize=10, leading=13.5, spaceAfter=3)
    name = ParagraphStyle("name", fontName="Helvetica-Bold", fontSize=20, leading=24)
    small = ParagraphStyle("small", parent=body, fontSize=9, textColor="#444444", spaceAfter=6)
    head = ParagraphStyle(
        "head",
        fontName="Helvetica-Bold",
        fontSize=11,
        leading=14,
        textColor=ACCENT,
        spaceBefore=9,
        spaceAfter=3,
    )
    entry = ParagraphStyle("entry", parent=body, fontName="Helvetica-Bold", spaceBefore=4)
    sub = ParagraphStyle("sub", parent=body, fontName="Helvetica-Oblique", textColor="#444444")

    story = [Paragraph(escape(profile.full_name or "Your name"), name)]
    if contact := contact_line(profile):
        story.append(Paragraph(escape(contact), small))
    if content.summary:
        story += [Paragraph("PROFILE", head), Paragraph(escape(content.summary), body)]
    if content.skills:
        story += [Paragraph("SKILLS", head), Paragraph(escape(", ".join(content.skills)), body)]

    for title, entries in _sections(content):
        if not entries:
            continue
        story.append(Paragraph(title.upper(), head))
        for name_text, right, subtitle, points in entries:
            text = f"<b>{escape(name_text)}</b>"
            if right:
                gap = "&nbsp;" * 3
                text += f'<font name="Helvetica" color="#444444">{gap}{escape(right)}</font>'
            story.append(Paragraph(text, entry))
            if subtitle:
                story.append(Paragraph(escape(subtitle), sub))
            if points:
                story.append(
                    ListFlowable(
                        [ListItem(Paragraph(escape(p), body), leftIndent=12) for p in points],
                        bulletType="bullet",
                        start="•",
                        leftIndent=12,
                    )
                )
    story.append(Spacer(1, 2))
    doc.build(story)
    return buffer.getvalue()
