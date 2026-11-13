"""Checks a tailored CV the way applicant-tracking systems (ATS) read it.

No AI: every check is a plain rule, so it's instant, free and the same every time.
- Readable: the real PDF is read back as text, like an ATS does; name, contact details and
  every section heading must come out as text.
- Keywords: the job's skills and terms that the CV contains. Missing ones are split into
  "in your profile" (add them) and "not in your profile" (never add what isn't true).
- Contact details, standard sections, length, bullet points, measurable results and dates.
"""

import io
import re

from pypdf import PdfReader

from app.models import Application
from app.schemas.ats import AtsCheck, AtsReport
from app.schemas.profile import ProfileDetails
from app.schemas.tailored_cv import TailoredContent
from app.services.cv_export import build_cv_pdf, bullets, contact_line

# Common skills and terms in graduate job ads, matched as whole terms (case-insensitive).
# Ordinary English words ("go", "express", "swift") are left out: they'd match any sentence.
KNOWN_TERMS = {
    "python", "java", "javascript", "typescript", "c#", "c++", "golang", "rust", "kotlin",
    "php", "scala", "sql", "nosql", "html", "css", "react", "angular", "vue", "node.js",
    "django", "flask", "fastapi", "spring boot", ".net", "asp.net", "wpf", "linux", "bash",
    "powershell", "git", "github", "gitlab", "docker", "kubernetes", "terraform", "aws", "azure",
    "gcp", "google cloud", "devops", "ci/cd", "jenkins", "github actions", "rest apis", "api",
    "apis", "graphql", "microservices", "mongodb", "postgresql", "mysql", "sqlite", "redis",
    "kafka", "hadoop", "pandas", "numpy", "tableau", "power bi", "excel", "machine learning",
    "deep learning", "data analysis", "data science", "statistics", "agile", "scrum", "jira",
    "unit testing", "tdd", "selenium", "xunit", "junit", "pytest", "cyber security",
    "networking", "oop", "object-oriented", "design patterns", "algorithms", "data structures",
    "android", "ios", "front-end", "frontend", "back-end", "backend", "full-stack", "full stack",
    "embedded", "matlab", "communication", "teamwork", "leadership", "problem-solving",
    "problem solving", "stakeholder management", "project management", "analytical",
}  # fmt: skip

ACTION_VERBS = {
    "built", "developed", "designed", "created", "implemented", "led", "managed", "improved",
    "reduced", "increased", "delivered", "launched", "automated", "analysed", "analyzed",
    "optimised", "optimized", "wrote", "tested", "deployed", "maintained", "coordinated",
    "supported", "trained", "researched", "collaborated", "presented", "organised", "organized",
    "achieved", "streamlined", "migrated", "integrated", "configured", "resolved", "enhanced",
    "executed", "applied", "leveraged", "engineered", "established", "mentored", "planned",
    "produced", "secured", "monitored", "coded", "programmed", "refactored", "documented",
    "handled", "served", "assisted", "helped", "ran", "taught", "volunteered", "won",
}  # fmt: skip
WEAK_STARTS = ("i ", "responsible for", "duties included", "worked on", "helped with")
WEIGHTS = {
    "readable": 2, "keywords": 3, "contact": 2, "sections": 1,
    "length": 1, "bullets": 1, "results": 1, "dates": 1,
}  # fmt: skip
POINTS = {"pass": 1.0, "warn": 0.5, "fail": 0.0}


MORE_VERBS = {
    "represent", "prepare", "support", "help", "advise", "guide", "run", "lead", "build", "fix",
    "review", "teach", "own", "drive", "write", "make", "keep", "set", "get", "give",
    "won", "led", "built", "wrote", "made", "kept", "drove", "gave", "taught", "ran",
}  # fmt: skip


def starts_with_verb(line: str) -> bool:
    """Past or present tense: "Built", "Resolve", "Encrypted", "Maintain"."""
    first = line.split()[0].lower().strip(",.:;") if line.split() else ""
    return (
        first in ACTION_VERBS
        or first in MORE_VERBS
        or first + "d" in ACTION_VERBS
        or first + "ed" in ACTION_VERBS
        or (first.endswith("ed") and len(first) > 4)
        or (first.endswith("s") and first[:-1] in MORE_VERBS | {v[:-2] for v in ACTION_VERBS})
    )


def is_bullet(line: str) -> bool:
    """Skips lines that aren't achievements: "Tech: ...", "Part-Time Manchester, UK", a role's
    "Placement Year | C#, .NET" line, and the second half of a wrapped bullet ("working with")."""
    words = line.split()
    return bool(
        words
        and not line.startswith("Tech:")
        and " | " not in line
        and line[0].isupper()
        and len(words) > 5
    )


def _sentence(text: str) -> str:
    """First letter upper case, the rest left alone ("I", "Built" stay as they are)."""
    return text[:1].upper() + text[1:] + "."


def _has(text: str, term: str) -> bool:
    """Whole-word match that works for terms like "c#", ".net" and "node.js"."""
    pattern = rf"(?<![\w#+.]){re.escape(term.lower())}(?![\w#+])"
    return re.search(pattern, text) is not None


def job_keywords(application: Application, profile: ProfileDetails) -> list[str]:
    """The skills and terms the job asks for (from the ad and its AI summary)."""
    summary = application.job_summary or {}
    job = " ".join(
        [application.role, application.job_description]
        + [str(r) for r in summary.get("requirements", [])]
        + [str(r) for r in summary.get("nice_to_have", [])]
    ).lower()
    candidates = {t.lower(): t for t in [*KNOWN_TERMS, *profile.skills]}
    found = []
    for lower, original in sorted(candidates.items(), key=lambda kv: -len(kv[0])):
        if len(lower) > 1 and _has(job, lower) and not any(lower in f.lower() for f in found):
            found.append(original if original in profile.skills else lower)
    return found[:30]


def cv_text(content: TailoredContent) -> str:
    parts = [content.summary, ", ".join(content.skills)]
    parts += [f"{e.title} {e.company} {e.summary}" for e in content.experience]
    parts += [f"{p.name} {p.summary}" for p in content.projects]
    parts += [f"{e.qualification} {e.institution} {e.details}" for e in content.education]
    return "\n".join(parts).lower()


def check_cv(
    content: TailoredContent, profile: ProfileDetails, application: Application
) -> AtsReport:
    checks: list[AtsCheck] = []
    text = cv_text(content)

    # ---------- readable: read the real PDF back as text ----------
    pdf = build_cv_pdf(content, profile)
    reader = PdfReader(io.BytesIO(pdf))
    pages = len(reader.pages)
    pdf_text = " ".join(page.extract_text() or "" for page in reader.pages)
    flat = re.sub(r"\s+", " ", pdf_text).lower()
    expected = ["profile" if content.summary else "", "skills" if content.skills else ""]
    expected += [
        "experience" if content.experience else "",
        "education" if content.education else "",
    ]
    missing_text = [h for h in expected if h and h not in flat]
    if profile.full_name and profile.full_name.lower() not in flat:
        missing_text.append("your name")
    if profile.email and profile.email.lower() not in flat:
        missing_text.append("your email")
    checks.append(
        AtsCheck(
            id="readable",
            label="Readable by ATS",
            status="fail" if missing_text else "pass",
            detail=(
                "Couldn't read back: " + ", ".join(missing_text)
                if missing_text
                else "One column, real text and standard headings: an ATS reads every part."
            ),
        )
    )

    # ---------- keywords ----------
    wanted = job_keywords(application, profile)
    matched = [k for k in wanted if _has(text, k.lower())]
    missing = [k for k in wanted if k not in matched]
    profile_text = (
        " ".join(profile.skills)
        + " "
        + " ".join(f"{e.title} {e.summary}" for e in profile.experience)
        + " "
        + " ".join(f"{p.name} {p.summary}" for p in profile.projects)
    ).lower()
    can_add = [k for k in missing if _has(profile_text, k.lower())]
    gaps = [k for k in missing if k not in can_add]
    if not application.job_description.strip() and not (application.job_summary or {}):
        status, detail = "warn", "Add the job ad to the job so its keywords can be checked."
    elif not wanted:
        status, detail = "pass", "No specific skills found in the job ad to match."
    else:
        coverage = len(matched) / len(wanted)
        status = "pass" if coverage >= 0.7 else "warn" if coverage >= 0.4 else "fail"
        detail = f"{len(matched)} of {len(wanted)} keywords from the job ad are in your CV."
        if can_add:
            detail += f" In your profile but not in this CV: {', '.join(can_add[:8])}."
    checks.append(AtsCheck(id="keywords", label="Job keywords", status=status, detail=detail))

    # ---------- contact ----------
    contact = contact_line(profile)
    if not profile.email:
        status, detail = "fail", "Add your email to your profile: recruiters need it."
    elif not profile.phone:
        status, detail = "warn", "Add your phone number to your profile."
    else:
        status, detail = "pass", f"At the top as text: {contact[:80]}"
    checks.append(AtsCheck(id="contact", label="Contact details", status=status, detail=detail))

    # ---------- sections ----------
    absent = [
        name
        for name, present in (
            ("Profile", bool(content.summary.strip())),
            ("Skills", bool(content.skills)),
            ("Experience or Projects", bool(content.experience or content.projects)),
            ("Education", bool(content.education)),
        )
        if not present
    ]
    checks.append(
        AtsCheck(
            id="sections",
            label="Standard sections",
            status="warn" if absent else "pass",
            detail=f"Missing: {', '.join(absent)}."
            if absent
            else "Profile, Skills, Experience and Education.",
        )
    )

    # ---------- length ----------
    words = len(re.findall(r"\w+", pdf_text))
    if pages > 2:
        status, detail = "warn", f"{pages} pages: graduate CVs work best on 1–2 pages."
    elif words < 250:
        status, detail = "warn", f"Only {words} words: add more detail about what you did."
    else:
        status, detail = "pass", f"{words} words on {pages} page{'s' if pages != 1 else ''}."
    checks.append(AtsCheck(id="length", label="Length", status=status, detail=detail))

    # ---------- bullet points ----------
    all_bullets = [
        b
        for item in [*content.experience, *content.projects]
        for b in bullets(item.summary)
        if is_bullet(b)
    ]
    weak = [b for b in all_bullets if b.lower().startswith(WEAK_STARTS)]
    long = [b for b in all_bullets if len(b.split()) > 35]
    no_verb = [b for b in all_bullets if not starts_with_verb(b)]
    problems = []
    if weak:
        problems.append(f'{len(weak)} start with "I" or "Responsible for"')
    if long:
        problems.append(f"{len(long)} are over 35 words")
    if all_bullets and len(no_verb) > len(all_bullets) / 2:
        problems.append("most don't start with an action verb (Built, Led, Improved…)")
    checks.append(
        AtsCheck(
            id="bullets",
            label="Bullet points",
            status="warn" if problems or not all_bullets else "pass",
            detail=(
                _sentence("; ".join(problems))
                if problems
                else "Add bullet points under your experience."
                if not all_bullets
                else f"{len(all_bullets)} clear bullet points."
            ),
        )
    )

    # ---------- measurable results ----------
    with_numbers = [b for b in all_bullets if re.search(r"\d", b)]
    checks.append(
        AtsCheck(
            id="results",
            label="Measurable results",
            status="pass" if with_numbers else "warn",
            detail=(
                f"{len(with_numbers)} bullet point{'' if len(with_numbers) == 1 else 's'} "
                "with numbers."
                if with_numbers
                else "Add a number where it's true (users, %, time saved, team size)."
            ),
        )
    )

    # ---------- dates ----------
    undated = [e.title or e.company for e in content.experience if not (e.start or e.end)]
    checks.append(
        AtsCheck(
            id="dates",
            label="Dates",
            status="warn" if undated else "pass",
            detail=f"No dates for: {', '.join(undated[:4])}."
            if undated
            else "Every job has dates.",
        )
    )

    total = sum(WEIGHTS[c.id] for c in checks)
    score = round(100 * sum(WEIGHTS[c.id] * POINTS[c.status] for c in checks) / total)
    level = "good" if score >= 80 else "ok" if score >= 60 else "needs_work"
    return AtsReport(
        score=score,
        level=level,
        checks=checks,
        matched_keywords=matched,
        missing_in_profile=can_add,
        missing_gaps=gaps,
    )
