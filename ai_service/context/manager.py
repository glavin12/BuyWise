from __future__ import annotations

import logging
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from ai_service.context.base_context import ContextLoader
from ai_service.context.loaders import ProfileLoader, TimeLoader
from ai_service.context.models import FinancialContext

logger = logging.getLogger(__name__)


class ContextManager:
    def __init__(self, session: AsyncSession):
        self.session = session
        self._loaders: list[ContextLoader] = [
            ProfileLoader(),
            TimeLoader(),
        ]

    async def build_context(
        self, user_id: uuid.UUID, conversation_id: uuid.UUID
    ) -> FinancialContext:
        modules = []
        for loader in self._loaders:
            try:
                mod = await loader.load(user_id, self.session)
                logger.debug(
                    "Loaded context module: name=%s content=%s", mod.name, mod.content
                )
                modules.append(mod)
            except Exception:
                logger.exception("Failed to load context module from %s", type(loader).__name__)
        ctx = FinancialContext(
            profile=next((m for m in modules if m.name == "profile"), None),
            current_time=next((m for m in modules if m.name == "current_time"), None),
            loaded_modules=frozenset(m.name for m in modules),
        )
        logger.info(
            "Built FinancialContext: profile=%s time=%s",
            bool(ctx.profile),
            bool(ctx.current_time),
        )
        return ctx
