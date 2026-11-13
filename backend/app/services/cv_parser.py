"""Basic, offline CV reader: finds contact details and common sections with simple rules.

It works without any AI. Results are a starting point that the user reviews and edits.
"""

import re
from typing import Any

from annotated_types import MaxLen
from pydantic import BaseModel

from app.schemas.profile import EducationItem, ExperienceItem, ProfileDetails, ProjectItem

EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")
PHONE_RE = re.compile(r"(?<![\w/])\+?\d[\d ()-]{7,}\d(?![\w/])")
URL_RE = re.compile(
    r"(?:https?://|www\.)[^\s,;|<>()]+|(?:linkedin\.com|github\.com)/[^\s,;|<>()]+", re.IGNORECASE
)
BULLET_RE = re.compile(r"^[\-*•▪●◦‣·–]\s*")
MONTH = r"(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?"
DATE = rf"(?:{MONTH}\s+\d{{4}}|\d{{1,2}}/\d{{4}}|\d{{4}})"
DATE_RANGE_RE = re.compile(
    rf"\(?({DATE})\s*(?:-|–|—|to|until)\s*({DATE}|present|current|now|today|date)\)?",
    re.IGNORECASE,
)

SECTIONS: dict[str, tuple[str, ...]] = {
    "summary": (
        "summary", "profile", "professional summary", "personal statement", "about me",
        "about", "objective", "career objective", "personal profile", "professional profile",
    ),
    "skills": (
        "skills", "technical skills", "key skills", "core skills", "core competencies",
        "competencies", "technologies", "tech stack", "tools", "skills and tools",
        "skills & tools", "technical expertise",
    ),
    "experience": (
        "experience", "work experience", "employment", "employment history",
        "professional experience", "work history", "career history", "relevant experience",
    ),
    "education": (
        "education", "qualifications", "education and qualifications",
        "education & qualifications", "academic background", "academic qualifications",
    ),
    "projects": ("projects", "personal projects", "key projects", "selected projects"),
    "other": (
        "certifications", "certificates", "interests", "hobbies", "references", "awards",
        "achievements", "languages", "volunteering", "publications", "hobbies and interests",
        "extracurricular activities", "extracurricular activities and leadership",
        "activities", "leadership", "activities and leadership", "leadership and activities",
        "additional information", "volunteering and leadership",
    ),
}  # fmt: skip
HEADING_LOOKUP = {alias: key for key, aliases in SECTIONS.items() for alias in aliases}


def parse_cv(text: str) -> ProfileDetails:
    lines = text.split("\n")
    header, sections = _split_sections(lines)
    header_text = "\n".join(header)

    details: dict[str, Any] = {
        "full_name": _find_name(header),
        "email": _first(EMAIL_RE, header_text) or _first(EMAIL_RE, text),
        "phone": _clean_phone(_first(PHONE_RE, header_text) or _first(PHONE_RE, text)),
        "location": _find_location(header),
        "summary": " ".join(sections.get("summary", [])).strip(),
        "skills": _parse_skills(sections.get("skills", [])),
        "experience": [_experience(b) for b in _entries(sections.get("experience", []))],
        "education": [_education(b) for b in _entries(sections.get("education", []))],
        "projects": [_project(b) for b in _project_entries(sections.get("projects", []))],
    }
    # No skills section? Use the tech listed on the projects (a common grad CV layout).
    project_tech = [t for p in details["projects"] for t in p.pop("_tech")]
    if not details["skills"]:
        details["skills"] = _dedupe(project_tech)[:60]
    for url in URL_RE.findall(text):
        normalized = url if url.lower().startswith("http") else f"https://{url}"
        lower = normalized.lower()
        if "linkedin.com" in lower:
            details.setdefault("linkedin_url", normalized)
        elif "github.com" in lower:
            details.setdefault("github_url", normalized)
        else:
            details.setdefault("portfolio_url", normalized)
    return details_from_dict(details)


def details_from_dict(raw: dict[str, Any]) -> ProfileDetails:
    """Builds ProfileDetails from loose data (e.g. AI output), trimming anything too long."""
    values: dict[str, Any] = {}
    for name, field in ProfileDetails.model_fields.items():
        value = raw.get(name)
        if name == "skills":
            items = value if isinstance(value, list) else []
            values[name] = _dedupe([_cut(str(s), 60) for s in items if str(s).strip()])[:100]
        elif name in ("experience", "education", "projects"):
            model = {"experience": ExperienceItem, "education": EducationItem}.get(
                name, ProjectItem
            )
            items = value if isinstance(value, list) else []
            limit = _max_len(field.metadata) or 30
            values[name] = [_clamp_model(model, item) for item in items if isinstance(item, dict)][
                :limit
            ]
        else:
            values[name] = _cut(str(value or ""), _max_len(field.metadata))
    return ProfileDetails(**values)


def _clamp_model(model: type[BaseModel], item: dict) -> BaseModel:
    return model(
        **{
            name: _cut(str(item.get(name) or ""), _max_len(field.metadata))
            for name, field in model.model_fields.items()
        }
    )


def _max_len(metadata: list) -> int | None:
    return next((m.max_length for m in metadata if isinstance(m, MaxLen)), None)


def _cut(value: str, limit: int | None) -> str:
    value = value.strip()
    return value[:limit] if limit else value


def _first(pattern: re.Pattern, text: str) -> str:
    match = pattern.search(text)
    return match.group(0) if match else ""


def _clean_phone(phone: str) -> str:
    digits = re.sub(r"\D", "", phone)
    return phone.strip() if 9 <= len(digits) <= 15 else ""


def _heading(line: str) -> str | None:
    if not line or len(line) > 50:
        return None
    normalized = re.sub(r"[^a-z& ]", "", line.lower()).strip()
    return HEADING_LOOKUP.get(" ".join(normalized.split()))


def _split_sections(lines: list[str]) -> tuple[list[str], dict[str, list[str]]]:
    header: list[str] = []
    sections: dict[str, list[str]] = {}
    current: list[str] = header
    for line in lines:
        key = _heading(line)
        if key:
            current = sections.setdefault(key, [])
        else:
            current.append(line)
    return header, sections


def _segments(header: list[str]) -> list[str]:
    parts: list[str] = []
    for line in header:
        parts.extend(p.strip() for p in re.split(r"\s[|•·]\s|\s{2,}|\t", line) if p.strip())
    return parts


def _is_contact(segment: str) -> bool:
    return bool(EMAIL_RE.search(segment) or URL_RE.search(segment) or PHONE_RE.search(segment))


def _find_name(header: list[str]) -> str:
    for segment in _segments(header)[:6]:
        if _is_contact(segment) or any(ch.isdigit() for ch in segment):
            continue
        words = segment.split()
        if 2 <= len(words) <= 5 and all(re.fullmatch(r"[A-Za-zÀ-ÿ'’.-]+", w) for w in words):
            return segment.title() if segment.isupper() else segment
    return ""


def _find_location(header: list[str]) -> str:
    for segment in _segments(header):
        if "," in segment and not _is_contact(segment) and len(segment) <= 60:
            if not any(ch.isdigit() for ch in segment):
                return segment
    return ""


def _parse_skills(lines: list[str]) -> list[str]:
    skills: list[str] = []
    for line in lines:
        line = BULLET_RE.sub("", line)
        if ":" in line and len(line.split(":", 1)[0]) <= 30:
            line = line.split(":", 1)[1]  # "Languages: Python, SQL" → "Python, SQL"
        for item in re.split(r"[,;|•·/]|\s{2,}", line):
            item = item.strip(" .")
            if 1 <= len(item) <= 40:
                skills.append(item)
    return _dedupe(skills)[:60]


def _dedupe(items: list[str]) -> list[str]:
    seen: set[str] = set()
    result = []
    for item in items:
        if item.casefold() not in seen:
            seen.add(item.casefold())
            result.append(item)
    return result


def _entries(lines: list[str]) -> list[list[str]]:
    """Splits a section into entries: by blank lines, or where a new dated line starts."""
    blocks: list[list[str]] = []
    current: list[str] = []
    current_has_date = False
    for line in lines:
        if not line:
            if current:
                blocks.append(current)
            current, current_has_date = [], False
            continue
        dated = bool(DATE_RANGE_RE.search(line)) and not BULLET_RE.match(line)
        if dated and current_has_date:
            blocks.append(current)
            current, current_has_date = [], False
        current.append(line)
        current_has_date = current_has_date or dated
    if current:
        blocks.append(current)
    return blocks[:30]


def _dates(block: list[str]) -> tuple[str, str, list[str]]:
    for index, line in enumerate(block):
        match = DATE_RANGE_RE.search(line)
        if match:
            rest = (line[: match.start()] + line[match.end() :]).strip(" ,|–—-")
            new_block = block[:index] + ([rest] if rest else []) + block[index + 1 :]
            end = match.group(2)
            return match.group(1), end.capitalize() if end.isalpha() else end, new_block
    return "", "", block


def _split_title(line: str) -> tuple[str, str]:
    for separator in (" at ", " | ", " – ", " — ", " - ", ", "):
        if separator in line:
            first, second = line.split(separator, 1)
            return first.strip(), second.strip()
    return line.strip(), ""


def _body(lines: list[str]) -> str:
    return "\n".join(
        f"- {BULLET_RE.sub('', line)}" if BULLET_RE.match(line) else line for line in lines
    )


def _head_and_rest(block: list[str]) -> tuple[str, str, list[str]]:
    """First line (split in two), plus a short second line used when the first had no split."""
    head = block[0] if block else ""
    first, second = _split_title(BULLET_RE.sub("", head))
    rest = block[1:]
    if not second and rest and not BULLET_RE.match(rest[0]) and len(rest[0]) <= 80:
        second, rest = rest[0], rest[1:]
    return first, second, rest


def _experience(block: list[str]) -> dict:
    start, end, block = _dates(block)
    title, company, rest = _head_and_rest(block)
    return {"title": title, "company": company, "start": start, "end": end, "summary": _body(rest)}


INSTITUTION_RE = re.compile(
    r"\b(university|college|school|institute|academy|polytechnic|sixth form|into)\b", re.I
)


def _education(block: list[str]) -> dict:
    start, end, block = _dates(block)
    head = BULLET_RE.sub("", block[0]).strip() if block else ""
    if (
        len(block) > 1
        and INSTITUTION_RE.search(head)
        and _split_title(head)[1] == ""
        and not BULLET_RE.match(block[1])
    ):
        # "Example University" then "BSc Computer Science | First Class": the institution
        # comes first, so the next line holds the qualification.
        degree, _, more = block[1].partition(" | ")
        institution, qualification = head, degree.strip()
        rest = ([more.strip()] if more.strip() else []) + block[2:]
    else:
        qualification, institution, rest = _head_and_rest(block)
    return {
        "qualification": qualification,
        "institution": institution,
        "start": start,
        "end": end,
        "details": _body(rest),
    }


def _project_entries(lines: list[str]) -> list[list[str]]:
    """Projects rarely have dates, so a new project also starts at a heading line that comes
    after bullet points ("E-Commerce App (Coursework) Java, Spring Boot" after "• Built …").
    A line starting in lower case is a bullet that wrapped onto the next line."""
    blocks: list[list[str]] = []
    for block in _entries(lines):
        current: list[str] = []
        seen_bullet = False
        for line in block:
            heading = not BULLET_RE.match(line) and line[:1].isupper()
            if heading and seen_bullet and current:
                blocks.append(current)
                current, seen_bullet = [], False
            current.append(line)
            seen_bullet = seen_bullet or bool(BULLET_RE.match(line))
        if current:
            blocks.append(current)
    return blocks[:30]


# "Shop App (Example Ltd) C#, .Net, WPF" → name, then the tech used.
PROJECT_TECH_RE = re.compile(r"^(?P<name>.+\))\s+(?P<tech>[^()]+,[^()]+)$")


def _project_tech(head: str) -> tuple[str, list[str]]:
    match = PROJECT_TECH_RE.match(head)
    if not match:
        return head, []
    tech = [t.strip().rstrip(".") for t in match.group("tech").split(",")]
    return match.group("name").strip(), [t for t in tech if 1 <= len(t) <= 40]


def _project(block: list[str]) -> dict:
    _, _, block = _dates(block)
    text = "\n".join(block)
    link = _first(URL_RE, text)
    name = BULLET_RE.sub("", block[0]).strip() if block else ""
    if link and link in name:
        name = name.replace(link, "").strip(" -–|:")
    name, tech = _project_tech(name)
    summary = _body(block[1:])
    if tech:
        summary = f"Tech: {', '.join(tech)}\n{summary}".strip()
    return {"name": name, "summary": summary, "link": link, "_tech": tech}
