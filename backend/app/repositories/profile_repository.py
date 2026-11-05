from sqlmodel import Session

from app.models import Profile

PROFILE_ID = 1


class ProfileRepository:
    def __init__(self, session: Session):
        self.session = session

    def get_or_create(self) -> Profile:
        profile = self.session.get(Profile, PROFILE_ID)
        if profile is None:
            profile = Profile(id=PROFILE_ID)
            self.session.add(profile)
            self.session.flush()
        return profile
