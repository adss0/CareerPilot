"""Job boards with free, official search APIs (no scraping): Reed and Adzuna (UK).

Each needs a free key from the board. Nothing is ever applied for through these APIs: they're
only used to list jobs, which the user then opens on the board's own site.
"""

import base64
import html
import re
from dataclasses import dataclass, field
from datetime import datetime
from html.parser import HTMLParser
from typing import Protocol

import httpx

TIMEOUT = 20


class JobBoardError(RuntimeError):
    """The search failed; the message is safe to show to the user."""


@dataclass
class Listing:
    id: str  # "reed:123" / "adzuna:456": unique across boards
    source: str
    title: str
    company: str
    location: str = ""
    salary: str = ""
    posted: str = ""
    closes: str = ""
    snippet: str = ""
    url: str = ""
    description: str = ""  # the full text, when the board gives it
    extra: dict = field(default_factory=dict)


class JobBoard(Protocol):
    name: str
    label: str

    def search(self, query: str, location: str, graduate: bool, page: int) -> list[Listing]: ...

    def details(self, listing: Listing) -> Listing: ...


def salary_text(low: float | None, high: float | None, per: str = "a year") -> str:
    def money(value: float) -> str:
        return f"£{value:,.0f}"

    if low and high and round(low) != round(high):
        return f"{money(low)} – {money(high)} {per}"
    if low or high:
        return f"{money(low or high)} {per}"
    return ""


class _TextExtractor(HTMLParser):
    BLOCKS = {"p", "br", "li", "div", "h1", "h2", "h3", "h4", "tr", "ul", "ol"}

    def __init__(self):
        super().__init__()
        self.parts: list[str] = []

    def handle_starttag(self, tag, attrs):
        if tag in self.BLOCKS:
            self.parts.append("\n- " if tag == "li" else "\n")

    def handle_data(self, data):
        self.parts.append(data)


def html_to_text(value: str) -> str:
    """Job descriptions arrive as HTML: keep the words and line breaks, drop every tag."""
    parser = _TextExtractor()
    parser.feed(value or "")
    text = html.unescape("".join(parser.parts)).replace("\xa0", " ")
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in text.splitlines()]
    return re.sub(r"\n{3,}", "\n\n", "\n".join(lines)).strip()


def _get(client: httpx.Client, url: str, label: str, **kwargs) -> dict:
    try:
        response = client.get(url, timeout=TIMEOUT, **kwargs)
    except httpx.HTTPError as exc:
        raise JobBoardError(f"Couldn't reach {label}. Check your internet connection.") from exc
    if response.status_code in (401, 403):
        raise JobBoardError(f"{label} didn't accept your key. Paste it again in Settings.")
    if response.status_code == 429:
        raise JobBoardError(f"{label}'s free limit was reached. Try again later.")
    if response.status_code >= 400:
        raise JobBoardError(f"{label} returned an error ({response.status_code}).")
    try:
        return response.json()
    except ValueError as exc:
        raise JobBoardError(f"{label} sent a reply CareerPilot couldn't read.") from exc


def _uk_date(value: str) -> str:
    """Reed sends 25/11/2026; Adzuna sends 2026-11-25T10:00:00Z. Both become 25/11/2026."""
    if not value:
        return ""
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).strftime("%d/%m/%Y")
    except ValueError:
        return value


class ReedBoard:
    """https://www.reed.co.uk/developers: free key; username = key, no password."""

    name, label = "reed", "Reed"
    BASE = "https://www.reed.co.uk/api/1.0"

    def __init__(self, key: str, transport: httpx.BaseTransport | None = None, base: str = BASE):
        self.base = base.rstrip("/")
        token = base64.b64encode(f"{key}:".encode()).decode()
        self.client = httpx.Client(headers={"Authorization": f"Basic {token}"}, transport=transport)

    def search(self, query: str, location: str, graduate: bool, page: int) -> list[Listing]:
        params = {"keywords": query, "resultsToTake": 25, "resultsToSkip": (page - 1) * 25}
        if location:
            params["locationName"] = location
        if graduate:
            params["graduate"] = "true"
        data = _get(self.client, f"{self.base}/search", self.label, params=params)
        return [self._listing(item) for item in data.get("results", [])]

    def details(self, listing: Listing) -> Listing:
        job_id = listing.id.split(":", 1)[1]
        data = _get(self.client, f"{self.base}/jobs/{job_id}", self.label)
        listing.description = html_to_text(data.get("jobDescription", "")) or listing.snippet
        listing.url = data.get("externalUrl") or data.get("jobUrl") or listing.url
        if data.get("contractType") or data.get("fullTime") is not None:
            hours = "Full-time" if data.get("fullTime") else "Part-time"
            listing.extra["work_type"] = " · ".join(
                p for p in (str(data.get("contractType") or "").title(), hours) if p
            )
        return listing

    def _listing(self, item: dict) -> Listing:
        return Listing(
            id=f"reed:{item.get('jobId')}",
            source=self.name,
            title=str(item.get("jobTitle", "")).strip(),
            company=str(item.get("employerName", "")).strip(),
            location=str(item.get("locationName", "") or ""),
            salary=salary_text(item.get("minimumSalary"), item.get("maximumSalary")),
            posted=_uk_date(str(item.get("date", "") or "")),
            closes=_uk_date(str(item.get("expirationDate", "") or "")),
            snippet=html_to_text(str(item.get("jobDescription", "") or "")),
            url=str(item.get("jobUrl", "") or ""),
        )


class AdzunaBoard:
    """https://developer.adzuna.com: free app id + key."""

    name, label = "adzuna", "Adzuna"
    BASE = "https://api.adzuna.com/v1/api/jobs/gb/search"

    def __init__(self, app_id: str, key: str, transport: httpx.BaseTransport | None = None):
        self.auth = {"app_id": app_id, "app_key": key}
        self.client = httpx.Client(transport=transport)

    def search(self, query: str, location: str, graduate: bool, page: int) -> list[Listing]:
        what = f"{query} graduate" if graduate and "graduate" not in query.lower() else query
        params = {**self.auth, "what": what, "results_per_page": 25}
        if location:
            params["where"] = location
        data = _get(self.client, f"{self.BASE}/{page}", self.label, params=params)
        return [self._listing(item) for item in data.get("results", [])]

    def details(self, listing: Listing) -> Listing:
        # Adzuna only shares the start of the description; the rest is on the job page.
        listing.description = listing.description or listing.snippet
        return listing

    def _listing(self, item: dict) -> Listing:
        predicted = str(item.get("salary_is_predicted", "0")) == "1"
        salary = salary_text(item.get("salary_min"), item.get("salary_max"))
        return Listing(
            id=f"adzuna:{item.get('id')}",
            source=self.name,
            title=html_to_text(str(item.get("title", ""))),
            company=str((item.get("company") or {}).get("display_name", "")).strip(),
            location=str((item.get("location") or {}).get("display_name", "")),
            salary=f"{salary} (estimated)" if salary and predicted else salary,
            posted=_uk_date(str(item.get("created", "") or "")),
            snippet=html_to_text(str(item.get("description", "") or "")),
            url=str(item.get("redirect_url", "") or ""),
        )
