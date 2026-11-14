"""Works out from a job ad whether the employer sponsors visas: "yes", "no" or "unsure"."""

import re

KIND = r"(?:visa\ |skilled\ worker\ |tier\ 2\ |employer\ |work\ )?"
NO = re.compile(
    rf"""(?ix)\b(?:
      no\ {KIND}sponsorship
    | (?:unable|not\ able|not\ in\ a\ position)\ to\ (?:offer\ |provide\ |give\ )?{KIND}sponsor
    | (?:cannot|can't|can\ not|do\ not|don't|does\ not|doesn't|will\ not|won't|not)
      \ (?:currently\ |be\ able\ to\ )?(?:offer\ |provide\ |give\ |support\ )?(?:any\ )?
      {KIND}sponsor
    | without\ (?:the\ need\ for\ |requiring\ |needing\ )?{KIND}sponsorship
    | sponsorship\ (?:is|will)\ not\ (?:be\ )?(?:available|offered|provided|possible)
    | not\ eligible\ for\ {KIND}sponsorship
    )"""
)
YES = re.compile(
    rf"""(?ix)\b(?:
      {KIND}sponsorship\ (?:is\ |will\ be\ )?(?:available|offered|provided|possible)
    | (?:we|can|will|able\ to|happy\ to)\ (?:offer\ |provide\ |consider\ )?{KIND}sponsor
    | offers?\ {KIND}sponsorship
    | sponsor(?:s|ing)?\ (?:skilled\ worker\ |work\ )?visas?
    | licensed\ sponsor
    )"""
)


def detect_sponsorship(text: str) -> str:
    """A "no" wins over a "yes": ads that rule it out often mention the word twice."""
    if not text:
        return "unsure"
    if NO.search(text):
        return "no"
    if YES.search(text):
        return "yes"
    return "unsure"
