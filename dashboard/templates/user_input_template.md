# User Input

Please fill in the following information. The Generator will use this to create your research-oriented multi-agent system.

For items you are uncertain about, you can write "to be suggested by AI", and the Generator will provide reasonable default solutions based on the pattern catalog.

---

## Language Settings

**Agent Blueprint Language** (default: English):

{{BLUEPRINT_LANGUAGE}}

**Report Output Language** (default: English):

{{REPORT_LANGUAGE}}

---

## Research Project Basic Information

**Project Identifier**:

{{PROJECT_IDENTIFIER}}

**Research Topic and Core Questions**:

{{RESEARCH_TOPIC}}

**Initial Ideas and Insights**:

{{INITIAL_IDEAS}}

---

## Data Collection

**Data Sources**:

{{DATA_SOURCES}}

**Existing Reference Materials**:

List your reference materials below (file paths or URLs). The Generator will convert all materials to Markdown format according to [STR-01 Reference Data Configuration](./pattern-catalog/STR-01-reference-data-configuration.md).

{{EXISTING_REFERENCES}}

---

## Analysis Methods

**Analysis Methods**:

{{ANALYSIS_METHODS}}

---

## Output Format

**Report Format**:

{{REPORT_FORMAT}}

**Report Structure**:

{{REPORT_STRUCTURE}}

**Deliverable File Formats**:

{{DELIVERABLE_FORMATS}}

If DOCX/PDF are selected, the Generator will set up an export pipeline with templates (STR-09).
If Wiki is selected, the Generator will create a wiki-integrator agent and `wiki/` directory structure (BHV-08).

---

## Pattern Selection

For the complete pattern list, see [pattern-catalog/README.md](./pattern-catalog/README.md)

**Quality Assurance Level**:

{{QUALITY_LEVEL}}

**Observability Level** (QUA-04 Observable Execution Logging — independent of the Quality Assurance Level above):

{{OBSERVABILITY_LEVEL}}

The Generator creates `config.yml` (holding this level) and `_observation/manager.sh` (the unified log + status recorder), and adds an observation section to each Blueprint. All observation data lives under `_observation/`, covering both execution logs and per-agent status snapshots.

**Other Patterns to Enable or Disable**:

{{PATTERN_OVERRIDES}}

---

## Other Requirements

*Advanced users: If you need to override the default web tool priorities, see [BHV-06 Configurable Tool Binding](./pattern-catalog/BHV-06-configurable-tool-binding.md).*

{{OTHER_REQUIREMENTS}}

---

## Output Style (reference)

This is not a field to fill in. When the output format implies a particular writing style, the Generator loads the matching guideline from `writing-guidelines/` and injects it into `output-template.md`'s `## Writing Style` section during generation. If no matching guideline exists, determine the writing style during Phase 0 brainstorming based on the topic and audience.

Available guidelines:
- Research Report / Technical Analysis → no fixed style (determined in Phase 0)
- 公众号文章 → `writing-guidelines/wechat-article.md`

---

## Selected Patterns

{{SELECTED_PATTERNS}}
