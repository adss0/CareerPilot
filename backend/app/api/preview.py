"""Preview mode: the exact PDF a CV or cover letter will become, from the text on screen
(including edits that aren't saved yet). Nothing is stored."""

from fastapi import APIRouter, Response
from pydantic import BaseModel, Field

from app.api.deps import SessionDep
from app.schemas.tailored_cv import CvStyle, TailoredContent
from app.services.cv_export import build_cv_pdf
from app.services.letter_export import PDF_MEDIA_TYPE, build_pdf
from app.services.tailored_cv_service import TailoredCvService, load_profile

router = APIRouter(prefix="/preview", tags=["preview"])


class LetterPreview(BaseModel):
    content: str = Field(min_length=1, max_length=10_000)


class CvPreview(BaseModel):
    content: TailoredContent
    style: CvStyle | None = None


def _pdf(content: bytes) -> Response:
    return Response(
        content=content,
        media_type=PDF_MEDIA_TYPE,
        headers={"Content-Disposition": 'inline; filename="preview.pdf"'},
    )


@router.post("/letter", response_class=Response)
def preview_letter(data: LetterPreview, session: SessionDep) -> Response:
    return _pdf(build_pdf(data.content, load_profile(session)))


@router.post("/cv", response_class=Response)
def preview_cv(data: CvPreview, session: SessionDep) -> Response:
    layout = TailoredCvService(session).layout(data.style or "")
    return _pdf(build_cv_pdf(data.content, load_profile(session), layout))
