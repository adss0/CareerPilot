from typing import Literal

from pydantic import BaseModel


class ImportFieldInfo(BaseModel):
    key: str
    label: str
    required: bool


class ImportPreview(BaseModel):
    filename: str
    sheets: list[str]
    sheet: str | None
    headers: list[str]
    sample_rows: list[list[str]]
    total_rows: int
    fields: list[ImportFieldInfo]
    suggested_mapping: dict[str, str | None]


class ImportIssue(BaseModel):
    row: int
    kind: Literal["invalid", "duplicate", "warning"]
    message: str
    company: str = ""
    role: str = ""


class ImportResult(BaseModel):
    batch_id: int
    filename: str
    rows_total: int
    imported: int
    duplicates: int
    invalid: int
    empty: int
    warnings: int
    issues: list[ImportIssue]
