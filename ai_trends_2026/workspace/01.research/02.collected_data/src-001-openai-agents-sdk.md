## [SRC-001] OpenAI Agents SDK文档

**来源URL**: https://developers.openai.com/api/docs/guides/agents-sdk
**获取时间**: 2026-06-08
**来源类型**: 官方技术文档
**可信度**: 高

**原始内容**:

# OpenAI Agents SDK: Architecture, Features & Technical Specifications

## Overview

The Agents SDK is a framework for building code-first agent applications that can plan, call tools, collaborate across specialists, and manage state for multi-step work. It is available in both **TypeScript** and **Python**.

The SDK sits above the Responses API. As the docs explain, use the Responses API when "one model call plus tools and application-owned logic is enough," but turn to the Agents SDK when "your application owns orchestration, tool execution, approvals, and state."

## When to Use the SDK

The SDK track is recommended when your server needs to handle orchestration, tool execution, state management, and approval flows. The documentation highlights these key use cases:

- "typed application code in TypeScript or Python"
- "direct control over tools, MCP servers, and runtime behavior"
- "custom storage or server-managed conversation strategies"
- "tight integration with existing product logic or infrastructure"

## Core Architecture & Modules

The SDK is organized into several interconnected capabilities:

### Agent Definitions
Lets developers shape the contract for a single specialist agent cleanly. This is the foundation layer where agent identity, instructions, and capabilities are defined.

### Models and Providers
Covers model selection, provider configuration, and transport strategy. This layer abstracts away differences between model backends so workflows remain portable.

### The Runtime Loop (Running Agents)
This is the execution engine. The docs describe it as where "the agent loop, streaming, and continuation strategies live." Agents execute in a loop, making model calls, invoking tools, and continuing until a result is produced.

### Sandbox Agents
Provides container-based execution environments when agents need "files, commands, packages, snapshots, mounts, or provider links." This isolates agent work from the host system.

### Orchestration and Handoffs
Manages multi-agent workflows. The key design question it answers: when you have more than one agent, "who owns the reply." This includes specialist routing, delegation patterns, and handoff logic.

### Guardrails and Human Review
Adds validation layers and human-in-the-loop checkpoints. Workflows can "block or pause before risky work continues," enabling approval flows for sensitive operations.

### Results and State
Explains "final output, resumable state, and next-turn surfaces." This module provides the interface between a completed run and the application logic that consumes it.

### Integrations and Observability
Supports tracing for debugging and evaluation loops for improvement. Tool semantics (hosted tools, function tools, MCP) are documented separately, while "SDK-specific MCP and tracing live here."

## Tool Ecosystem

The SDK supports multiple tool types:

- **Hosted tools** — platform-provided capabilities
- **Function tools** — custom code registered as callable tools
- **MCP (Model Context Protocol) servers** — external tool servers connected via a standardized protocol
- **Skills** — reusable capability modules
- **Shell tools** — command-line execution
- **Computer use** — UI automation
- **File search and retrieval** — document querying
- **Code interpreter** — sandboxed code execution
- **Image generation**, **web search**, and more

## Voice Agents

The SDK includes a voice pipeline supporting real-time voice-first workflows, integrating with the Realtime API for streaming audio interactions.

## ChatKit

A UI component framework within the SDK ecosystem offering:
- Theme customization
- Widget system
- Action handling
- Advanced integration patterns

## Evaluation & Debugging

Two complementary workflows are supported:
1. **Tracing** for inspecting and debugging individual runs
2. **Agent evals** for systematic evaluation and improvement of agent workflows

## Recommended Reading Order

The documentation suggests this progression:

1. **Quickstart** → get one working run
2. **Agent definitions** + **Models and providers** → shape one specialist
3. **Running agents** → **Orchestration** → **Guardrails** → scale up complexity
4. **Results and state** + **Integrations and observability** → production readiness

## SDK Repositories

| Language | Repository |
|----------|-----------|
| TypeScript | `openai/openai-agents-js` on GitHub |
| Python | `openai/openai-agents-python` on GitHub |
