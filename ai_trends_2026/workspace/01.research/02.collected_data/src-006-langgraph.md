## [SRC-006] LangGraph文档

**来源URL**: https://docs.langchain.com/oss/python/langgraph/overview
**获取时间**: 2026-06-08
**来源类型**: 官方技术文档
**可信度**: 高

**原始内容**:

# LangGraph: Agent Framework Architecture & Features

## Overview

LangGraph is a **low-level orchestration framework and runtime** for building, managing, and deploying long-running, stateful agents. It's trusted by companies including Klarna, Uber, and J.P. Morgan.

The framework focuses entirely on agent **orchestration** rather than higher-level abstractions. It operates independently of LangChain, though both can be used together seamlessly.

## Architecture

LangGraph uses a **graph-based architecture** where developers define nodes (functions) and edges (connections between them) using a `StateGraph` class. The basic pattern involves:

- Defining a state schema (e.g., `MessagesState`)
- Adding nodes as callable functions
- Connecting nodes via directed edges
- Specifying entry points (`START`) and endpoints (`END`)
- Compiling the graph for execution

The framework draws inspiration from **Google's Pregel**, **Apache Beam**, and **NetworkX** for its public interface.

## Core Technical Features

### Persistence
Agents can "persist through failures and can run for extended periods, resuming from where they left off," enabling durable execution across interruptions.

### Human-in-the-Loop
The system supports incorporating human oversight by "inspecting and modifying agent state at any point" during execution.

### Memory Architecture
Supports two memory tiers: **short-term working memory** for ongoing reasoning and **long-term memory** that spans across sessions.

### Streaming
Provides streaming capabilities as a core orchestration feature for real-time agent output.

## Ecosystem Positioning

LangGraph sits within a broader product stack:

- **Deep Agents**: An agent harness providing planning, subagents, filesystem tools, and context management built on top of LangGraph
- **LangChain**: The agent framework offering integrations and composable components; contains agent abstractions built atop LangGraph
- **LangSmith**: Platform for tracing, evaluation, prompts, and deployment
- **LangSmith Engine**: Monitors traces, detects issues, and proposes fixes
- **LangSmith Fleet**: No-code agent builder for templates and automation

## Installation & Integration

Available via pip or uv with a single package install (`langgraph`). The framework recommends using **LangSmith** for tracing and debugging, and suggests newcomers start with LangChain's higher-level agent abstractions before moving to LangGraph's lower-level capabilities.

## Design Philosophy

LangGraph is described as "very low-level" and deliberately avoids abstracting prompts or architecture. It focuses on the underlying infrastructure supporting any long-running, stateful workflow — making it complementary to, rather than a replacement for, higher-level frameworks like LangChain.
