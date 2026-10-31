from collections.abc import Sequence

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage

from ai_service.models import Message, MessageRole


def db_messages_to_langchain(messages: Sequence[Message]) -> list[BaseMessage]:
    """Convert persisted messages into LangChain chat message objects.

    - user      -> HumanMessage
    - assistant -> AIMessage, except old tool-call rows.
    - tool      -> skipped. Financial tools fetch fresh data for new questions.
    - system    -> skipped. The system prompt is generated fresh in the agent
                   layer and is never loaded from a stored row.
    """
    converted: list[BaseMessage] = []
    for message in messages:
        if message.role == MessageRole.SYSTEM:
            continue
        elif message.role == MessageRole.USER:
            converted.append(HumanMessage(content=message.content))
        elif message.role == MessageRole.ASSISTANT:
            if not message.tool_calls:
                converted.append(AIMessage(content=message.content))
        elif message.role == MessageRole.TOOL:
            continue
        else:
            raise ValueError(f"Unsupported message role: {message.role}")

    return converted
