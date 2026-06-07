## [SRC-002] Anthropic Claude平台文档

**来源URL**: https://platform.claude.com/docs/en/docs/build-with-claude/overview
**获取时间**: 2026-06-08
**来源类型**: 官方技术文档
**可信度**: 高

**原始内容**:

# Features overview

Explore Claude's advanced features and capabilities.

---

Claude's API surface is organized into five areas:

- **Model capabilities:** Control how Claude reasons and formats responses.
- **Tools:** Let Claude take actions on the web or in your environment.
- **Tool infrastructure:** Handles discovery and orchestration at scale.
- **Context management:** Keeps long-running sessions efficient.
- **Files and assets:** Manage the documents and data you provide to Claude.

If you're new, start with [model capabilities](#model-capabilities) and [tools](#tools). Return to the other sections when you're ready to optimize cost, latency, or scale.

For administration and governance, see the [Admin API](/docs/en/manage-claude/admin-api), the [Usage and Cost API](/docs/en/manage-claude/usage-cost-api), and the [Compliance API](/docs/en/manage-claude/compliance-api).

## Feature availability

Features on the Claude Platform are assigned one of the following availability classifications per platform (shown in the Availability column of each following table). Not all features pass through every stage. A feature may enter at any classification and may skip stages.

| Classification | Description |
|----------------|-------------|
| **Beta**<sup>*</sup> | Preview features used for gathering feedback and iterating on a less mature use case. Availability may be limited, including through sign-up requirements or waitlists, and may not be publicly announced. <br/><br/> Features may change significantly or be discontinued based on feedback. Not guaranteed for ongoing production use. Breaking changes are possible with notice, and some platform-specific limitations may apply. Beta features on the Claude API and [Claude Platform on AWS](/docs/en/build-with-claude/claude-platform-on-aws) have a [beta header](/docs/en/api/beta-headers). |
| **Generally available (GA)** | Feature is stable, fully supported, and recommended for production use. Should not have a beta header or other indicator that the feature is in a preview state. Covered by standard API [versioning](/docs/en/api/versioning) guarantees. |
| **Deprecated** | Feature is still functional but no longer recommended. A migration path and removal timeline are provided. |
| **Retired** | Feature is no longer available. |

_<sup>*</sup> May carry a qualifier indicating narrower availability or added constraints (for example, "beta: research preview"). See the feature's page for details._

**Platform labels:** Claude API (Anthropic first-party) · [Claude Platform on AWS](/docs/en/build-with-claude/claude-platform-on-aws) (Anthropic-operated on AWS) · [Bedrock](/docs/en/build-with-claude/claude-in-amazon-bedrock) (AWS-operated) · [Vertex AI](/docs/en/build-with-claude/claude-on-vertex-ai) (Google-operated) · [Microsoft Foundry](/docs/en/build-with-claude/claude-in-microsoft-foundry) (Anthropic-operated on Azure)

## Model capabilities

Ways to steer Claude and Claude's direct outputs, including response format, reasoning depth, and input modalities.

| Feature | Description | ZDR eligible | Availability |
|---------|-----------|----|--------------|
| [Context windows](/docs/en/build-with-claude/context-windows) | Up to 1M tokens for processing large documents, extensive code bases, and long conversations. | ZDR eligible | Claude API, Claude Platform on AWS, Bedrock, Vertex AI, Azure AI (Beta) |
| [Adaptive thinking](/docs/en/build-with-claude/adaptive-thinking) | Let Claude dynamically decide when and how much to think. The only thinking mode on Claude Opus 4.8 and Claude Opus 4.7. Use the effort parameter to control thinking depth. | ZDR eligible | Claude API, Claude Platform on AWS, Bedrock, Vertex AI, Azure AI (Beta) |
| [Batch processing](/docs/en/build-with-claude/batch-processing) | Process large volumes of requests asynchronously for cost savings. Send batches with a large number of queries per batch. Batch API calls cost 50% less than standard API calls. | Not ZDR eligible | Claude API, Claude Platform on AWS |
| [Citations](/docs/en/build-with-claude/citations) | Ground Claude's responses in source documents. With Citations, Claude can provide detailed references to the exact sentences and passages it uses to generate responses, leading to more verifiable, trustworthy outputs. | ZDR eligible | Claude API, Claude Platform on AWS, Bedrock, Vertex AI, Azure AI (Beta) |
| [Extended thinking](/docs/en/build-with-claude/extended-thinking) | Enhanced reasoning capabilities for complex tasks, providing transparency into Claude's step-by-step thought process before delivering its final answer. | ZDR eligible | Claude API, Claude Platform on AWS, Bedrock, Vertex AI, Azure AI (Beta) |
| [PDF support](/docs/en/build-with-claude/pdf-support) | Process and analyze text and visual content from PDF documents. | ZDR eligible | Claude API, Claude Platform on AWS, Bedrock, Vertex AI, Azure AI (Beta) |
| [Structured outputs](/docs/en/build-with-claude/structured-outputs) | Guarantee schema conformance with two approaches: JSON outputs for structured data responses, and strict tool use for validated tool inputs. | ZDR eligible (qualified) | Claude API, Claude Platform on AWS, Bedrock, Vertex AI, Azure AI (Beta) |

## Tools

Built-in tools that Claude invokes through `tool_use`. Server-side tools are run by the platform; client-side tools are implemented and executed by you.

### Server-side tools

| Feature | Description | ZDR | Availability |
|---------|-----------|----|--------------|
| [Advisor tool](/docs/en/agents-and-tools/tool-use/advisor-tool) | Pair a faster executor model with a higher-intelligence advisor model that provides strategic guidance mid-generation for long-horizon agentic workloads. | ZDR eligible | Claude API (Beta), Claude Platform on AWS (Beta) |
| [Code execution](/docs/en/agents-and-tools/tool-use/code-execution-tool) | Run code in a sandboxed environment for advanced data analysis, calculations, and file processing. Free when used with web search or web fetch. | Not ZDR eligible | Claude API, Claude Platform on AWS, Azure AI (Beta) |
| [Web fetch](/docs/en/agents-and-tools/tool-use/web-fetch-tool) | Retrieve full content from specified web pages and PDF documents for in-depth analysis. | ZDR eligible* | Claude API, Claude Platform on AWS, Azure AI (Beta) |
| [Web search](/docs/en/agents-and-tools/tool-use/web-search-tool) | Augment Claude's comprehensive knowledge with current, real-world data from across the web. | ZDR eligible* | Claude API, Claude Platform on AWS, Vertex AI, Azure AI (Beta) |

### Client-side tools

| Feature | Description | ZDR | Availability |
|---------|-----------|----|--------------|
| [Bash](/docs/en/agents-and-tools/tool-use/bash-tool) | Execute bash commands and scripts to interact with the system shell and perform command-line operations. | ZDR eligible | Claude API, Claude Platform on AWS, Bedrock, Vertex AI, Azure AI (Beta) |
| [Computer use](/docs/en/agents-and-tools/tool-use/computer-use-tool) | Control computer interfaces by taking screenshots and issuing mouse and keyboard commands. | ZDR eligible | Claude API (Beta), Claude Platform on AWS (Beta), Bedrock (Beta), Vertex AI (Beta), Azure AI (Beta) |
| [Memory](/docs/en/agents-and-tools/tool-use/memory-tool) | Enable Claude to store and retrieve information across conversations. Build knowledge bases over time, maintain project context, and learn from past interactions. | ZDR eligible | Claude API, Claude Platform on AWS, Bedrock, Vertex AI, Azure AI (Beta) |
| [Text editor](/docs/en/agents-and-tools/tool-use/text-editor-tool) | Create and edit text files with a built-in text editor interface for file manipulation tasks. | ZDR eligible | Claude API, Claude Platform on AWS, Bedrock, Vertex AI, Azure AI (Beta) |

## Tool infrastructure

Infrastructure that supports discovering, orchestrating, and scaling tool use.

| Feature | Description | ZDR | Availability |
|---------|-----------|----|--------------|
| [Agent Skills](/docs/en/agents-and-tools/agent-skills/overview) | Extend Claude's capabilities with Skills. Use pre-built Skills (PowerPoint, Excel, Word, PDF) or create custom Skills with instructions and scripts. Skills use progressive disclosure to efficiently manage context. | Not ZDR eligible | Claude API (Beta), Claude Platform on AWS (Beta), Azure AI (Beta) |
| [MCP connector](/docs/en/agents-and-tools/mcp-connector) | Connect to remote [MCP](/docs/en/mcp) servers directly from the Messages API without a separate MCP client. | Not ZDR eligible | Claude API (Beta), Claude Platform on AWS (Beta), Azure AI (Beta) |
| [Programmatic tool calling](/docs/en/agents-and-tools/tool-use/programmatic-tool-calling) | Enable Claude to call your tools programmatically from within code execution containers, reducing latency and token consumption for multi-tool workflows. | Not ZDR eligible | Claude API, Claude Platform on AWS, Azure AI (Beta) |
| [Tool search](/docs/en/agents-and-tools/tool-use/tool-search-tool) | Scale to thousands of tools by dynamically discovering and loading tools on-demand using regex-based search, optimizing context usage and improving tool selection accuracy. | ZDR eligible | Claude API, Claude Platform on AWS, Bedrock, Vertex AI, Azure AI (Beta) |

## Context management

Infrastructure for controlling and optimizing Claude's context window.

| Feature | Description | ZDR | Availability |
|---------|-----------|----|--------------|
| [Compaction](/docs/en/build-with-claude/compaction) | Server-side context summarization for long-running conversations. When context approaches the window limit, the API automatically summarizes earlier parts of the conversation. | ZDR eligible | Claude API (Beta), Claude Platform on AWS (Beta), Bedrock (Beta), Vertex AI (Beta), Azure AI (Beta) |
| [Context editing](/docs/en/build-with-claude/context-editing) | Automatically manage conversation context with configurable strategies. Supports clearing tool results when approaching token limits and managing thinking blocks in extended thinking conversations. | ZDR eligible | Claude API (Beta), Claude Platform on AWS (Beta), Bedrock (Beta), Vertex AI (Beta), Azure AI (Beta) |
| [Automatic prompt caching](/docs/en/build-with-claude/prompt-caching#automatic-caching) | Simplify prompt caching to a single API parameter. The system automatically caches the last cacheable block in your request, moving the cache point forward as conversations grow. | ZDR eligible | Claude API, Claude Platform on AWS, Azure AI (Beta) |
| [Prompt caching (5m)](/docs/en/build-with-claude/prompt-caching) | Provide Claude with more background knowledge and example outputs to reduce costs and latency. | ZDR eligible | Claude API, Claude Platform on AWS, Bedrock, Vertex AI, Azure AI (Beta) |
| [Prompt caching (1hr)](/docs/en/build-with-claude/prompt-caching#1-hour-cache-duration) | Extended 1-hour cache duration for less frequently accessed but important context, complementing the standard 5-minute cache. | ZDR eligible | Claude API, Claude Platform on AWS, Bedrock, Vertex AI, Azure AI (Beta) |

## Files and assets

Manage files and assets for use with Claude.

| Feature | Description | ZDR | Availability |
|---------|-----------|----|--------------|
| [Files API](/docs/en/build-with-claude/files) | Upload and manage files to use with Claude without re-uploading content with each request. Supports PDFs, images, and text files. | Not ZDR eligible | Claude API (Beta), Claude Platform on AWS (Beta), Azure AI (Beta) |
