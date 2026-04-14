from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    items_table: str

    model_config = {"env_file": ".env", "extra": "ignore"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
