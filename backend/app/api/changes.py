from fastapi import APIRouter

from app.core.changes import current_version

router = APIRouter(tags=["changes"])


@router.get("/changes")
def changes() -> dict[str, str]:
    """Cheap to ask often: the app's windows poll it and refresh when the value moves."""
    return {"version": current_version()}
