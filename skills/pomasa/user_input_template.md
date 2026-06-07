# User Input

Please fill in the following information. The Generator will use this to create your research-oriented multi-agent system.

For items you are uncertain about, you can write "to be suggested by AI", and the Generator will provide reasonable default solutions based on the pattern catalog.

---

## Language Settings

**Agent Blueprint Language** (default: English):

[Fill in: Chinese / English / Other]

**Report Output Language** (default: English):

[Fill in: Chinese / English / Other]

---

## Research Project Basic Information

**Project Identifier**:

[Fill in: A short identifier for directory naming, e.g., industry_assessment, literature_review, etc.]

**Research Topic and Core Questions**:

[Describe: What problem do you want to research? What core questions do you want to answer?]

**Initial Ideas and Insights**:

[Describe: Your existing understanding of this problem, preliminary hypotheses, research direction, etc. If you have a theoretical framework, explain it here]

---

## Data Collection

**Data Sources**:

[Describe: Where will you obtain data? e.g., public web information, academic literature, policy documents, API interfaces, etc.]

**Existing Reference Materials**:

List your reference materials below (file paths or URLs). The Generator will convert all materials to Markdown format according to [STR-01 Reference Data Configuration](./pattern-catalog/STR-01-reference-data-configuration.md).

- [file path, URL, or description]
- ...

---

## Analysis Methods

**Analysis Methods**:

[Describe: What methods will you use to analyze the data? If you have a specific analytical framework or dimensions, explain here. You can also write "to be suggested by AI"]

---

## Output Format

**Report Format**:

[Describe: What form should the final report take? e.g., academic paper, research report, analysis summary, etc.]

**Report Structure**:

[Describe: The organizational structure of the report. You can also write "to be suggested by AI"]

**Deliverable File Formats**:

- [x] Markdown (always generated)
- [ ] PDF (recommended, for distribution)
- [ ] DOCX (recommended, for editing)
- [ ] Wiki (persistent Obsidian knowledge graph, for compounding research across runs)

If DOCX/PDF are selected, the Generator will set up an export pipeline with templates (STR-09).
If Wiki is selected, the Generator will create a wiki-integrator agent and `wiki/` directory structure (BHV-08).

---

## Pattern Selection

For the complete pattern list, see [pattern-catalog/README.md](./pattern-catalog/README.md)

**Quality Assurance Level**:

- [ ] Simple: Only adopt required patterns, no additional quality checks
- [x] Standard (default): Adopt QUA-01 Embedded Quality Standards + BHV-05 Grounded Web Research
- [ ] Strict: Adopt QUA-01 + QUA-02 Multi-Layer Quality Assurance + BHV-05 Grounded Web Research

**Observability Level** (QUA-04 Observable Execution Logging — independent of the Quality Assurance Level above):

- [ ] none: No execution logs (saves tokens); the orchestrator still records acceptance verdicts only
- [ ] minimal: Log errors only
- [x] normal (default): Log errors + warnings (including agent degradations, scope reductions, and difficulties)
- [ ] detailed: Log everything (including INFO milestones across the full chain)

When adopted, the Generator creates `config.yml` (holding this level) and `_observation/manager.sh` (the unified log + status recorder), and adds an observation section to each Blueprint. All observation data lives under `_observation/`, covering both execution logs and per-agent status snapshots.

**Other Patterns to Enable or Disable**:

[Fill in: If you have special requirements, explain here. If none, write "None"]

---

## Other Requirements

*Advanced users: If you need to override the default web tool priorities, see [BHV-06 Configurable Tool Binding](./pattern-catalog/BHV-06-configurable-tool-binding.md).*

[Fill in: Any other constraints, expectations, or special requirements. If none, write "None"]

---

## Output-Format Presets (reference)

These are not fields to fill in. When the output format implies a particular writing style, the Generator applies the matching preset during Phase 0 intake. Treat them as starting points and adjust per topic.

### Preset: Research Report / Technical Analysis

No fixed style preset—determine the writing style during the Phase 0 brainstorming step, appropriate to the topic and audience.

