from pydantic import BaseModel, Field


class DocumentSettingsRead(BaseModel):
    folder: str
    default_folder: str
    auto_save: bool  # save Word + PDF copies whenever a CV or letter is written or saved


class DocumentSettingsUpdate(BaseModel):
    folder: str | None = Field(default=None, max_length=500)  # "" = back to the default
    auto_save: bool | None = None


class SavedDocuments(BaseModel):
    folders: list[str]


class OpenFolderResult(BaseModel):
    folder: str
