from collections.abc import Sequence

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, ToolMessage

from ai_service.models import Message, MessageRole


def db_messages_to_langchain(messages: Sequence[Message]) -> list[BaseMessage]:
    """Convert persisted messages into LangChain chat message objects.

    - user      -> HumanMessage
    - assistant -> AIMessage; a stored ``tool_calls`` JSONB is rebuilt into the
                   AIMessage's tool_calls so the exact call sequence round-trips.
    - tool      -> ToolMessage; it MUST immediately follow the assistant row that
                   declared its tool_call_id, otherwise the model API rejects the
                   request. A mismatch raises here, before any API call.
    - system    -> skipped. The system prompt is generated fresh in the agent
                   layer and is never loaded from a stored row.
    """
    converted: list[BaseMessage] = []
    pending_tool_ids: set[str] = set()

    for message in messages:
        if message.role == MessageRole.SYSTEM:
            continue
        elif message.role == MessageRole.USER:
            converted.append(HumanMessage(content=message.content))
            pending_tool_ids = set()
        elif message.role == MessageRole.ASSISTANT:
            tool_calls = message.tool_calls or []
            if tool_calls:
                converted.append(
                    AIMessage(
                        content=message.content or "",
                        tool_calls=[
                            {
                                "name": tc.get("name"),
                                "args": tc.get("args", {}),
                                "id": tc.get("id"),
                            }
                            for tc in tool_calls
                        ],
                    )
                )
                pending_tool_ids = {tc.get("id") for tc in tool_calls}
            else:
                converted.append(AIMessage(content=message.content))
                pending_tool_ids = set()
        elif message.role == MessageRole.TOOL:
            if not message.tool_call_id or message.tool_call_id not in pending_tool_ids:
                raise ValueError(
                    "Tool message without a matching assistant tool_call; "
                    "message ordering in the conversation is invalid."
                )
            converted.append(
                ToolMessage(content=message.content, tool_call_id=message.tool_call_id)
            )
        else:
            raise ValueError(f"Unsupported message role: {message.role}")

    return converted
