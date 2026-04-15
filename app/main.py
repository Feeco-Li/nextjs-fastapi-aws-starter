"""
FastAPI application.

Completely stateless — no sessions, no login endpoints, no refresh logic.
JWT validation happens upstream in API Gateway before this code is ever called.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db
from app.routes import health, items, users


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()   # creates tables if they don't exist
    yield


app = FastAPI(
    title="FastAPI CDK Starter",
    description="Stateless API — JWT validation delegated to Amazon API Gateway",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS is also enforced by API Gateway, but keeping it here ensures
# local development (uvicorn) works without extra config.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(items.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
