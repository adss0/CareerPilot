"""Two requests creating the profile at the same moment must not crash."""

from sqlmodel import Session

from app.models import Profile
from app.repositories.profile_repository import PROFILE_ID, ProfileRepository


def test_profile_created_by_another_request_is_reused(engine):
    with Session(engine) as first, Session(engine) as second:
        assert first.get(Profile, PROFILE_ID) is None
        assert second.get(Profile, PROFILE_ID) is None  # both see "no profile yet"
        ProfileRepository(first).get_or_create()
        first.commit()

        # The second request's insert now clashes; it reads the existing row instead.
        second.expunge_all()
        original_get = second.get
        calls = {"n": 0}

        def stale_get(model, key):
            calls["n"] += 1
            return None if calls["n"] == 1 else original_get(model, key)

        second.get = stale_get  # type: ignore[method-assign]
        profile = ProfileRepository(second).get_or_create()
        assert profile.id == PROFILE_ID
        assert calls["n"] == 2
