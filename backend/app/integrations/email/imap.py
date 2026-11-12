"""Reads recent inbox messages over IMAP (read-only) to find replies to your applications."""

import email
import imaplib
import ssl
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import date, datetime
from email.header import decode_header, make_header
from email.utils import getaddresses, parsedate_to_datetime

from app.integrations.email.smtp import EmailError
from app.schemas.email import EmailSettings

MAX_MESSAGES = 300
TIMEOUT_SECONDS = 30


@dataclass
class IncomingMessage:
    message_id: str
    from_address: str
    subject: str
    received_at: datetime
    references: list[str] = field(default_factory=list)  # In-Reply-To + References
    text: str = ""


def _decode(value: str | None) -> str:
    if not value:
        return ""
    try:
        return str(make_header(decode_header(value)))
    except (UnicodeDecodeError, LookupError, ValueError):
        return value


def _plain_text(message: email.message.Message) -> str:
    for part in message.walk() if message.is_multipart() else [message]:
        if part.get_content_type() == "text/plain" and not part.get_filename():
            payload = part.get_payload(decode=True) or b""
            charset = part.get_content_charset() or "utf-8"
            try:
                return payload.decode(charset, errors="replace")
            except LookupError:
                return payload.decode("utf-8", errors="replace")
    return ""


def parse_message(raw: bytes) -> IncomingMessage:
    message = email.message_from_bytes(raw)
    references = []
    for header in ("In-Reply-To", "References"):
        references += (message.get(header) or "").split()
    addresses = getaddresses([message.get("From", "")])
    try:
        received = parsedate_to_datetime(message.get("Date", ""))
    except (TypeError, ValueError):
        received = datetime.now()
    return IncomingMessage(
        message_id=(message.get("Message-ID") or "").strip(),
        from_address=(addresses[0][1] if addresses else "").lower(),
        subject=_decode(message.get("Subject")),
        received_at=received,
        references=[r.strip() for r in references if r.strip()],
        text=_plain_text(message),
    )


def fetch_recent(
    settings: EmailSettings,
    password: str,
    since: date,
    imap_factory: Callable[..., imaplib.IMAP4] | None = None,
) -> list[IncomingMessage]:
    """The newest inbox messages since a date, read-only (nothing is marked as read)."""
    factory = imap_factory or (
        lambda host, port: imaplib.IMAP4_SSL(
            host, port, ssl_context=ssl.create_default_context(), timeout=TIMEOUT_SECONDS
        )
    )
    try:
        client = factory(settings.imap_host, settings.imap_port)
        try:
            client.login(settings.username or str(settings.from_address), password)
            client.select("INBOX", readonly=True)
            status, data = client.search(None, "SINCE", since.strftime("%d-%b-%Y"))
            if status != "OK":
                raise EmailError("The inbox search failed.")
            ids = (data[0] or b"").split()[-MAX_MESSAGES:]
            messages = []
            for message_id in ids:
                status, parts = client.fetch(message_id, "(BODY.PEEK[])")
                raw = next((p[1] for p in parts if isinstance(p, tuple)), None)
                if status == "OK" and raw:
                    messages.append(parse_message(raw))
            return messages
        finally:
            try:
                client.logout()
            except (imaplib.IMAP4.error, OSError):
                pass
    except imaplib.IMAP4.error as exc:
        raise EmailError(
            "The inbox rejected the login. For Gmail, use an App Password and make sure IMAP "
            "is allowed."
        ) from exc
    except EmailError:
        raise
    except TimeoutError as exc:
        raise EmailError(f"{settings.imap_host} took too long to answer.") from exc
    except OSError as exc:
        raise EmailError(
            f"Couldn't connect to the inbox at {settings.imap_host}:{settings.imap_port}."
        ) from exc
