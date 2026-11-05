from sqlmodel import Session

from app.models import Profile
from app.models.tables import utcnow
from app.repositories.profile_repository import ProfileRepository
from app.schemas.profile import ProfileRead, ProfileUpdate


class ProfileService:
    def __init__(self, session: Session):
        self.session = session
        self.repo = ProfileRepository(session)

    def get(self) -> ProfileRead:
        profile = self.repo.get_or_create()
        self.session.commit()
        return self._to_read(profile)

    def update(self, data: ProfileUpdate) -> ProfileRead:
        profile = self.repo.get_or_create()
        changes = {
            field: value
            for field, value in data.model_dump(exclude_unset=True).items()
            if value is not None or field == "email"
        }
        if "email" in changes:
            changes["email"] = changes["email"] or ""
        if "skills" in changes:
            changes["skills"] = [s.strip() for s in changes["skills"] or [] if s.strip()]
        for field, value in changes.items():
            setattr(profile, field, value)
        profile.updated_at = utcnow()
        self.session.commit()
        self.session.refresh(profile)
        return self._to_read(profile)

    @staticmethod
    def _to_read(profile: Profile) -> ProfileRead:
        # getattr (not model_dump) so attributes expired by commit are reloaded.
        fields = {
            name: getattr(profile, name) for name in ProfileRead.model_fields if name != "has_cv"
        }
        return ProfileRead(**fields, has_cv=bool(profile.cv_file_path))
