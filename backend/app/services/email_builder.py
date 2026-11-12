"""Builds the actual email (text body, signature, attachments)."""

import re
from email.message import EmailMessage
from email.utils import formataddr, make_msgid

from app.schemas.email import EmailSettings


def clean_header(value: str, limit: int = 300) -> str:
    # Newlines in headers would let text inject extra headers; flatten them.
    return re.sub(r"[\r\n]+", " ", value).strip()[:limit]


def with_signature(body: str, signature: str) -> str:
    body, signature = body.rstrip(), signature.strip()
    if signature and signature not in body:
        return f"{body}\n\n{signature}"
    return body


def new_message_id(from_address: str) -> str:
    domain = from_address.split("@")[-1] if "@" in from_address else "careerpilot.local"
    return make_msgid(domain=domain)


def build_email(
    *,
    settings: EmailSettings,
    to: str,
    subject: str,
    body: str,
    message_id: str,
    attachments: list[tuple[str, bytes, str]],
    in_reply_to: str = "",
) -> EmailMessage:
    message = EmailMessage()
    message["From"] = formataddr(
        (clean_header(settings.from_name, 100), str(settings.from_address))
    )
    message["To"] = clean_header(to, 320)
    message["Subject"] = clean_header(subject)
    message["Message-ID"] = message_id
    if in_reply_to:
        message["In-Reply-To"] = in_reply_to
        message["References"] = in_reply_to
    message.set_content(body)
    for filename, content, mime_type in attachments:
        maintype, _, subtype = mime_type.partition("/")
        message.add_attachment(content, maintype=maintype, subtype=subtype, filename=filename)
    return message
