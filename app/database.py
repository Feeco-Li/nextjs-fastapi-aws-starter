import boto3
import json
from functools import lru_cache
from sqlalchemy import create_engine, Column, String
from sqlalchemy.orm import DeclarativeBase
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Injected by CDK on Lambda
    db_secret_arn: str = ""
    db_host: str = ""
    db_port: int = 5432
    db_name: str = "appdb"
    # Local dev override — set DATABASE_URL in .env (local PostgreSQL or Neon)
    database_url: str = ""

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()


@lru_cache
def get_engine():
    if settings.database_url:
        url = settings.database_url
    else:
        secret = json.loads(
            boto3.client("secretsmanager").get_secret_value(
                SecretId=settings.db_secret_arn
            )["SecretString"]
        )
        url = (
            f"postgresql+psycopg2://{secret['username']}:{secret['password']}"
            f"@{settings.db_host}:{settings.db_port}/{settings.db_name}"
        )
    return create_engine(url)


class Base(DeclarativeBase):
    pass


class ItemModel(Base):
    __tablename__ = "items"

    id          = Column(String, primary_key=True)
    name        = Column(String, nullable=False)
    description = Column(String, nullable=False)


def init_db() -> None:
    Base.metadata.create_all(get_engine())
