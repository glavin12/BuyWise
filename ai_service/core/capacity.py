"""Process-local admission control for expensive, long-lived chat requests."""

from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import HTTPException

from ai_service.core.config import get_settings


class ChatCapacity:
    def __init__(self, limit: int):
        self.limit = limit
        self.active = 0

    @asynccontextmanager
    async def slot(self) -> AsyncIterator[None]:
        # No await between the check and increment: atomic within one event loop.
        # Do not queue: queued chat bodies/sessions consume memory and client time.
        if self.active >= self.limit:
            raise HTTPException(
                status_code=503,
                detail="The assistant is busy. Please try again shortly.",
                headers={"Retry-After": "5"},
            )
        self.active += 1
        try:
            yield
        finally:
            self.active -= 1


chat_capacity = ChatCapacity(get_settings().CHAT_MAX_CONCURRENT)
