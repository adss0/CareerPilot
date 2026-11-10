"""Turns a cover letter into a Word (.docx) or PDF file ready to attach."""

import io
import re
from datetime import date
from xml.sax.saxutils import escape

import docx
from docx.shared import Pt
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

from app.schemas.profile import ProfileDetails

DOCX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
PDF_MEDIA_TYPE = "application/pdf"


def letter_filename(company: str, role: str, extension: str) -> str:
    raw = f"Cover letter - {company} - {role}"
    safe = re.sub(r"[^\w\s.-]", "", raw, flags=re.UNICODE)
    safe = re.sub(r"\s+", " ", safe).strip(" .")[:90] or "Cover letter"
    return f"{safe}.{extension}"


def _contact_line(profile: ProfileDetails) -> str:
    return "  ·  ".join(p for p in (profile.email, profile.phone, profile.location) if p)


def _paragraphs(text: str) -> list[list[str]]:
    """Paragraphs split on blank lines; each keeps its own line breaks (e.g. the sign-off)."""
    blocks = re.split(r"\n\s*\n", text.strip())
    return [[line.rstrip() for line in block.splitlines()] for block in blocks if block.strip()]


def _today() -> str:
    today = date.today()
    return f"{today.day} {today:%B %Y}"


def build_docx(letter: str, profile: ProfileDetails) -> bytes:
    document = docx.Document()
    style = document.styles["Normal"]
    style.font.name = "Calibri"
    style.font.size = Pt(11)

    if profile.full_name:
        heading = document.add_paragraph()
        run = heading.add_run(profile.full_name)
        run.bold = True
        run.font.size = Pt(16)
    if contact := _contact_line(profile):
        document.add_paragraph(contact)
    document.add_paragraph(_today())

    for lines in _paragraphs(letter):
        paragraph = document.add_paragraph()
        for index, line in enumerate(lines):
            if index:
                paragraph.add_run().add_break()
            paragraph.add_run(line)

    buffer = io.BytesIO()
    document.save(buffer)
    return buffer.getvalue()


def build_pdf(letter: str, profile: ProfileDetails) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=2.2 * cm,
        rightMargin=2.2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
        title="Cover letter",
        author=profile.full_name or "",
        creator="CareerPilot",
    )
    body = ParagraphStyle("body", fontName="Helvetica", fontSize=11, leading=15, spaceAfter=10)
    name = ParagraphStyle("name", fontName="Helvetica-Bold", fontSize=16, leading=20, spaceAfter=2)
    small = ParagraphStyle("small", parent=body, fontSize=10, textColor="#555555", spaceAfter=14)

    story = []
    if profile.full_name:
        story.append(Paragraph(escape(profile.full_name), name))
    if contact := _contact_line(profile):
        story.append(Paragraph(escape(contact), small))
    story.append(Paragraph(_today(), body))
    story.append(Spacer(1, 4))
    for lines in _paragraphs(letter):
        story.append(Paragraph("<br/>".join(escape(line) for line in lines), body))

    doc.build(story)
    return buffer.getvalue()
