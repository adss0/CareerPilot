"""Guesses which spreadsheet column holds which application field."""

import re
from dataclasses import dataclass
from difflib import SequenceMatcher

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
URL_RE = re.compile(r"^(https?://|www\.)\S+$", re.IGNORECASE)

MIN_SCORE = 0.75


@dataclass(frozen=True)
class ImportField:
    key: str
    label: str
    required: bool
    synonyms: tuple[str, ...]


# Order matters: earlier fields win ties.
IMPORT_FIELDS: tuple[ImportField, ...] = (
    ImportField(
        "company",
        "Company",
        True,
        ("company", "company name", "employer", "organisation", "organization", "firm"),
    ),
    ImportField(
        "role",
        "Role",
        True,
        ("role", "job title", "title", "position", "job", "vacancy", "job role", "job name"),
    ),
    ImportField(
        "contact_email",
        "Contact email",
        False,
        ("email", "e mail", "contact email", "recruiter email", "email address", "mail"),
    ),
    ImportField(
        "job_url",
        "Job URL",
        False,
        ("url", "link", "job link", "job url", "posting", "application link", "website"),
    ),
    ImportField(
        "contact_name",
        "Contact name",
        False,
        ("contact", "contact name", "recruiter", "hiring manager", "recruiter name"),
    ),
    ImportField(
        "job_description",
        "Job description",
        False,
        ("description", "job description", "details", "jd", "requirements", "job details"),
    ),
    ImportField("location", "Location", False, ("location", "city", "place", "office", "where")),
    ImportField("salary", "Salary", False, ("salary", "pay", "compensation", "wage", "rate")),
    ImportField("notes", "Notes", False, ("notes", "note", "comments", "comment", "remarks")),
)
FIELD_KEYS = tuple(field.key for field in IMPORT_FIELDS)
REQUIRED_KEYS = tuple(field.key for field in IMPORT_FIELDS if field.required)


def normalize(text: str) -> str:
    return " ".join(re.sub(r"[^a-z0-9]+", " ", text.casefold()).split())


def header_score(header: str, synonyms: tuple[str, ...]) -> float:
    name = normalize(header)
    if not name:
        return 0.0
    best = 0.0
    for synonym in synonyms:
        if name == synonym:
            return 1.0
        if re.search(rf"\b{re.escape(synonym)}\b", name):
            # "Company name (required)" contains "company name": the more it covers, the better.
            best = max(best, 0.6 + 0.35 * len(synonym) / len(name))
        else:
            best = max(best, SequenceMatcher(None, name, synonym).ratio())  # typos: "Compnay"
    return best


def suggest_mapping(headers: list[str], sample_rows: list[list[str]]) -> dict[str, str | None]:
    candidates = [
        (header_score(header, field.synonyms), order, field.key, header)
        for order, field in enumerate(IMPORT_FIELDS)
        for header in headers
    ]
    candidates.sort(key=lambda c: (-c[0], c[1]))

    mapping: dict[str, str | None] = dict.fromkeys(FIELD_KEYS)
    used: set[str] = set()
    for score, _order, key, header in candidates:
        if score < MIN_SCORE:
            break
        if mapping[key] is None and header not in used:
            mapping[key] = header
            used.add(header)

    # No matching header? Look at the values instead.
    for key, pattern in (("contact_email", EMAIL_RE), ("job_url", URL_RE)):
        if mapping[key] is None:
            header = _column_matching(headers, sample_rows, pattern, used)
            if header:
                mapping[key] = header
                used.add(header)
    return mapping


def _column_matching(
    headers: list[str], rows: list[list[str]], pattern: re.Pattern, used: set[str]
) -> str | None:
    for index, header in enumerate(headers):
        if header in used:
            continue
        values = [row[index] for row in rows if row[index]]
        if values and sum(bool(pattern.match(v)) for v in values) / len(values) >= 0.6:
            return header
    return None
