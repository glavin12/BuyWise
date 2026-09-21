from __future__ import annotations

from langchain_core.messages import AIMessage

from ai_service.services.agent_service import extract_agent_output


def test_extract_agent_output_separates_reasoning_from_response():
    """Groq's gpt-oss reasoning trace must be split out, not left for the user
    to read inline with the answer."""
    final = AIMessage(
        content="Here's your answer.",
        additional_kwargs={"reasoning_content": "Step 1: check the numbers.\nStep 2: answer."},
    )

    final_ai, exchanges, tool_calls, reasoning = extract_agent_output(
        {"messages": [final]}, input_count=0
    )

    assert final_ai.content == "Here's your answer."
    assert exchanges == []
    assert tool_calls == []
    assert reasoning == "Step 1: check the numbers.\nStep 2: answer."


def test_extract_agent_output_reasoning_is_none_when_absent():
    final = AIMessage(content="Plain answer.")

    _, _, _, reasoning = extract_agent_output({"messages": [final]}, input_count=0)

    assert reasoning is None
