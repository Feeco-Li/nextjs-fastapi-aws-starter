"""
Example protected resource.

By the time a request reaches this handler:
  • API Gateway has already validated the Cognito JWT.
  • An invalid / missing token would have received a 401 before Lambda ran.

FastAPI has zero auth logic — just business logic.
Replace the in-memory list with real DB queries as needed.
"""
from typing import Annotated

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

router = APIRouter(tags=["items"])


class Item(BaseModel):
    id: int
    name: str
    description: str


# Sample data — swap for a real data source
_ITEMS: list[Item] = [
    Item(id=1, name="Widget A", description="First sample item"),
    Item(id=2, name="Widget B", description="Second sample item"),
    Item(id=3, name="Widget C", description="Third sample item"),
]


@router.get("/items", response_model=list[Item])
async def list_items(
    # The Authorization header is forwarded by API Gateway.
    # Read it here only if you need the caller's identity (e.g. for audit logs).
    # You do NOT need to validate it — that's already done.
    authorization: Annotated[str | None, Header()] = None,
) -> list[Item]:
    return _ITEMS


@router.get("/items/{item_id}", response_model=Item)
async def get_item(item_id: int) -> Item:
    for item in _ITEMS:
        if item.id == item_id:
            return item
    raise HTTPException(status_code=404, detail=f"Item {item_id} not found")
