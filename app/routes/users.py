from uuid import uuid4, UUID
from datetime import date

from fastapi import APIRouter
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.database import get_engine, UserModel

router = APIRouter(tags=["users"])


class UserCreate(BaseModel):
    email: EmailStr
    display_name: str


class UserResponse(BaseModel):
    id: UUID
    email: str
    display_name: str
    created_at: date
    updated_at: date


"""
TASK 2 — Upsert current user on first request
  Add POST /users/me. Extract the Cognito `sub` claim from the Authorization Bearer
  token (decode without verification — API Gateway already validated it). Upsert a row
  in `users` using the sub as `id` and the `email` claim as email. Return the user.
"""


@router.post("/users", response_model=UserResponse, status_code=201)
def create_user(body: UserCreate) -> UserResponse:
    print("hello world")
    with Session(get_engine()) as session:
        # existing = session.query(UserModel).filter_by(email=body.email).first()
        existing = session.scalar(select(UserModel).filter_by(email=body.email))
        print(existing)
        if existing:
            raise HTTPException(status_code=409, detail="Email already registered")

        today = date.today()
        user = UserModel(
            id=uuid4(),
            email=body.email,
            display_name=body.display_name,
            created_at=today,
            updated_at=today,
        )
        session.add(user)
        session.commit()
        session.refresh(user)
        return UserResponse(
            id=user.id,
            email=user.email,
            display_name=user.display_name,
            created_at=user.created_at,
            updated_at=user.updated_at,
        )


"""
TASK 3 — Get and update current user
  Add GET /users/me (return the current user row) and PATCH /users/me (update
  display_name only). Use a Pydantic schema for the request body with proper
  validation (min 2 chars, max 64 chars for display_name).
"""


@router.get("/users/{user_id}", response_model=UserResponse, status_code=201)
def get_user(user_id) -> UserResponse:
    with Session(get_engine()) as session:
        user = session.execute(select(UserModel).filter_by(id=user_id)).scalar_one()
        return UserResponse(
            id=user.id,
            email=user.email,
            display_name=user.display_name,
            created_at=user.created_at,
            updated_at=user.updated_at,
        )


@router.put("/users/{user_id}", response_model=UserResponse, status_code=201)
def edit_user(user_id) -> UserResponse:
    with Session(get_engine()) as session:
        user = session.execute(select(UserModel).filter_by(id=user_id)).scalar_one()
        return UserResponse(
            id=user.id,
            email=user.email,
            display_name=user.display_name,
            created_at=user.created_at,
            updated_at=user.updated_at,
        )
