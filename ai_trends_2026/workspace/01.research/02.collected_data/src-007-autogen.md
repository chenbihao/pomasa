## [SRC-007] AutoGen文档

**来源URL**: https://microsoft.github.io/autogen/stable/
**获取时间**: 2026-06-08
**来源类型**: 官方技术文档
**可信度**: 高

**原始内容**:

# AutoGen: Multi-Agent Framework Architecture and Features

## Overview

AutoGen is a Microsoft-developed framework described as "a framework for building AI agents and applications." It provides a layered architecture consisting of four main components: Studio, AgentChat, Core, and Extensions.

## Architectural Layers

### Studio
A "web-based UI for prototyping with agents without writing code" built on top of AgentChat. It's available as a PyPI package (`autogenstudio`) and can be launched locally via a command-line interface with configurable port and app directory.

### AgentChat
Described as "a programming framework for building conversational single and multi-agent applications," this layer sits on top of Core and requires Python 3.10+. It provides high-level abstractions like `AssistantAgent` with integration for OpenAI models. This is the recommended entry point for developers prototyping agents with Python.

### Core
The foundational layer, characterized as "an event-driven programming framework for building scalable multi-agent AI systems." It targets several use cases:

- **Business workflows**: "Deterministic and dynamic agentic workflows for business processes"
- **Research**: Collaboration research among multiple agents
- **分布式系统**: "Distributed agents for multi-language applications"

This layer is recommended for those "getting serious about building multi-agent systems."

### Extensions
Components that bridge Core/AgentChat with external services. Notable built-in extensions include:

- **MCP integration**: `McpWorkbench` for Model-Context Protocol servers
- **OpenAI Assistants**: `OpenAIAssistantAgent` for the Assistant API
- **Code execution**: `DockerCommandLineCodeExecutor` for running code in containers
- **Distributed runtime**: `GrpcWorkerAgentRuntime` for distributed agent deployments

Users can also discover community-created extensions or build their own.

## Key Technical Characteristics

- **Asynchronous design**: The codebase uses Python's `asyncio` for agent execution
- **Modular architecture**: Clear separation between UI, high-level agent framework, core runtime, and integrations
- **Open source**: Hosted on GitHub with community channels on Discord and Twitter
- **Cross-language potential**: Core's distributed runtime supports multi-language agent applications
- **Migration path available**: Documentation includes guidance for migrating from AutoGen 0.2
