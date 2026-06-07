## [SRC-004] Google Agent Development Kit

**来源URL**: https://adk.dev/
**获取时间**: 2026-06-08
**来源类型**: 官方技术文档
**可信度**: 高

**原始内容**:

# Google Agent Development Kit (ADK) — Architecture & Features

## Overview

ADK is an open-source framework for building, debugging, and deploying production-grade AI agents at enterprise scale. It supports five languages: **Python, TypeScript, Go, Java, and Kotlin**.

The framework's philosophy centers on professional development: "Build production agents, not prototypes." It aims to let developers start simply with prompts and tools, then scale toward complex multi-agent orchestration.

## Core Architecture

### Agent Construction

Agents are defined with a name, model, instruction prompt, and toolset. A basic agent in Python looks like:

```python
from google.adk import Agent
from google.adk.tools import google_search

agent = Agent(
    name="researcher",
    model="gemini-flash-latest",
    instruction="You help users research topics thoroughly.",
    tools=[google_search],
)
```

Similar patterns exist for TypeScript (`LlmAgent`), Go (`llmagent.New`), Java (`LlmAgent.builder()`), and Kotlin (`LlmAgent`).

### Graph Workflows (ADK 2.0)

A major addition in version 2.0, graph workflows let developers "weave deterministic code with adaptive AI reasoning." These provide structured, graph-based architectures with explicit execution paths and predictable outcomes. Sub-topics include graph routes, data handling, human input integration, and dynamic workflows.

### Multi-Agent Workflows

ADK supports several orchestration patterns:

- **Collaborative workflows** — agents working together
- **Template workflows** — sequential, loop, and parallel execution patterns
- **Custom template workflows** for bespoke orchestration
- **Agent routing** for directing tasks to appropriate agents

### Context Management

The framework takes a distinctive approach to context. "Unlike tools that simply paste strings together until the context window overflows, ADK **manages** your context." Context is treated like source code — sessions, memory, tool outputs, and artifacts are assembled into a structured view. ADK automatically:

- Filters irrelevant events
- Summarizes older conversational turns
- Lazy-loads artifacts
- Tracks token usage

### Sessions and State

Sessions maintain conversational state, with support for rewinding, migration, and persistent memory. Events track interactions, and state management lets agents maintain information across turns.

## Tools & Integration Ecosystem

ADK provides multiple tool types:

- **Function tools** — custom callable functions with performance tuning and action confirmations
- **MCP tools** — Model Context Protocol integration
- **OpenAPI tools** — generated from OpenAPI specifications
- **Authentication support** for secure tool access
- **Google Search grounding** for real-time information retrieval

The framework connects with numerous AI models including **Gemini, Gemma, Claude** (Anthropic), models via **Ollama, vLLM, LiteLLM**, and those accessible through **Apigee AI Gateway** or hosted platforms.

## Development & Operations

### Developer Tooling

- **Agents CLI** — scaffolds agents quickly using AI-powered coding environments
- **Web Interface** with a Visual Builder for agent construction
- **Command Line** and **API Server** runtime options
- **Coding with AI** guidance for AI-assisted agent development

### Deployment

Designed for "deploy anywhere" flexibility with options including:

- Self-hosted containerized deployments
- **Google Cloud Run** and **GKE**
- **Agent Runtime** (Agent Platform) with one-command deployment
- Managed infrastructure with authentication, Cloud Trace observability, and enterprise security

The key promise: "Develop locally, scale globally" — no code changes needed between local and cloud environments.

### Observability

Three pillars: **Logging, Metrics, and Traces** for monitoring agent behavior in production.

### Evaluation

Built-in evaluation tools cover criteria-based assessment, user simulation, environment simulation, custom metrics, and optimization workflows.

### Safety & Security

Dedicated safety and security documentation is provided as a core framework component.

## Protocols & Interoperability

- **A2A (Agent-to-Agent) Protocol** — with quickstart guides for exposing and consuming agents across Python, Go, and Java
- **MCP** support for the Model Context Protocol
- **Gemini Live API Toolkit** — a multi-part streaming development guide covering message sending, event handling, run configuration, and multimedia (audio, images, video)
- **Ambient Agents** for background agent operation

## Key Differentiators

ADK positions itself around several themes: structured context management rather than naive concatenation, gradual complexity scaling from simple to sophisticated, AI-powered development tools for building agents, and open-source availability across multiple programming languages under a permissive license.
