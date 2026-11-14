from pydantic import BaseModel, Field


class DocumentSettingsRead(BaseModel):
    folder: str
    default_folder: str
    auto_save: bool  # save the CV and letter as PDFs when a job is marked as applied


class DocumentSettingsUpdate(BaseModel):
    folder: str | None = Field(default=None, max_length=500)  # "" = back to the default
    auto_save: bool | None = None


class SavedDocuments(BaseModel):
    files: list[str]  # the PDFs that were written (none when saving on apply is off)


class OpenFolderResult(BaseModel):
    folder: str
