"""Guardrail: flags things in a letter that don't appear in the profile or the job.

AI can still invent details despite instructions. This doesn't block anything: it lists what
the user should double-check before sending.
"""

import re

MAX_FLAGS = 8

# Capitalised words that are normal in letters and shouldn't be flagged.
COMMON_WORDS = {
    "i", "i'm", "i've", "i'd", "i'll", "dear", "hiring", "manager", "kind", "regards", "yours",
    "sincerely", "best", "thank", "thanks", "monday", "tuesday", "wednesday", "thursday",
    "friday", "january", "february", "march", "april", "may", "june", "july", "august",
    "september", "october", "november", "december", "english", "british", "uk", "us", "cv",
    "ai", "team", "recruitment", "ltd", "inc", "plc",
}  # fmt: skip

NUMBER_RE = re.compile(r"(?<![\w.])[£$€]?\d[\d,]*(?:\.\d+)?\s*(?:%|k\b|\+)?")
WORD_RE = re.compile(r"[A-Za-z][\w+#.'’-]*[\w+#]|[A-Za-z]")
SENTENCE_END_RE = re.compile(r"[.!?:]\s*$|^\s*$")


def _digits(value: str) -> str:
    return re.sub(r"\D", "", value)


def check_letter(letter: str, *, profile_text: str, job_text: str) -> list[str]:
    corpus = f"{profile_text}\n{job_text}".lower()
    corpus_digits = {_digits(n) for n in NUMBER_RE.findall(corpus)}
    flags: list[str] = []

    if re.search(r"\[[^\]]{1,40}\]", letter):
        flags.append("The letter contains a placeholder in [brackets]. Fill it in or remove it.")

    for match in NUMBER_RE.finditer(letter):
        number = match.group(0).strip()
        if _digits(number) and _digits(number) not in corpus_digits:
            after = letter[match.end() : match.end() + 20].split()
            context = f"{number} {after[0]}" if after and not number.endswith("%") else number
            flags.append(
                f"'{context.strip(' ,.')}' isn't in your profile or the job. Check it's true."
            )

    for name in _unknown_names(letter, corpus):
        flags.append(f"'{name}' isn't in your profile or the job. Check it's true.")

    if not job_text.strip() or "job description: (not provided" in job_text.lower():
        flags.append("There's no job description, so the letter can only be fairly general.")

    unique = list(dict.fromkeys(flags))
    return unique[:MAX_FLAGS]


def _unknown_names(letter: str, corpus: str) -> list[str]:
    """Capitalised words, acronyms or tech names (not starting a sentence) unknown to the corpus."""
    names: list[str] = []
    for line in letter.splitlines():
        previous = ""
        for match in WORD_RE.finditer(line):
            word = match.group(0).rstrip(".'’").removesuffix("'s").removesuffix("’s")
            starts_sentence = SENTENCE_END_RE.search(line[: match.start()]) is not None
            prior = previous
            previous = word
            if not word or word.lower() in COMMON_WORDS:
                continue
            looks_like_name = word[0].isupper() or any(c.isdigit() or c in "+#" for c in word)
            if not looks_like_name or (starts_sentence and not word.isupper()):
                continue
            if prior.lower() in ("dear",):  # the greeting's name
                continue
            if not re.search(rf"(?<!\w){re.escape(word.lower())}(?!\w)", corpus):
                names.append(word)
    return list(dict.fromkeys(names))
