from sqlmodel import Session

from app.models import Profile
from app.models.tables import utcnow
from app.repositories.cv_repository import CvRepository
from app.repositories.profile_repository import ProfileRepository
from app.schemas.profile import ProfileRead, ProfileUpdate

LIST_FIELDS = ("experience", "education", "projects")


class ProfileService:
    def __init__(self, session: Session):
        self.session = session
        self.repo = ProfileRepository(session)
        self.cvs = CvRepository(session)

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
            seen: set[str] = set()
            skills = []
            for skill in (s.strip() for s in changes["skills"]):
                if skill and skill.casefold() not in seen:
                    seen.add(skill.casefold())
                    skills.append(skill)
            changes["skills"] = skills
        for field in LIST_FIELDS:
            if field in changes:
                # Drop entries the user left completely blank.
                changes[field] = [
                    item for item in changes[field] if any(str(v).strip() for v in item.values())
                ]
        for field, value in changes.items():
            setattr(profile, field, value)
        profile.updated_at = utcnow()
        self.session.commit()
        self.session.refresh(profile)
        return self._to_read(profile)

    def _to_read(self, profile: Profile) -> ProfileRead:
        # getattr (not model_dump) so attributes expired by commit are reloaded.
        fields = {
            name: getattr(profile, name) for name in ProfileRead.model_fields if name != "has_cv"
        }
        return ProfileRead(**fields, has_cv=self.cvs.exists())
