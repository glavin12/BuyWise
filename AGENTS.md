# AGENTS.md

# BuyWise - AI Agent Development Guide

## Project Overview

BuyWise is an AI-first personal finance assistant.

The AI is the primary product.

Users should interact with the application through natural language instead of traditional forms.

Examples:

* "I spent ₹450 on pizza."
* "Can I afford a new laptop?"
* "How much did I spend on food this month?"
* "Where am I overspending?"

The AI understands user intent, calls backend tools, reasons over the returned data, and produces conversational responses.

Expense tracking exists only to provide long-term financial memory for the AI.

---

# Current Development Phase

⚠️ The project is currently focused **only on the AI service**.

Do **not** build or depend on:

* Go backend endpoints
* PostgreSQL
* Supabase
* Authentication
* Frontend integration

At this stage, every tool should return mocked or pseudo data.

The objective is to validate:

* Prompt design
* Tool selection
* Agent behavior
* Structured outputs
* Conversation flow

Real backend integration will happen later.

---

# Technology Stack (Current)

Language:

* Python 3.12+

Framework:

* FastAPI

LLM Framework:

* LangChain

Validation:

* Pydantic

LLMs:

* OpenAI / Gemini (interchangeable)

---

# AI Architecture

The project should contain a **single financial assistant agent**.

Avoid introducing multiple agents unless explicitly requested.

Architecture:

User

↓

Financial Agent

↓

Tool Calling

↓

Mock Data

↓

Response

---

# Tool Philosophy

Every capability should exist as an independent tool.

Examples:

* add_transaction
* update_transaction
* delete_transaction
* get_transactions
* get_dashboard
* get_monthly_plan
* get_category_summary

For now, these tools should return hardcoded data.

Example:

```python
{
    "income": 50000,
    "expenses": 32000,
    "savings_goal": 10000
}
```

Later these implementations will be replaced by Go backend API calls without changing the agent logic.

---

# AI Principles

The AI should:

* Understand user intent.
* Decide which tool(s) to call.
* Use structured outputs whenever appropriate.
* Never fabricate financial data.
* Ask for clarification when required.
* Produce concise and helpful responses.

The AI should NOT:

* Invent transactions.
* Perform calculations without available data.
* Assume missing information.
* Access databases directly.

---

# Prompting Principles

The system prompt should establish that the AI is a professional financial coach.

The prompt should instruct the model to:

* Use tools whenever financial information is required.
* Avoid hallucinations.
* Be conversational.
* Explain reasoning simply.
* Ask follow-up questions if user input is incomplete.

---

# Coding Guidelines

Prefer:

* Small functions
* Modular design
* Type hints
* Pydantic models
* Clear naming
* Readable code

Avoid:

* Large monolithic files
* Global state
* Business logic inside API routes
* Duplicate code

---

# Repository Structure (Target)

ai-service/

├── agent/

├── prompts/

├── tools/

├── models/

├── services/

├── api/

├── utils/

├── tests/

└── main.py

---

# Testing Strategy

All tools should initially return deterministic mock data.

The focus is validating:

* Tool selection
* Prompt quality
* Agent reasoning
* Structured outputs

Do not introduce backend dependencies during this phase.

---

# Future Integration

The mocked tools will later call the Go backend.

Future flow:

User

↓

Financial Agent

↓

Tool

↓

Go Backend API

↓

Supabase

↓

Structured Response

↓

LLM

↓

User

The agent should remain unchanged during this transition.

Only the internal implementation of each tool should change.

---

# Development Priorities

Priority 1

* Agent architecture
* Prompt engineering
* Tool calling
* Structured outputs

Priority 2

* Conversation memory
* Session management
* Context engineering

Priority 3

* Backend integration
* Authentication
* Production deployment

---

# Instructions for Coding Agents

When generating code:

* Keep components modular.
* Prefer composition over complexity.
* Do not introduce unnecessary abstractions.
* Do not add frameworks unless requested.
* Keep mock tools simple and deterministic.
* Follow existing project structure.
* Write maintainable, production-quality code.
* Explain architectural trade-offs when introducing new patterns.

The goal is to build a reliable AI service first. Backend integration will happen in a later phase.
ohhh