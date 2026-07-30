# AGENTS.md

# BuyWise AI Service

## Overview

BuyWise is an AI-first personal finance platform.

The AI is not just a chatbot. Its primary responsibility is to understand the user's financial situation, retrieve relevant information, use tools when necessary, and provide accurate financial assistance.

The project will be built incrementally. Every feature should have a working foundation before additional intelligence is added.

---

# Current Development Goal

Build a reliable conversational AI service with short-term conversation memory and tool calling.

The current focus is **not** prediction, machine learning, or advanced memory systems.

The objective is to create a stable architecture that future features can build upon.

---

# Development Roadmap

## Phase 1 — AI Chat Foundation

Implement:

* FastAPI AI service
* LangChain agent
* Basic chat endpoint
* Conversation management
* Message persistence
* Short-term conversation memory
* Basic tool calling

The agent should be able to:

* Receive user messages
* Load recent conversation history
* Call tools when required
* Generate responses
* Save conversation history

---

## Phase 2 — Persistent Memory

After short-term memory is stable:

Implement:

* User facts
* Financial memory
* Memory extraction
* Memory manager

The AI should remember information such as:

* Salary
* Savings goals
* Preferred bank
* Currency
* Financial preferences

This information should be stored as structured data rather than relying on conversation history.

---

## Phase 3 — Financial Intelligence

Expand the AI with financial understanding.

Examples:

* Spending summaries
* Budget analysis
* Goal tracking
* Cash flow analysis
* Financial insights

The AI should retrieve financial information through tools instead of generating assumptions.

---

## Phase 4 — Advanced Intelligence

Future improvements include:

* Conversation summaries
* Behavioral learning
* Spending prediction
* Personalized financial coaching
* Semantic memory
* Forecasting

These features will only be implemented after the previous phases are stable.

---

# Architecture Principles

The AI should only be responsible for:

* Understanding user intent
* Selecting tools
* Reasoning over retrieved information
* Producing responses

The AI should **not**:

* Execute SQL
* Access the database directly
* Implement business logic

Business logic belongs to the FastAPI service layer.

---

# Memory Philosophy

Current implementation:

* Short-term conversation memory

Future implementation:

* Persistent user facts
* Financial memory
* Memory retrieval
* Behavioral memory

Memory should be retrieved deliberately instead of sending entire conversations to the model.

---

# Tool Philosophy

The AI communicates only through tools.

Tools interact with the FastAPI service layer.

The service layer is responsible for:

* Validation
* Business rules
* Database operations

The AI should never access the database directly.

---

# Immediate Objective

The current milestone is:

1. Create conversation endpoints.
2. Store messages.
3. Load recent conversation history.
4. Connect the LangChain agent.
5. Return AI responses.
6. Persist assistant responses.

Once this workflow is reliable, the project can move on to persistent memory and financial intelligence.

---

# Long-Term Vision

BuyWise aims to evolve from a personal finance tracker into an intelligent financial assistant.

Future intelligence will be built on top of a reliable foundation rather than being implemented from the beginning.

The priority is correctness, maintainability, and modular architecture over rapid feature development.

## Phase 1 Tools (Mock Implementation)

The initial tools should return hardcoded or mock data. Their purpose is to validate the complete AI workflow before integrating the Go/FastAPI backend.

Implement the following tools:

### Conversation Tools

* `get_recent_messages()`

  * Returns the recent conversation history.

### Financial Overview

* `get_dashboard()`

  * Returns a mock dashboard containing:

    * Current balance
    * Total spending
    * Monthly income
    * Savings

### Transaction Tools

* `get_recent_transactions()`

  * Returns a mock list of recent transactions.

* `add_transaction()`

  * Simulates adding a transaction.

### Budget Tools

* `get_budget_status()`

  * Returns remaining monthly budget.

### Goal Tools

* `get_financial_goals()`

  * Returns active financial goals.

### User Profile

* `get_user_profile()`

  * Returns mock user information such as:

    * Salary
    * Preferred currency
    * Salary date

### General Utility

* `calculator()`

  * Performs basic mathematical calculations.

---

These tools should **not** connect to a real database during Phase 1.

Their only responsibility is to verify that:

1. The AI selects the correct tool.
2. The tool returns the expected structured output.
3. The AI correctly interprets the result.
4. The final response is generated successfully.

Once the complete tool-calling pipeline is stable, the mock implementations will be replaced with FastAPI service calls backed by the production database.
