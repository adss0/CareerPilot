"""Turns a tailored CV into a one-page, ATS-friendly PDF (and a Word file).

The PDF follows the well-known "Jake's Resume" layout: a centred name and contact line, ruled
section headings, each entry's name on the left with its dates on the right, tight bullet
points. One column and real text, so both people and applicant-tracking systems can read it.

Two things vary: the order of the sections (Jake's own, or the order of the user's main CV)
and the text size, which shrinks a little when that's what it takes to fit one page.
"""

import io
import re
from dataclasses import dataclass
from xml.sax.saxutils import escape

import docx
from docx.shared import Pt, RGBColor
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import (
    HRFlowable,
    Paragraph,
    SimpleDocTemplate,
    Table,
    TableStyle,
)

from app.schemas.profile import ProfileDetails
from app.schemas.tailored_cv import TailoredContent

ACCENT = "#1F4E79"
SECTIONS = ("summary", "education", "experience", "projects", "skills")
JAKE_ORDER = ("education", "experience", "projects", "skills")
TITLES = {
    "summary": "Profile",
    "education": "Education",
    "experience": "Experience",
    "projects": "Projects",
    "skills": "Technical Skills",
}
# How a CV's own headings are recognised, to follow its section order.
HEADINGS = {
    "summary": r"(personal )?(profile|summary|statement)|about( me)?|objective",
    "education": r"education( (and|&) qualifications)?|qualifications|academic background",
    "experience": r"((work|professional|relevant|employment) )?(experience|history)|employment",
    "projects": r"((personal|academic|technical|key|selected) )?projects",
    "skills": r"((technical|key|core|it) )?skills( (and|&) \w+)?|technologies",
}
# Text sizes tried in turn until the CV fits one page: (scale, page margin in cm).
FITS = ((1.0, 1.3), (0.95, 1.2), (0.9, 1.1), (0.86, 1.0), (0.82, 0.9))


@dataclass(frozen=True)
class CvLayout:
    """Which sections appear, and in what order."""

    style: str = "jake"
    order: tuple[str, ...] = JAKE_ORDER


def section_order(cv_text: str) -> tuple[str, ...]:
    """The order of the sections in an uploaded CV, read from its headings."""
    found: list[str] = []
    for line in cv_text.splitlines():
        heading = re.sub(r"[^a-z& ]", "", line.lower()).strip()
        if not heading or len(heading.split()) > 4:
            continue
        for key, pattern in HEADINGS.items():
            if key not in found and re.fullmatch(pattern, heading):
                found.append(key)
    return tuple(found)


def layout_for(style: str, main_cv_text: str = "") -> CvLayout:
    """ "own" follows the main CV's section order; without one it's Jake's Resume."""
    order = section_order(main_cv_text) if style == "own" else ()
    if len(order) < 2:
        return CvLayout()
    # Sections the CV doesn't have a heading for still appear (except a profile paragraph).
    rest = tuple(key for key in JAKE_ORDER if key not in order)
    return CvLayout(style="own", order=order + rest)


def cv_filename(full_name: str, extension: str, company: str = "", role: str = "") -> str:
    parts = ["CV", full_name or "", company, role]
    raw = " - ".join(p for p in parts if p.strip())
    safe = re.sub(r"[^\w\s.-]", "", raw, flags=re.UNICODE)
    safe = re.sub(r"\s+", " ", safe).strip(" .")[:110] or "CV"
    return f"{safe}.{extension}"


def contact_line(profile: ProfileDetails) -> str:
    items = (
        profile.phone,
        profile.email,
        profile.location,
        profile.linkedin_url,
        profile.github_url,
        profile.portfolio_url,
    )
    return "  |  ".join(re.sub(r"^https?://(www\.)?", "", item) for item in items if item)


def bullets(text: str) -> list[str]:
    return [line.strip().lstrip("-•* ").strip() for line in text.splitlines() if line.strip()]


def _dates(start: str, end: str) -> str:
    return " – ".join(d for d in (start, end) if d)


def _entries(content: TailoredContent, section: str):
    """(name, right-hand text, line underneath, bullets) for each entry of a section."""
    if section == "experience":
        return [
            (
                e.company or e.title,
                _dates(e.start, e.end),
                e.title if e.company else "",
                bullets(e.summary),
            )
            for e in content.experience
        ]
    if section == "projects":
        return [(p.name, "", p.link, bullets(p.summary)) for p in content.projects]
    return [
        (
            e.institution or e.qualification,
            _dates(e.start, e.end),
            e.qualification if e.institution else "",
            bullets(e.details),
        )
        for e in content.education
    ]


def _has(content: TailoredContent, section: str) -> bool:
    return bool(getattr(content, section))


# ---------- PDF ----------


def _story(content: TailoredContent, profile: ProfileDetails, layout: CvLayout, scale: float):
    def size(points: float) -> float:
        return round(points * scale, 2)

    font, bold, italic = "Times-Roman", "Times-Bold", "Times-Italic"
    body = ParagraphStyle("body", fontName=font, fontSize=size(10.5), leading=size(12.6))
    name = ParagraphStyle(
        "name", fontName=bold, fontSize=size(23), leading=size(27), alignment=TA_CENTER
    )
    contact = ParagraphStyle("contact", parent=body, alignment=TA_CENTER, spaceAfter=size(2))
    head = ParagraphStyle(
        "head", fontName=font, fontSize=size(12.5), leading=size(15), spaceBefore=size(7)
    )
    left = ParagraphStyle("left", parent=body, fontName=bold)
    right = ParagraphStyle("right", parent=body, alignment=TA_RIGHT)
    sub = ParagraphStyle("sub", parent=body, fontName=italic, fontSize=size(10))
    point = ParagraphStyle(
        "point",
        parent=body,
        fontSize=size(10),
        leading=size(12),
        leftIndent=size(20),
        firstLineIndent=-size(9),
    )

    story: list = [Paragraph(escape(profile.full_name or "Your name"), name)]
    if line := contact_line(profile):
        story.append(Paragraph(escape(line), contact))

    def heading(key: str) -> None:
        story.append(Paragraph(TITLES[key].upper(), head))
        story.append(HRFlowable(width="100%", thickness=0.6, color="#000000", spaceAfter=size(3)))

    for key in layout.order:
        if not _has(content, key):
            continue
        heading(key)
        if key == "summary":
            story.append(Paragraph(escape(content.summary), body))
            continue
        if key == "skills":
            story.append(Paragraph(f"<b>Skills:</b> {escape(', '.join(content.skills))}", body))
            continue
        for title, dates, under, points in _entries(content, key):
            row = Table(
                [[Paragraph(escape(title), left), Paragraph(escape(dates), right)]],
                colWidths=["72%", "28%"],
            )
            row.setStyle(
                TableStyle(
                    [
                        ("LEFTPADDING", (0, 0), (-1, -1), 0),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                        ("TOPPADDING", (0, 0), (-1, -1), size(2.5)),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ]
                )
            )
            story.append(row)
            if under:
                story.append(Paragraph(escape(under), sub))
            # A middle dot: the PDF fonts' own bullet reads back as a control character in
            # some PDF readers (and so in some applicant-tracking systems).
            story += [Paragraph(f"<b>·</b>&nbsp;&nbsp;{escape(p)}", point) for p in points]
    return story


def _build(
    content: TailoredContent, profile: ProfileDetails, layout: CvLayout, scale: float, margin: float
) -> tuple[bytes, int]:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=margin * cm,
        rightMargin=margin * cm,
        topMargin=margin * cm,
        bottomMargin=margin * cm,
        title=f"CV - {profile.full_name}" if profile.full_name else "CV",
        author=profile.full_name or "",
        creator="CareerPilot",
    )
    doc.build(_story(content, profile, layout, scale))
    return buffer.getvalue(), doc.page


def render_cv(
    content: TailoredContent, profile: ProfileDetails, layout: CvLayout | None = None
) -> tuple[bytes, int]:
    """The PDF and its page count, at the largest text size that fits one page."""
    layout = layout or CvLayout()
    for scale, margin in FITS:
        pdf, pages = _build(content, profile, layout, scale, margin)
        if pages == 1:
            break
    return pdf, pages


def build_cv_pdf(
    content: TailoredContent, profile: ProfileDetails, layout: CvLayout | None = None
) -> bytes:
    return render_cv(content, profile, layout)[0]


def fit_one_page(
    content: TailoredContent, profile: ProfileDetails, layout: CvLayout | None = None
) -> tuple[TailoredContent, int]:
    """Trims a freshly tailored CV until it fits one page. Returns it and what was cut.

    The AI orders everything most relevant first, so cuts come from the end: the last bullet
    of the longest entry, and once every entry is down to two bullets, the last project.
    """
    content = content.model_copy(deep=True)
    cuts = 0
    while render_cv(content, profile, layout)[1] > 1 and cuts < 60:
        entries = [(e, "summary") for e in content.experience + content.projects]
        entries += [(e, "details") for e in content.education]
        item, field = max(entries, key=lambda pair: len(bullets(getattr(pair[0], pair[1]))))
        lines = bullets(getattr(item, field))
        if len(lines) > 2:
            setattr(item, field, "\n".join(lines[:-1]))
        elif len(content.projects) > 1:
            content.projects.pop()
        elif len(content.experience) > 1:
            content.experience.pop()
        elif len(lines) > 1:
            setattr(item, field, "\n".join(lines[:-1]))
        else:
            break
        cuts += 1
    return content, cuts


# ---------- Word ----------


def build_cv_docx(
    content: TailoredContent, profile: ProfileDetails, layout: CvLayout | None = None
) -> bytes:
    layout = layout or CvLayout()
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

    for key in layout.order:
        if not _has(content, key):
            continue
        paragraph = document.add_paragraph()
        paragraph.paragraph_format.space_before = Pt(10)
        run = paragraph.add_run(TITLES[key].upper())
        run.bold, run.font.size = True, Pt(11)
        run.font.color.rgb = RGBColor.from_string(ACCENT.lstrip("#"))
        if key == "summary":
            document.add_paragraph(content.summary)
            continue
        if key == "skills":
            document.add_paragraph(", ".join(content.skills))
            continue
        for title, dates, under, points in _entries(content, key):
            line = document.add_paragraph()
            line.paragraph_format.space_before = Pt(4)
            line.add_run(title).bold = True
            if dates:
                line.add_run(f"   {dates}")
            if under:
                document.add_paragraph(under).runs[0].italic = True
            for item in points:
                document.add_paragraph(item, style="List Bullet")

    buffer = io.BytesIO()
    document.save(buffer)
    return buffer.getvalue()
