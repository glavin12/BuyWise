from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Groq
    GROQ_API_KEY: str = ""
    MODEL_NAME: str = "llama-3.3-70b-versatile"
    TEMPERATURE: float = 0.7

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # Conversation
    MAX_CONVERSATION_HISTORY: int = 20  # ponytail: last N messages sent to agent, raise if context feels short

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
