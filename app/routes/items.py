"""
Protected items resource — CRUD via Aurora PostgreSQL.
JWT validation happens upstream in API Gateway before this code runs.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_engine, ItemModel

router = APIRouter(tags=["items"])


class Item(BaseModel):
    id: str
    name: str
    description: str


@router.get("/items", response_model=list[Item])
def list_items() -> list[Item]:
    with Session(get_engine()) as session:
        rows = session.query(ItemModel).all()
        return [Item(id=r.id, name=r.name, description=r.description) for r in rows]


@router.get("/items/{item_id}", response_model=Item)
def get_item(item_id: str) -> Item:
    with Session(get_engine()) as session:
        row = session.get(ItemModel, item_id)
        if not row:
            raise HTTPException(status_code=404, detail=f"Item {item_id} not found")
        return Item(id=row.id, name=row.name, description=row.description)


@router.post("/items", response_model=Item, status_code=201)
def create_item(item: Item) -> Item:
    with Session(get_engine()) as session:
        session.add(ItemModel(id=item.id, name=item.name, description=item.description))
        session.commit()
        return item


@router.delete("/items/{item_id}", status_code=204)
def delete_item(item_id: str) -> None:
    with Session(get_engine()) as session:
        row = session.get(ItemModel, item_id)
        if not row:
            raise HTTPException(status_code=404, detail=f"Item {item_id} not found")
        session.delete(row)
        session.commit()
