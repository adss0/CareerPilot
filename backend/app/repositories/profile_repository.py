from sqlalchemy.exc import IntegrityError
from sqlmodel import Session

from app.models import Profile

PROFILE_ID = 1


class ProfileRepository:
    def __init__(self, session: Session):
        self.session = session

    def get_or_create(self) -> Profile:
        """The single profile row, created on first use.

        Called first in a request, so nothing else is pending. On a brand-new database several
        screens can ask for the profile at once; if another request created it a moment ago,
        the insert fails, so roll back and read theirs.
        """
        profile = self.session.get(Profile, PROFILE_ID)
        if profile is None:
            try:
                profile = Profile(id=PROFILE_ID)
                self.session.add(profile)
                self.session.flush()
            except IntegrityError:
                self.session.rollback()
                profile = self.session.get(Profile, PROFILE_ID)
                if profile is None:
                    raise
        return profile
