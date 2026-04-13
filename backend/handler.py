"""
AWS Lambda entry-point.

Mangum translates the API Gateway HTTP API v2 payload format into ASGI,
so FastAPI runs unchanged whether invoked locally (uvicorn) or on Lambda.
"""
from mangum import Mangum

from app.main import app

handler = Mangum(app, lifespan="off")
