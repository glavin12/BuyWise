from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import date

from langchain_core.messages import SystemMessage


@dataclass(frozen=True)
class ContextModule:
    name: str
    content: str
    today: date | None = None  # only the time module sets it: the user's local date, for the tools


@dataclass(frozen=True)
class FinancialContext:
    profile: ContextModule | None = None
    current_time: ContextModule | None = None
    loaded_modules: frozenset[str] = field(default_factory=frozenset)

    @property
    def today(self) -> date | None:
        """The user's local date, as the model was told it (``None`` if the time module failed)."""
        return self.current_time.today if self.current_time else None

    def to_system_message_content(self) -> str:
        lines = ["[CONTEXT]"]
        modules = [m for m in (self.profile, self.current_time) if m is not None]
        for m in modules:
            lines.append(f"- {m.content}")
        return "\n".join(lines)

    def to_langchain_messages(self) -> list[SystemMessage]:
        content = self.to_system_message_content()
        return [SystemMessage(content=content)]


@dataclass
class ContextSession:
    conversation_id: uuid.UUID
    user_id: uuid.UUID
    loaded_modules: set[str] = field(default_factory=set)
