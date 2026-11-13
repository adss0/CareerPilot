"""The recycle bin: deleted jobs, kept for 30 days."""

from typing import Annotated

from fastapi import APIRouter, Depends, status

from app.api.deps import ApplicationServiceDep, SessionDep
from app.schemas.application import ApplicationRead, BinItem
from app.services.recycle_bin import RecycleBin

router = APIRouter(prefix="/bin", tags=["recycle bin"])


def get_recycle_bin(session: SessionDep) -> RecycleBin:
    return RecycleBin(session)


BinDep = Annotated[RecycleBin, Depends(get_recycle_bin)]


@router.get("", response_model=list[BinItem])
def list_bin(bin_: BinDep) -> list[BinItem]:
    return bin_.items()


@router.post("/{bin_id}/restore", response_model=ApplicationRead)
def restore(bin_id: int, bin_: BinDep, applications: ApplicationServiceDep) -> ApplicationRead:
    return applications.to_read([bin_.restore(bin_id)])[0]


@router.delete("/{bin_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_forever(bin_id: int, bin_: BinDep) -> None:
    bin_.delete_forever(bin_id)


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def empty_bin(bin_: BinDep) -> None:
    bin_.empty()
