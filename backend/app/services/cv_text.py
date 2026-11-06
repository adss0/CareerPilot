"""Pulls plain text out of a CV file (.pdf, .docx or .txt)."""

import io
import re
import zipfile

import docx
from docx.opc.exceptions import PackageNotFoundError
from pypdf import PdfReader
from pypdf.errors import PyPdfError

MAX_CV_BYTES = 5 * 1024 * 1024
MAX_PDF_PAGES = 30
MAX_TEXT_CHARS = 100_000

CV_TYPES = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".txt": "text/plain",
}


class CvReadError(ValueError):
    """The CV can't be read; the message is shown to the user."""


def cv_extension(filename: str) -> str | None:
    lower = filename.lower()
    return next((ext for ext in CV_TYPES if lower.endswith(ext)), None)


def extract_text(filename: str, content: bytes) -> str:
    extension = cv_extension(filename)
    if extension == ".pdf":
        text = _pdf_text(content)
    elif extension == ".docx":
        text = _docx_text(content)
    elif extension == ".txt":
        text = _decode(content)
    else:
        raise CvReadError("Unsupported file type. Upload a .pdf, .docx or .txt file.")
    return clean_text(text)[:MAX_TEXT_CHARS]


def clean_text(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n").replace(" ", " ")
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in text.split("\n")]
    return re.sub(r"\n{3,}", "\n\n", "\n".join(lines)).strip()


def _pdf_text(content: bytes) -> str:
    try:
        reader = PdfReader(io.BytesIO(content))
        if reader.is_encrypted and not reader.decrypt(""):
            raise CvReadError("This PDF is password-protected. Remove the password and try again.")
        if len(reader.pages) > MAX_PDF_PAGES:
            raise CvReadError(f"This PDF has more than {MAX_PDF_PAGES} pages. Is it really a CV?")
        return "\n\n".join(page.extract_text() or "" for page in reader.pages)
    except CvReadError:
        raise
    except (PyPdfError, ValueError, KeyError, TypeError, OSError) as exc:
        raise CvReadError("This file couldn't be read as a PDF.") from exc


def _docx_text(content: bytes) -> str:
    try:
        document = docx.Document(io.BytesIO(content))
    except (PackageNotFoundError, zipfile.BadZipFile, KeyError, ValueError) as exc:
        raise CvReadError("This file couldn't be read as a Word (.docx) document.") from exc

    parts = [paragraph.text for paragraph in document.paragraphs]
    # Many CV templates put everything in tables.
    for table in document.tables:
        for row in table.rows:
            seen: set[int] = set()
            for cell in row.cells:
                if id(cell._tc) not in seen:  # merged cells repeat
                    seen.add(id(cell._tc))
                    parts.append(cell.text)
    return "\n".join(parts)


def _decode(content: bytes) -> str:
    for encoding in ("utf-8-sig", "cp1252"):
        try:
            return content.decode(encoding)
        except UnicodeDecodeError:
            continue
    return content.decode("latin-1")
