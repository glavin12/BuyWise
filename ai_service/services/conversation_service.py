"""
In-memory conversation store.

ponytail: dict-backed, no persistence beyond server lifetime.
Replace with DB-backed store when Go backend + DB exist.
"""

from datetime import datetime, timezone
from ai_service.schemas.conversation import Message, ConversationHistory


class ConversationService:
    """Manages conversation history in memory."""

    def __init__(self):
        # ponytail: plain dict, swap to Redis/DB when persistence matters
        self._store: dict[str, list[Message]] = {}

    def add_message(self, conversation_id: str, role: str, content: str) -> Message:
        """Add a message to a conversation."""
        if conversation_id not in self._store:
            self._store[conversation_id] = []

        message = Message(
            role=role,
            content=content,
            timestamp=datetime.now(timezone.utc),
        )
        self._store[conversation_id].append(message)
        return message

    def get_messages(
        self, conversation_id: str, limit: int | None = None
    ) -> list[Message]:
        """Get messages for a conversation, optionally limited to last N."""
        messages = self._store.get(conversation_id, [])
        if limit:
            return messages[-limit:]
        return messages

    def get_conversation(self, conversation_id: str) -> ConversationHistory:
        """Get full conversation history."""
        return ConversationHistory(
            conversation_id=conversation_id,
            messages=self._store.get(conversation_id, []),
        )

    def delete_conversation(self, conversation_id: str) -> bool:
        """Delete a conversation. Returns True if it existed."""
        if conversation_id in self._store:
            del self._store[conversation_id]
            return True
        return False

    def conversation_exists(self, conversation_id: str) -> bool:
        return conversation_id in self._store


# Singleton instance — shared across the app
conversation_service = ConversationService()
