"""Sends email over SMTP (Gmail, Outlook and most providers)."""

import smtplib
import ssl
from email.message import EmailMessage

from app.schemas.email import EmailSettings

TIMEOUT_SECONDS = 30


class EmailError(RuntimeError):
    """Sending failed; the message is safe to show to the user."""


def _connect(settings: EmailSettings) -> smtplib.SMTP:
    host, port = settings.smtp_host, settings.smtp_port
    if settings.smtp_security == "ssl":
        return smtplib.SMTP_SSL(
            host, port, timeout=TIMEOUT_SECONDS, context=ssl.create_default_context()
        )
    smtp = smtplib.SMTP(host, port, timeout=TIMEOUT_SECONDS)
    if settings.smtp_security == "starttls":
        smtp.starttls(context=ssl.create_default_context())
    return smtp


def _run(settings: EmailSettings, password: str, message: EmailMessage | None) -> None:
    try:
        with _connect(settings) as smtp:
            if password:
                smtp.login(settings.username or str(settings.from_address), password)
            if message is not None:
                smtp.send_message(message)
    except smtplib.SMTPAuthenticationError as exc:
        raise EmailError(
            "The email server rejected the username or password. For Gmail, use an App Password "
            "(not your normal password) in EMAIL_PASSWORD."
        ) from exc
    except smtplib.SMTPRecipientsRefused as exc:
        raise EmailError("The email server refused the recipient address.") from exc
    except smtplib.SMTPNotSupportedError as exc:
        raise EmailError("The email server doesn't support that security setting.") from exc
    except smtplib.SMTPException as exc:
        raise EmailError(f"The email server returned an error: {exc}"[:300]) from exc
    except ssl.SSLError as exc:
        raise EmailError("Secure connection failed. Check the port and security setting.") from exc
    except TimeoutError as exc:
        raise EmailError(f"{settings.smtp_host} took too long to answer.") from exc
    except OSError as exc:
        raise EmailError(
            f"Couldn't connect to {settings.smtp_host}:{settings.smtp_port}. "
            "Check the server name, port and your internet connection."
        ) from exc


def send_message(settings: EmailSettings, password: str, message: EmailMessage) -> None:
    _run(settings, password, message)


def check_login(settings: EmailSettings, password: str) -> None:
    """Connects and logs in without sending anything."""
    _run(settings, password, None)
