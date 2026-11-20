"""Tells the app's windows when saved data has changed, so they can refresh.

Anything that writes to the database (the app itself, the browser extension, the background
email and reply jobs) goes through a SQLAlchemy session, so a listener on every commit is
enough: no caller has to remember to report its change.
"""

import itertools
import threading
import uuid

from sqlalchemy import event
from sqlalchemy.orm import ORMExecuteState, Session

# A new id each time the engine starts, so a window open across a restart (or a restored
# backup) never mistakes the fresh count for "nothing changed".
_RUN_ID = uuid.uuid4().hex[:8]
_counter = itertools.count(1)
_lock = threading.Lock()
_current = 0


def current_version() -> str:
    """Changes whenever something is saved."""
    return f"{_RUN_ID}-{_current}"


def mark_changed() -> None:
    global _current
    with _lock:
        _current = next(_counter)


@event.listens_for(Session, "after_flush")
def _flushed(session: Session, _context) -> None:
    session.info["careerpilot_changed"] = True


@event.listens_for(Session, "do_orm_execute")
def _bulk_write(state: ORMExecuteState) -> None:
    # update(...) and delete(...) statements skip the flush.
    if state.is_update or state.is_delete or state.is_insert:
        state.session.info["careerpilot_changed"] = True


@event.listens_for(Session, "after_commit")
def _committed(session: Session) -> None:
    if session.info.pop("careerpilot_changed", False):
        mark_changed()


@event.listens_for(Session, "after_rollback")
def _rolled_back(session: Session) -> None:
    session.info.pop("careerpilot_changed", None)
