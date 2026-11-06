"""Fake CVs for tests. The person and all details are made up (example.com is reserved)."""

import io

import docx

SAMPLE_CV = """JANE EXAMPLE
Leeds, UK | jane@example.com | +44 7700 900123
linkedin.com/in/jane-example | https://github.com/jane-example

PROFILE
Graduate software developer who enjoys building tidy, well-tested web apps.

TECHNICAL SKILLS
Languages: Python, TypeScript, SQL
Tools: Git, Docker | React

EXPERIENCE
Software Developer Intern at Example Ltd
Jun 2024 - Sep 2024
- Built a FastAPI service used by 3 teams
- Cut page load time by 40%

Teaching Assistant, Example University    Sep 2023 – Present
- Ran weekly Python labs

EDUCATION
BSc Computer Science
Example University
2021 - 2024
First Class Honours

PROJECTS
CareerPilot - https://example.com/careerpilot
Job application assistant using free AI.

INTERESTS
Running, chess
"""


def make_pdf(lines: list[str]) -> bytes:
    """A minimal one-page PDF with real (extractable) text."""

    def escape(line: str) -> str:
        return line.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")

    stream = (
        "BT /F1 11 Tf 72 760 Td 14 TL "
        + " ".join(f"({escape(line)}) Tj T*" for line in lines)
        + " ET"
    )
    objects = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        "/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        f"<< /Length {len(stream)} >>\nstream\n{stream}\nendstream",
    ]
    out = io.BytesIO()
    out.write(b"%PDF-1.4\n")
    offsets = []
    for number, body in enumerate(objects, start=1):
        offsets.append(out.tell())
        out.write(f"{number} 0 obj\n{body}\nendobj\n".encode("latin-1"))
    xref = out.tell()
    out.write(f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode())
    for offset in offsets:
        out.write(f"{offset:010d} 00000 n \n".encode())
    out.write(
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    )
    return out.getvalue()


def make_docx(paragraphs: list[str], table: list[list[str]] | None = None) -> bytes:
    document = docx.Document()
    for paragraph in paragraphs:
        document.add_paragraph(paragraph)
    if table:
        word_table = document.add_table(rows=len(table), cols=len(table[0]))
        for r, row in enumerate(table):
            for c, value in enumerate(row):
                word_table.cell(r, c).text = value
    buffer = io.BytesIO()
    document.save(buffer)
    return buffer.getvalue()
