"""
Example protected resource.

By the time a request reaches this handler:
  • API Gateway has already validated the Cognito JWT.
  • An invalid / missing token would have received a 401 before Lambda ran.

FastAPI has zero auth logic — just business logic.
Replace the in-memory list with real DynamoDB queries when ready —
see the commented-out section below.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.config import get_settings
import boto3

router = APIRouter(tags=["items"])


class Item(BaseModel):
    id: str
    name: str
    description: str


# ── In-memory sample data ─────────────────────────────────────────────────────
# Swap for DynamoDB when ready (see commented-out section below).
# 
# _ITEMS: list[Item] = [
#     Item(id="1", name="Widget A", description="First sample item"),
#     Item(id="2", name="Widget B", description="Second sample item"),
#     Item(id="3", name="Widget C", description="Third sample item"),
# ]
# 
# 
# @router.get("/items", response_model=list[Item])
# async def list_items() -> list[Item]:
#     return _ITEMS
# 
# 
# @router.get("/items/{item_id}", response_model=Item)
# async def get_item(item_id: str) -> Item:
#     for item in _ITEMS:
#         if item.id == item_id:
#             return item
#     raise HTTPException(status_code=404, detail=f"Item {item_id} not found")
# 
# 
# @router.post("/items", response_model=Item, status_code=201)
# async def create_item(item: Item) -> Item:
#     _ITEMS.append(item)
#     return item
# 
# 
# @router.delete("/items/{item_id}", status_code=204)
# async def delete_item(item_id: str) -> None:
#     for i, item in enumerate(_ITEMS):
#         if item.id == item_id:
#             _ITEMS.pop(i)
#             return
#     raise HTTPException(status_code=404, detail=f"Item {item_id} not found")
# 

# ── DynamoDB (uncomment when table is provisioned) ────────────────────────────
#

table = boto3.resource("dynamodb").Table(get_settings().items_table)


@router.get("/items", response_model=list[Item])
async def list_items() -> list[Item]:
    result = table.scan()
    return result["Items"]


@router.get("/items/{item_id}", response_model=Item)
async def get_item(item_id: str) -> Item:
    result = table.get_item(Key={"id": item_id})
    item = result.get("Item")
    if not item:
        raise HTTPException(status_code=404, detail=f"Item {item_id} not found")
    return item


@router.post("/items", response_model=Item, status_code=201)
async def create_item(item: Item) -> Item:
    table.put_item(Item=item.model_dump())
    return item


@router.delete("/items/{item_id}", status_code=204)
async def delete_item(item_id: str) -> None:
    table.delete_item(Key={"id": item_id})
