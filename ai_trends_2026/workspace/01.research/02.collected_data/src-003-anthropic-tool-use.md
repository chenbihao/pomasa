## [SRC-003] Anthropic工具使用文档

**来源URL**: https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview
**获取时间**: 2026-06-08
**来源类型**: 官方技术文档
**可信度**: 高

**原始内容**:

# Tool use with Claude

Connect Claude to external tools and APIs. Learn where tools execute and how the agentic loop works.

---

Tool use lets Claude call functions you define or that Anthropic provides. Claude decides when to call a tool based on the user's request and the tool's description, then returns a structured call that your application executes (client tools) or that Anthropic executes (server tools).

## How tool use works

Tools differ primarily by where the code executes. **Client tools** (including user-defined tools and Anthropic-schema tools like bash and text_editor) run in your application: Claude responds with `stop_reason: "tool_use"` and one or more `tool_use` blocks, your code executes the operation, and you send back a `tool_result`. **Server tools** (web_search, code_execution, web_fetch, tool_search) run on Anthropic's infrastructure: you see the results directly without handling execution.

For the full conceptual model including the agentic loop and when to choose each approach, see [How tool use works](/docs/en/agents-and-tools/tool-use/how-tool-use-works).

For connecting to MCP servers, see the [MCP connector](/docs/en/agents-and-tools/mcp-connector). For building your own MCP client, see [modelcontextprotocol.io](https://modelcontextprotocol.io/docs/develop/build-client).

**Guarantee schema conformance with strict tool use**: Add `strict: true` to your tool definitions to ensure Claude's tool calls always match your schema exactly.

Tool access is one of the highest-leverage primitives you can give an agent. On benchmarks like [LAB-Bench FigQA](https://lab-bench.org/) (scientific figure interpretation) and [SWE-bench](https://www.swebench.com/) (real-world software engineering), adding even basic tools produces outsized capability gains, often surpassing human expert baselines.

## When Claude uses tools

With the default `tool_choice` of `{"type": "auto"}`, Claude decides on each turn whether to call a tool or respond directly. It calls a tool when the request maps to that tool's described capability and the answer isn't already in context; it responds directly for stable knowledge, creative tasks, and conversational turns.

This boundary is steerable through your system prompt. If Claude isn't calling tools when you expect, a light instruction like `"Use the tools to investigate before responding."` measurably increases tool use; a stronger form like `"Always call a tool first before responding."` pushes further. Conversely, `"Use your judgment about whether to call a tool or respond directly."` keeps triggering behavior conservative.

For a hard guarantee rather than a nudge, use `tool_choice`.

Each server tool's page describes its own trigger boundary in more detail.

## What happens when Claude needs more information

If the user's prompt doesn't include enough information to fill all the required parameters for a tool, Claude Opus is much more likely to recognize that a parameter is missing and ask for it. Claude Sonnet may ask, especially when prompted to think before outputting a tool request. But it may also do its best to infer a reasonable value.

For example, given a `get_weather` tool that requires a `location` parameter, if you ask Claude "What's the weather?" without specifying a location, Claude (particularly Claude Sonnet) may make a guess about tool inputs.

This behavior is not guaranteed, especially for more ambiguous prompts and for less intelligent models. If Claude Opus doesn't have enough context to fill in the required parameters, it is far more likely to respond with a clarifying question instead of making a tool call.

## Pricing

Tool use requests are priced based on:
1. The total number of input tokens sent to the model (including in the `tools` parameter)
2. The number of output tokens generated
3. For server-side tools, additional usage-based pricing (e.g., web search charges per search performed)

Client-side tools are priced the same as any other Claude API request, while server-side tools may incur additional charges based on their specific usage.

The additional tokens from tool use come from:

- The `tools` parameter in API requests (tool names, descriptions, and schemas)
- `tool_use` content blocks in API requests and responses
- `tool_result` content blocks in API requests

When you use `tools`, the API also automatically includes a special system prompt for the model which enables tool use.

| Model                    | Tool choice                                          | Tool use system prompt token count          |
|--------------------------|------------------------------------------------------|---------------------------------------------|
| Claude Opus 4.8                | `auto`, `none` / `any`, `tool`   | 290 tokens / 410 tokens |
| Claude Opus 4.7                | `auto`, `none` / `any`, `tool`   | 675 tokens / 804 tokens |
| Claude Opus 4.6              | `auto`, `none` / `any`, `tool`   | 497 tokens / 589 tokens |
| Claude Opus 4.5            | `auto`, `none` / `any`, `tool`   | 496 tokens / 588 tokens |
| Claude Sonnet 4.6          | `auto`, `none` / `any`, `tool`   | 497 tokens / 589 tokens |
| Claude Sonnet 4.5          | `auto`, `none` / `any`, `tool`   | 496 tokens / 588 tokens |
| Claude Haiku 4.5         | `auto`, `none` / `any`, `tool`   | 496 tokens / 588 tokens |
