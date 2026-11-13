"""Reads one job ad from its web page, when the user pastes the link.

Only the page the user chose is fetched (like opening it in a browser), never a crawl. Many job
sites put a schema.org "JobPosting" record in the page for search engines; when it's there, the
title, company, salary and closing date come straight from it. Otherwise the page's text is used.

Safety: only public http(s) addresses (never this computer or the local network), at most a few
redirects, each checked again, and at most 3 MB.
"""

import ipaddress
import json
import re
import socket
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime
from html.parser import HTMLParser
from urllib.parse import urljoin, urlsplit

import httpx

from app.integrations.jobs import html_to_text, salary_text

MAX_BYTES = 3 * 1024 * 1024
MAX_REDIRECTS = 5
TIMEOUT = 15
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) CareerPilot/1.4 (personal job tracker)"


class JobPageError(RuntimeError):
    """The page couldn't be read; the message is safe to show to the user."""


@dataclass
class JobPage:
    url: str
    text: str
    found: dict[str, str] = field(default_factory=dict)  # company, role, location, salary...


Resolver = Callable[[str], list[str]]


def _resolve(host: str) -> list[str]:
    return [info[4][0] for info in socket.getaddrinfo(host, None)]


def check_public(url: str, resolve: Resolver = _resolve) -> None:
    parts = urlsplit(url)
    if parts.scheme not in ("http", "https") or not parts.hostname:
        raise JobPageError("Only web links (http or https) can be read.")
    try:
        addresses = resolve(parts.hostname)
    except OSError as exc:
        raise JobPageError("That website couldn't be found. Check the link.") from exc
    for address in addresses:
        ip = ipaddress.ip_address(address.split("%")[0])
        if not ip.is_global:
            raise JobPageError("That link points to this computer or a private network.")


def fetch_job_page(
    url: str,
    transport: httpx.BaseTransport | None = None,
    resolve: Resolver = _resolve,
) -> JobPage:
    headers = {"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml"}
    with httpx.Client(transport=transport, headers=headers, timeout=TIMEOUT) as client:
        current = url
        for _ in range(MAX_REDIRECTS + 1):
            check_public(current, resolve)
            try:
                with client.stream("GET", current, follow_redirects=False) as response:
                    if response.is_redirect and response.headers.get("location"):
                        current = urljoin(current, response.headers["location"])
                        continue
                    if response.status_code in (401, 403):
                        raise JobPageError(
                            "That site doesn't let apps read the page (it may need you to log "
                            "in). Copy the job ad's text and paste it instead."
                        )
                    if response.status_code >= 400:
                        raise JobPageError(
                            f"The page couldn't be opened ({response.status_code}). "
                            "Paste the job ad's text instead."
                        )
                    body = b""
                    for chunk in response.iter_bytes():
                        body += chunk
                        if len(body) > MAX_BYTES:
                            raise JobPageError("That page is too big to read. Paste the text.")
                    html = body.decode(response.encoding or "utf-8", errors="replace")
                    return read_job_page(current, html)
            except httpx.HTTPError as exc:
                raise JobPageError(
                    "The page couldn't be reached. Check the link, or paste the text."
                ) from exc
    raise JobPageError("That link redirects too many times.")


# ---------- reading the page ----------


class _Collector(HTMLParser):
    """The JSON-LD blocks and the visible text, without scripts, styles, menus or footers."""

    SKIP = {"script", "style", "noscript", "svg", "nav", "footer", "header", "form", "template"}

    def __init__(self):
        super().__init__()
        self.json_ld: list[str] = []
        self.title = ""
        self._in_json_ld = False
        self._in_title = False
        self._skip = 0
        self._html: list[str] = []

    def handle_starttag(self, tag, attrs):
        if tag == "script" and ("type", "application/ld+json") in attrs:
            self._in_json_ld = True
            self.json_ld.append("")
            return
        if tag == "title":
            self._in_title = True
        if tag in self.SKIP:
            self._skip += 1
        elif not self._skip:
            self._html.append(f"<{tag}>")

    def handle_endtag(self, tag):
        if tag == "script" and self._in_json_ld:
            self._in_json_ld = False
            return
        if tag == "title":
            self._in_title = False
        if tag in self.SKIP:
            self._skip = max(0, self._skip - 1)
        elif not self._skip:
            self._html.append(f"</{tag}>")

    def handle_data(self, data):
        if self._in_json_ld:
            self.json_ld[-1] += data
        elif self._in_title:
            self.title += data
        elif not self._skip:
            self._html.append(data.replace("<", "&lt;"))

    @property
    def text(self) -> str:
        return html_to_text("".join(self._html))


def _postings(value) -> list[dict]:
    """Every JobPosting in a JSON-LD value (they can be in lists or an "@graph")."""
    found = []
    if isinstance(value, list):
        for item in value:
            found += _postings(item)
    elif isinstance(value, dict):
        kind = value.get("@type")
        kinds = kind if isinstance(kind, list) else [kind]
        if "JobPosting" in kinds:
            found.append(value)
        found += _postings(value.get("@graph", []))
    return found


def _name(value) -> str:
    if isinstance(value, dict):
        return str(value.get("name") or "").strip()
    return str(value or "").strip()


def _location(posting: dict) -> str:
    places = posting.get("jobLocation")
    places = places if isinstance(places, list) else [places]
    names = []
    for place in places:
        if not isinstance(place, dict):
            continue
        address = place.get("address")
        if isinstance(address, dict):
            parts = [address.get("addressLocality"), address.get("addressRegion")]
            name = ", ".join(str(p) for p in parts if p)
        else:
            name = str(address or place.get("name") or "")
        if name and name not in names:
            names.append(name)
    if str(posting.get("jobLocationType", "")).upper() == "TELECOMMUTE":
        names.append("Remote")
    return "; ".join(names)[:200]


def _salary(posting: dict) -> str:
    salary = posting.get("baseSalary")
    if not isinstance(salary, dict):
        return ""
    value = salary.get("value")
    if isinstance(value, dict):
        low, high = value.get("minValue"), value.get("maxValue")
        single = value.get("value")
        unit = str(value.get("unitText") or "YEAR").upper()
    else:
        low = high = None
        single, unit = value, "YEAR"
    per = {
        "YEAR": "a year",
        "MONTH": "a month",
        "WEEK": "a week",
        "DAY": "a day",
        "HOUR": "an hour",
    }
    try:
        low = float(low) if low is not None else (float(single) if single is not None else None)
        high = float(high) if high is not None else None
    except (TypeError, ValueError):
        return ""
    currency = str(salary.get("currency") or "GBP").upper()
    text = salary_text(low, high, per.get(unit, "a year"))
    return text if currency == "GBP" else text.replace("£", f"{currency} ")


def _uk_date(value) -> str:
    if not value:
        return ""
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).strftime("%d/%m/%Y")
    except ValueError:
        return str(value)[:30]


def read_job_page(url: str, html: str) -> JobPage:
    collector = _Collector()
    collector.feed(html)
    for block in collector.json_ld:
        try:
            data = json.loads(block)
        except ValueError:
            continue
        postings = _postings(data)
        if not postings:
            continue
        posting = postings[0]
        description = html_to_text(str(posting.get("description") or ""))
        found = {
            "role": html_to_text(str(posting.get("title") or "")),
            "company": _name(posting.get("hiringOrganization")),
            "location": _location(posting),
            "salary": _salary(posting),
            "deadline": _uk_date(posting.get("validThrough")),
        }
        text = description or collector.text
        return JobPage(url=url, text=text[:30_000], found={k: v for k, v in found.items() if v})
    text = collector.text
    title = re.sub(r"\s+", " ", collector.title).strip()
    if title:
        text = f"{title}\n\n{text}"
    if len(text) < 80:
        raise JobPageError(
            "That page didn't contain a readable job ad (some sites need a browser or a login). "
            "Copy the ad's text and paste it instead."
        )
    return JobPage(url=url, text=text[:30_000])
