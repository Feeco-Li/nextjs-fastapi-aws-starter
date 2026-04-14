"""
Items resource — backed by DynamoDB.

By the time a request reaches this handler:
  • API Gateway has already validated the Cognito JWT.
  • An invalid / missing token would have received a 401 before Lambda ran.

FastAPI has zero auth logic — just business logic.
"""
import os

import boto3
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(tags=["items"])

# TABLE_NAME is injected by CDK as a Lambda environment variable.
table = boto3.resource("dynamodb").Table(os.environ["TABLE_NAME"])


class Item(BaseModel):
    id: str
    name: str
    description: str


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
