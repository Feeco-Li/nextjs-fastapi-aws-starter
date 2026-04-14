"""
FastAPI application.

Completely stateless — no sessions, no login endpoints, no refresh logic.
JWT validation happens upstream in API Gateway before this code is ever called.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import health, items

app = FastAPI(
    title="FastAPI CDK Starter",
    description="Stateless API — JWT validation delegated to Amazon API Gateway",
    version="0.1.0",
    # Swagger UI available at /docs (useful during development)
    docs_url="/docs",
    redoc_url="/redoc",
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
