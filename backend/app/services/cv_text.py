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


# Some PDF fonts (e.g. the small capitals in LaTeX CV templates) have no Unicode mapping, so
# the PDF reader returns glyph names instead of letters: "U/n.sc/i.sc" for "Uni".
GLYPH_RE = re.compile(r"/([A-Za-z]+(?:_[A-Za-z]+)*)\.(?:sc|alt|ss\d\d|osf|lf|tf|swash)\b")
GLYPH_NAMES = {
    "space": " ", "period": ".", "comma": ",", "hyphen": "-", "endash": "–", "emdash": "—",
    "ampersand": "&", "colon": ":", "semicolon": ";", "slash": "/", "parenleft": "(",
    "parenright": ")", "quoteright": "'", "quoteleft": "'", "apostrophe": "'", "at": "@",
    "plus": "+", "numbersign": "#", "percent": "%", "exclam": "!", "question": "?",
    "zero": "0", "one": "1", "two": "2", "three": "3", "four": "4", "five": "5", "six": "6",
    "seven": "7", "eight": "8", "nine": "9",
    "ff": "ff", "fi": "fi", "fl": "fl", "ffi": "ffi", "ffl": "ffl",
}  # fmt: skip


def _glyph(match: re.Match) -> str:
    name = match.group(1)
    if len(name) == 1:
        return name  # "/n.sc" is a small-capital "n"
    if name in GLYPH_NAMES:
        return GLYPH_NAMES[name]
    if "_" in name and all(len(part) == 1 for part in name.split("_")):
        return name.replace("_", "")  # ligature such as "/f_i.sc"
    return match.group(0)


LIGATURES = {"ﬀ": "ff", "ﬁ": "fi", "ﬂ": "fl", "ﬃ": "ffi", "ﬄ": "ffl", "ﬅ": "st", "ﬆ": "st"}
# Wide kerning after these capitals can split a word: "Y ear", "T echnology". "A" and "I" are
# real one-letter words, so they're never joined.
# Also inside a word ("T ypeScript") and between capitals ("JP A" for "JPA").
KERNING_SPLIT_RE = re.compile(r"\b([FPTVWY]) ([a-z]{2,})")
KERNING_CAPS_RE = re.compile(r"\b([A-Z]{0,4}[PTVWY]) ([A-Z])(?=[\s,;|.)]|$)")


def fix_glyph_names(text: str) -> str:
    text = GLYPH_RE.sub(_glyph, text)
    for ligature, letters in LIGATURES.items():
        text = text.replace(ligature, letters)
    text = KERNING_SPLIT_RE.sub(r"\1\2", text)
    return KERNING_CAPS_RE.sub(r"\1\2", text)


def clean_text(text: str) -> str:
    text = fix_glyph_names(text)
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
