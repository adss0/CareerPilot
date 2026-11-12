from enum import StrEnum


class ApplicationStatus(StrEnum):
    IMPORTED = "imported"
    DRAFTED = "drafted"
    READY = "ready"
    SENT = "sent"
    FOLLOWED_UP = "followed_up"
    REPLIED = "replied"
    INTERVIEW = "interview"
    OFFER = "offer"
    REJECTED = "rejected"
    WITHDRAWN = "withdrawn"


class EmailStatus(StrEnum):
    QUEUED = "queued"
    SENT = "sent"
    FAILED = "failed"
    REPLIED = "replied"
    CANCELLED = "cancelled"
