"""
Health check — public endpoint (no JWT authorizer).

Used by load balancers, monitoring, and quick smoke-tests.
"""
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class HealthResponse(BaseModel):
    status: str
    message: str


@router.get("/health", response_model=HealthResponse, tags=["health"])
async def health_check() -> HealthResponse:
    return HealthResponse(status="ok", message="Service is healthy")
