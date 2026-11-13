"""The recycle bin: deleted jobs are kept for 30 days and can be restored.

A deleted job is saved as one snapshot (the job, its cover letters, tailored CV, status history,
emails and replies), then removed for real. Nothing else in the app needs to know about the bin,
and restoring re-creates everything with fresh ids.
"""

from datetime import timedelta

from sqlmodel import Session, col, select

from app.core.errors import NotFoundError
from app.models import (
    Application,
    CoverLetter,
    EmailLog,
    InboxReply,
    RecycledApplication,
    StatusHistory,
    TailoredCv,
)
from app.models.tables import utcnow
from app.schemas.application import BinItem

KEEP_DAYS = 30
CHILDREN = (CoverLetter, TailoredCv, StatusHistory, EmailLog, InboxReply)


def _dump(row) -> dict:
    data = row.model_dump(mode="json")
    data.pop("id", None)
    return data


class RecycleBin:
    def __init__(self, session: Session):
        self.session = session

    # ---------- deleting ----------

    def throw_away(self, application: Application) -> None:
        """Snapshots the job and everything linked to it, then deletes it (not committed)."""
        app_id = application.id
        children: dict[str, list[dict]] = {}
        for model in CHILDREN:
            rows = self.session.exec(
                select(model).where(model.application_id == app_id)  # type: ignore[attr-defined]
            ).all()
            children[model.__name__] = [{"old_id": r.id, **_dump(r)} for r in rows]
        self.session.add(
            RecycledApplication(
                original_id=app_id,
                company=application.company,
                role=application.role,
                status=application.status.value,
                data={"application": _dump(application), "children": children},
            )
        )
        # Children go with the job (ON DELETE CASCADE), but delete them here too so it
        # doesn't depend on SQLite's foreign-key setting.
        for model in (InboxReply, *CHILDREN[:-1]):
            for row in self.session.exec(
                select(model).where(model.application_id == app_id)  # type: ignore[attr-defined]
            ).all():
                self.session.delete(row)
        self.session.flush()
        self.session.delete(application)

    # ---------- the bin ----------

    def items(self) -> list[BinItem]:
        self.purge_expired()
        rows = self.session.exec(
            select(RecycledApplication).order_by(col(RecycledApplication.deleted_at).desc())
        ).all()
        return [self._item(row) for row in rows]

    def restore(self, bin_id: int) -> Application:
        row = self._get(bin_id)
        application = Application.model_validate(row.data["application"])
        self.session.add(application)
        self.session.flush()
        children = row.data.get("children", {})
        email_ids: dict[int, int] = {}
        for model in (CoverLetter, TailoredCv, StatusHistory, EmailLog):
            for item in children.get(model.__name__, []):
                old_id = item.pop("old_id", None)
                restored = model.model_validate({**item, "application_id": application.id})
                self.session.add(restored)
                self.session.flush()
                if model is EmailLog and old_id is not None:
                    email_ids[old_id] = restored.id
        for item in children.get("InboxReply", []):
            item.pop("old_id", None)
            item["application_id"] = application.id
            item["email_log_id"] = email_ids.get(item.get("email_log_id"))
            self.session.add(InboxReply.model_validate(item))
        self.session.delete(row)
        self.session.commit()
        self.session.refresh(application)
        return application

    def delete_forever(self, bin_id: int) -> None:
        self.session.delete(self._get(bin_id))
        self.session.commit()

    def empty(self) -> int:
        rows = self.session.exec(select(RecycledApplication)).all()
        for row in rows:
            self.session.delete(row)
        self.session.commit()
        return len(rows)

    def purge_expired(self) -> int:
        cutoff = utcnow() - timedelta(days=KEEP_DAYS)
        rows = self.session.exec(
            select(RecycledApplication).where(RecycledApplication.deleted_at < cutoff)
        ).all()
        for row in rows:
            self.session.delete(row)
        if rows:
            self.session.commit()
        return len(rows)

    def _get(self, bin_id: int) -> RecycledApplication:
        row = self.session.get(RecycledApplication, bin_id)
        if row is None:
            raise NotFoundError("Deleted job", bin_id)
        return row

    @staticmethod
    def _item(row: RecycledApplication) -> BinItem:
        deleted = row.deleted_at
        return BinItem(
            id=row.id or 0,
            company=row.company,
            role=row.role,
            status=row.status,
            deleted_at=deleted,
            expires_at=deleted + timedelta(days=KEEP_DAYS),
        )
