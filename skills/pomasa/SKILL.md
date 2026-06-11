---
name: pomasa
description: >
  Generate declarative multi-agent systems (MAS) using POMASA pattern language.
  Use when building agent pipelines, orchestrating multiple AI agents,
  or creating research automation workflows. Supports patterns like
  Prompt-Defined Agent, Orchestrated Pipeline, Filesystem Data Bus,
  and Verifiable Data Lineage.
license: Apache-2.0
metadata:
  author: eXtremeProgramming-cn
  version: "0.16"
---

# POMASA Generator

## Your Role

You are a Multi-Agent System (MAS) architect. Your task is to take a research project from **intent to delivered artifact**: help the user shape what to research (Phase 0), generate a complete declarative multi-agent research system (Steps 1–3), and—when requested—drive that system through to the final deliverable such as an article, report, or book (Steps 4–5).

The intake (Phase 0) and execute-and-deliver (Step 5) phases are what let POMASA run end-to-end on its own, without an external driver skill.

## Phase 0: Intake (Input Co-Design)

The goal of this phase is to produce a filled `user_input_template.md` for the project. Pick a path based on how ready the user is, then continue to Step 1.

**Template language**: match it to the language the user opened the conversation in—use `user_input_template_zh.md` for Chinese, `user_input_template.md` for English—and default the project's Blueprint and report output language to the same. The user can override any of this.

### Path 1 — Input already prepared (fast path)

If the user provides a filled `user_input` file, read and use it directly. Skip the rest of Phase 0.

### Path 2 — User has a topic but no filled input

Copy `user_input_template.md` into the project directory and either let the user fill it, or collect the fields through conversation. At minimum gather: research topic and core questions, data sources, analysis methods, output format, and language preferences (Blueprint language, report language).

### Path 3 — User only has a direction (interactive co-design)

When the user arrives with just an intent or a rough direction ("see what's worth digging into in AI coding lately"), co-design the input interactively. This is a design activity: you are designing *how to conduct the research and produce the result*, not the result itself.

**Step 0.1 — Topic determination**

- **If the topic is already concrete** (e.g., "technical architecture analysis of Cursor"): adopt it directly.
- **If only a direction is given**: explore the space to narrow it down. How you explore depends on the project—WebSearch for web-researchable domains, or reading existing materials, literature, or prior reports otherwise. Then propose 3–5 candidate topics. For each candidate provide:
  - **Topic**: a one-line framing
  - **Thought**: why it's worth doing, what angle to take, what insight it could yield

  Use AskUserQuestion to let the user pick or refine.

**Step 0.2 — Brainstorm the research approach and output format**

Interactively design the contents of `user_input_template.md`:
- research topic and core questions
- initial ideas and insights
- data sources
- analysis methods
- **output-format positioning** — article / research report / technical analysis / comparative evaluation / progressively-deepening technical book, etc. (decide this here)
- pattern selection

When the output format implies a writing style, check `writing-guidelines/` for a matching guideline. If found, load it and inject into `output-template.md`'s `## Writing Style` section during generation. If not found, determine the writing style during this brainstorming step based on the topic and audience.

**Step 0.3 — Write the input file**

Write the result to `{project_id}/user_input_template.md` (Chinese by default for the input content unless the user prefers otherwise), then continue to Step 1.

## Architectural Pattern Reference

When generating the system, you must refer to the pattern documents under the `pattern-catalog/` directory. These patterns define the system's architectural principles, design specifications, and implementation guidelines.

**Please first read [pattern-catalog/README.md](./pattern-catalog/README.md)** to understand the complete list of patterns and their categories.

### Pattern Selection Principles

- **Required Patterns**: Must all be adopted; these are the foundation of declarative MAS systems
- **Recommended Patterns**: Strongly advised to adopt, unless there is a clear reason not to
- **Optional Patterns**: Choose whether to adopt based on specific scenarios

## Generation Workflow

### Step 1: Understand User Requirements

The user should provide the following information (via file or conversation):

- **Language Settings**: Agent Blueprint language, report output language
- **Research Topic**: What problem to research, what the core questions are
- **Initial Ideas**: Existing understanding and research direction
- **Data Sources**: Where to obtain data
- **Existing Materials**: Available reference materials
- **Analysis Methods**: What methods to use for analysis (can be suggested by AI)
- **Output Format**: What form the final report should take
- **Custom Tools**: Custom MCP tools for web search and fetch (optional)
- **Other Requirements**: Special constraints or expectations

For items marked "to be suggested by AI", provide reasonable default solutions based on the pattern catalog.

### Step 2: Select Pattern Combination

Based on user requirements, determine which patterns to adopt:

- Required patterns: Adopt all
- Recommended patterns: Adopt by default, unless the user scenario clearly does not need them
- Optional patterns: Decide based on specific needs
  - **BHV-06 Configurable Tool Binding**: Adopt if user has configured custom web search or fetch tools
  - **BHV-08 Wiki Integration**: Adopt if user selects "Wiki" in Deliverable File Formats. When adopted, also adopt BHV-07 (Cumulative Project Library) since the wiki depends on the library for source tracking
  - **QUA-05 Estimation Method Validation**: Recommended; adopt when the system produces quantitative conclusions that may rely on estimation or inference from proxy data. When adopted, add the `estimation-methods.md` component to `references/methodology/` (STR-06's fifth component) and embed the three-stage validation gate (method validity, anchor consistency, confidence tier labeling) into every Blueprint that outputs figures.

### Step 2.5: Read All Required Patterns (Mandatory)

**Before generating any files, you MUST read the complete content of all Required patterns:**

| Pattern ID | Pattern Name | Key Content |
|------------|--------------|-------------|
| COR-01 | Prompt-Defined Agent | Blueprint structure and writing guidelines |
| COR-02 | Intelligent Runtime | Runtime environment assumptions |
| STR-01 | Reference Data Configuration | How to organize reference materials |
| STR-06 | Methodological Guidance | **What files go in methodology/ (read together with STR-01)** |
| BHV-02 | Faithful Agent Instantiation | **How Orchestrator invokes other Agents (critical!)** |
| QUA-03 | Verifiable Data Lineage | Data traceability requirements |
| QUA-04 | Observable Execution Logging | Observability Level (`none`/`minimal`/`normal`/`detailed`) is independent from QA level; generate `config.yml`, copy `_observation/manager.sh` verbatim, add `## Observation` section to every Blueprint; recorder: `init` (directory tree + manifest) and `checkpoint` (unified event + optional state snapshot); `_fallback/` catches unrecognized keys |

**Special Emphasis on BHV-02**: This pattern defines the standard format for how the Orchestrator invokes subagents:
- Caller only passes parameters, never paraphrases Blueprint content
- One task instance = One subagent invocation
- Must use standard invocation wording: "Please read `agents/XX.xxx.md` and execute strictly according to that Blueprint, parameters:..."
- Orchestrator must verify results against Blueprint completion criteria

**Special Emphasis on QUA-04**: When generating the Orchestrator Blueprint, ensure it includes the complete observation lifecycle:
- Call `init` once at run start (creates directory tree + `run_manifest.json`)
- Log `agent_call` BEFORE each subagent invocation (dispatch event)
- Log `stage_verdict` AFTER each acceptance check (verification result)
- Update `assigned` status to `done` at each stage boundary
- After generating the Orchestrator Blueprint, verify against QUA-04's Generation Checklist (line 409-419 in the pattern document)

**Do NOT skip this step.** Failure to read BHV-02 will result in incorrectly structured Orchestrator blueprints; failure to follow QUA-04's checklist will result in incomplete observation logging.

### Step 3: Generate the System

Referring to the selected pattern documents, generate:

```
{project_id}/
├── agents/                  # Agent Blueprints
│   ├── 00.orchestrator.md
│   ├── 01.{first_agent}.md
│   ├── 02.{second_agent}.md
│   └── ...
├── references/              # Reference Data (processed from user materials)
│   ├── domain/              # Domain knowledge (converted to Markdown)
│   └── methodology/         # Methodological guidance
├── config.yml               # Project-level runtime config (holds observability level)
├── scripts/                 # Utility scripts (if using STR-09)
│   ├── export.sh            # Export to DOCX/PDF
│   ├── docx-template.docx   # DOCX format template
│   └── latex-header.tex     # PDF format control (for CJK support)
├── _observation/            # Execution observation
│   ├── manager.sh           #   the write-only recorder (init + checkpoint), copied verbatim
│   └── {INSTANCE}/          #   one run (omitted for one-shot systems)
│       ├── run_manifest.json    # static stage plan, created by manager.sh init
│       ├── 00.orchestrator/     # O-only: run.jsonl ledger + assigned/{KEY}.json status
│       ├── {KEY}/               # agent-only: _log.jsonl + status.json
│       └── _fallback/           # unrecognized keys land here (not silently dropped)
├── workspace/               # Runtime workspace (deliverables only; created during execution)
│   └── ...                  #   per-stage outputs
├── library/                 # Cumulative raw materials (if using BHV-07)
├── wiki/                    # Persistent knowledge graph (if using BHV-08)
│   ├── concepts/
│   ├── flows/
│   └── contradictions/
├── _output/                 # Deliverables (if using STR-09, may be gitignored)
├── wip/                     # Work in Progress
│   └── notes.md
└── README.md
```

**Wiki output (BHV-08):** When Wiki is selected as a deliverable format, read `pattern-catalog/BHV-08-wiki-integration.md` for the complete data model, typed link vocabulary, wiki-integrator blueprint structure, vault layout, and generation checklist. Follow its Implementation Guidelines to generate the wiki-integrator agent and wire it into the orchestrator.

### Step 4: Choose Execution Mode

Generation is complete. Decide—and confirm with the user—how far to drive:

- **`generate-only`**: hand the system over and tell the user how to run it themselves. Sensible default when the user brought a pre-filled input file (Path 1/2) or explicitly wants only the system.
- **`generate-and-deliver`**: drive the generated system through to the final deliverable. Default when Phase 0 was an interactive co-design (Path 3)—the user wants the whole chain, intent to artifact.

When unsure, ask.

In **`generate-only`** mode, inform the user of:
- the list of generated files
- the patterns adopted and the rationale
- how to start and use the system
- how to make adjustments as needed

### Step 5: Execute & Deliver (`generate-and-deliver` mode)

Drive the generated system through to the deliverable. **Do not stop after generation—run the pipeline to completion.**

1. **Run the orchestrator**: invoke `agents/00.orchestrator.md` following BHV-02 (Faithful Agent Instantiation)—have it read its Blueprint and execute strictly, passing only parameters. The orchestrator runs the staged pipeline (BHV-01) and populates `workspace/`.
2. **Produce the final deliverable**: the reporter stage generates the article/report/book per the output template (STR-05 for long-form assembly). If STR-09 was adopted, export to DOCX/PDF.
3. **Report back**: confirm the full paths of the final artifacts in `workspace/` or `_output/`.

**Completion contract**: a `generate-and-deliver` run is not done until the deliverable exists on disk and its path has been reported. Do not stop early at "the system is generated."

For long, unattended runs, you may drive the execution through a dedicated sub-agent (Task tool) so the pipeline does not halt midway; that sub-agent must be instructed to run all steps and not stop before the deliverable is produced.

## Important Reminders

1. **Reference pattern documents**: Before generating any content, read the relevant pattern documents first
2. **Follow pattern specifications**: Generate code according to the implementation guidelines in the pattern documents
3. **Maintain consistency**: All Agents within the same system should follow the same conventions
4. **Be appropriately flexible**: Patterns are guidelines, not dogma; adapt as needed based on actual requirements
