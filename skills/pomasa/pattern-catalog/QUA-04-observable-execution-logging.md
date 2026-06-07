# Observable Execution Logging

**Category**: Quality
**Necessity**: Recommended

## Problem

How can we observe and audit what a multi-agent system actually *did* during a run—not just what it produced?

In a declarative MAS, a subagent communicates with its Orchestrator through two channels:

1. **Filesystem Data Bus (STR-02)**: formal deliverables, persisted and auditable.
2. **Tool-return message (self-report)**: one-shot, never persisted.

Critical *process* information lives only in the second channel and evaporates when the run ends: "the Write tool was blocked by a heuristic, so I fell back to Bash", "the source was unreachable, so I narrowed scope to 4 items", "completion took 3 retries". These **degradation / scope-reduction / difficulty** events appear nowhere in the deliverables and nowhere in the data lineage (QUA-03), yet they are exactly what an auditor or debugger needs.

Without a persistent, structured execution log:

- Post-mortem debugging relies on transcripts that may be gone
- Silent degradations (an agent quietly lowering its own bar) go unnoticed
- There is no machine-readable record of *when* each stage ran and *how* it was judged

## Context

This pattern applies to the following scenarios:

- Batch or long-running pipelines where transcripts are impractical to review
- Systems where auditability of the *process* (not just the data) matters
- Runs where you want to detect agents deviating from their Blueprints (see BHV-02)
- Any system already using the Filesystem Data Bus (STR-02) and an Orchestrator (BHV-01)

This pattern is **orthogonal and complementary to QUA-03**: QUA-03 makes the *data* trustworthy (every conclusion traces to a source); this pattern makes the *execution* observable (what the system did, when, and with what outcome).

## Forces

- **Observability vs Token cost**: Every log call an agent makes consumes context tokens; full observability is not always wanted
- **Completeness vs Reliability**: A prompt-defined agent may forget to log; the log can never be the basis of correctness
- **Centralized config vs Per-call parameters**: The verbosity level is a run-wide constant, not a per-task input
- **Human-readable vs Machine-parseable**: Auditors read logs by eye; tooling parses them programmatically
- **Concurrency**: Parallel agents must not corrupt a shared log file

## Solution

**Persist execution events as structured JSONL logs, partitioned per agent instance to avoid write conflicts, gated by a project-level observability level read from a shared config file. Treat logging as best-effort observability—never as a correctness mechanism.**

### Non-Negotiable Principle: Logging Is Best-Effort

System correctness is guaranteed by **acceptance verification (BHV-02)** and **data lineage (QUA-03)**, never by the presence of a log line. A prompt-defined agent may forget to log; that must never break the run or invalidate a result. Logs are evidence for humans and tooling, not a control plane.

### Two Log Streams

| Stream | Sole writer | Location | Records |
|--------|-------------|----------|---------|
| **`run.jsonl`** | Orchestrator only | `workspace/{INSTANCE}/_journal/run.jsonl` | Each agent invocation (stage, blueprint, params) + **acceptance verdict** (pass / fail / which criteria missing) |
| **`_log.jsonl`** | Each agent instance | `workspace/{INSTANCE}/{stage}/.../_log.jsonl` | That instance's own INFO/WARN/ERROR events |

**Why two streams**: `run.jsonl` is authoritative because its writer (the Orchestrator) is also the actor and the verifier—it records its own actions and its own judgments, with no self-attestation problem, and as a single writer it has no concurrency conflict. `_log.jsonl` is the agent's self-report (lower trust), but it captures the degradation/difficulty events that exist nowhere else.

**Why per-instance partitioning**: The filesystem has no locking (STR-02). Each agent instance writes to a file *inside its own output directory*, so parallel instances physically cannot collide. This is the same partitioning discipline that makes BHV-03 parallel execution safe—never a single shared log file.

### Observability Levels

A single project-wide level controls verbosity:

| Level | `_log.jsonl` (agent self-log) | `run.jsonl` (orchestrator ledger) |
|-------|-------------------------------|-----------------------------------|
| `none` | not produced | **acceptance verdicts only** |
| `minimal` | ERROR only | verdicts + invocation records |
| `normal` *(default)* | ERROR + WARN (incl. degradation / scope-reduction / difficulty) | verdicts + invocation records |
| `detailed` | all (incl. INFO milestones) | all (incl. invocation parameters) |

Two deliberate choices:

- **`none` is short-circuit, not filter.** Its purpose is to save tokens. Tokens are spent by the *act of calling* `log.sh` (the command text and its return enter the agent's context), so under `none` the agent must skip the logging step in its Blueprint entirely and not call the script at all. The script *also* returns early on `none` for the agent self-log, as a safety net for hand-written fallbacks.
- **`none` still keeps acceptance verdicts.** A verdict is part of the BHV-02 *quality gate*, not pure observability. Even with all logging off, the Orchestrator records one verdict line per stage, so a failed run is never completely opaque.

### Level Is Configuration, Not a Parameter

The observability level is a **run-wide constant**, so it belongs to project configuration (STR-01), **not** to the per-call parameters of BHV-02. It is stored once in `project/config.yml` and read independently by three parties:

- **Orchestrator** reads it to decide how much to write to `run.jsonl`
- **Each agent** reads it only to answer one boolean: "is it `none`?" → whether to log at all
- **`log.sh`** reads it to do the `minimal`/`normal`/`detailed` fine-grained filtering

Agents never see the fine-grained distinctions; changing verbosity means editing one config key, not N Blueprints. As with all reference configuration (STR-01), Blueprints **reference** the config but **never restate** its meaning, to prevent drift.

## Consequences

### Benefits

- **Process auditability**: A durable, machine-readable record of what ran, when, and how it was judged
- **Catches silent degradation**: WARN events surface agents lowering their own bar (a BHV-02 violation signal)
- **No concurrency hazard**: Per-instance partitioning means parallel agents never corrupt a shared file
- **Token-aware**: `none` truly costs nothing; verbosity scales to need
- **Tooling-friendly**: JSONL is trivially parsed (`jq`, `json.loads`) and human-skimmable
- **Single source of truth**: One config key controls the whole run; extensible to future runtime config

### Liabilities

- **Best-effort only**: A forgetful agent may omit a log line; the log is not a guarantee of what happened
- **Token overhead** at `detailed`: Many log calls consume context
- **Relies on convention**: Like STR-03 isolation, enforced by Blueprint discipline, not by the runtime
- **Config drift risk**: If a Blueprint restates level semantics instead of referencing the config (mitigated by the STR-01 reference rule)

## Implementation Guidelines

### Wiring the Quality Gate to the Log

A `WARN: degradation/fallback` event is, in effect, a signal that an agent *may* have violated BHV-02 ("must not lower completion criteria on its own; consult instead"). The Orchestrator should treat such an event as a cue to **scrutinize that criterion harder during acceptance**. The log thus feeds the real-time quality gate, not just the post-mortem.

### `config.yml`

Generated into the project root. Carries project-level runtime configuration; QUA-04 introduces it with a single `observability` key, designed to be shared by future runtime-config needs.

```yaml
# POMASA project-level runtime configuration.
# Introduced by QUA-04; extensible for future runtime config.
# Blueprints READ values here but do not restate their meaning (avoids drift).

# observability: none | minimal | normal | detailed
observability: normal
```

### Log Line Schema

Every line is one JSON object. Common fields:

| Field | Always? | Meaning |
|-------|---------|---------|
| `ts` | yes | Local timestamp, ISO 8601 **with explicit offset** (e.g. `2026-06-07T20:03:33+08:00`) |
| `level` | yes | `INFO` / `WARN` / `ERROR` |
| `agent` | yes | Agent name (e.g. `01.researcher`) |
| `instance` | yes | Run instance / first-level partition (e.g. `ai-coding-2025`) |
| `event` | yes | Short slug (`task_start`, `tool_fallback`, `fetch_failed`, `stage_verdict`, …) |
| `msg` | yes | Human-readable description |
| `path` | optional | Relevant deliverable path (log the reference, not the content) |
| *extra* | optional | Any `--key value` pairs (e.g. `stage`, `result`, `criteria-impact`) |

**Timestamp rationale**: local time with an explicit offset is both human-readable and lexically sortable on a single machine (constant offset), avoiding the ambiguity of a bare local time.

**Do not log file contents**: the content already lives on the data bus and in lineage; the log records only references (path, size, hash if needed) to avoid duplication and bloat.

Verdict events (`event` starting with `verdict` / `stage_verdict`) are special: the journal keeps them at every level, including `none`.

### Reference Implementation: `scripts/log.sh`

The generator writes this verbatim into `project/scripts/` (following the STR-09 precedent of generating a script into `scripts/`). Keeping a single canonical implementation guarantees identical log format across all projects. It depends only on `bash`, `date`, `grep`, `sed`—no `jq`/YAML parser required.

```bash
#!/usr/bin/env bash
# log.sh — POMASA QUA-04 Observable Execution Logging
#
# Append one structured JSON line to a JSONL log, honoring the project's
# observability level read from config.yml. Generated into project/scripts/
# by the POMASA generator when QUA-04 is adopted.
#
# Usage:
#   scripts/log.sh --instance <ID> --target <log|journal> --agent <name> \
#                  --level <INFO|WARN|ERROR> --event <slug> --msg "<text>" \
#                  [--path <relpath>] [--criteria-impact <none|partial|fail>] \
#                  [--key value ...]
#
# --target log     -> workspace/<instance>/<agent-stage-dir>/_log.jsonl  (agent self-log)
# --target journal -> workspace/<instance>/_journal/run.jsonl            (orchestrator ledger)
#
# Level gating by observability level (from config.yml `observability:`):
#   none     : _log suppressed entirely; journal keeps only verdict events
#   minimal  : ERROR only (journal also keeps call + verdict events)
#   normal   : ERROR + WARN          (default)
#   detailed : ERROR + WARN + INFO
#
# Exit codes: 0 = written or intentionally skipped; 2 = usage error.
set -euo pipefail

# --- locate project root (scripts/ lives directly under it) -----------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CONFIG_FILE="$PROJECT_ROOT/config.yml"

# --- read observability level (no YAML parser dependency) -------------------
# Matches a line like:  observability: normal   (optionally quoted, # comments ok)
read_obs_level() {
  local lvl=""
  if [[ -f "$CONFIG_FILE" ]]; then
    lvl="$(grep -E '^[[:space:]]*observability[[:space:]]*:' "$CONFIG_FILE" 2>/dev/null \
      | head -n1 | sed -E 's/^[^:]*:[[:space:]]*//; s/[[:space:]]*#.*$//; s/^"//; s/"$//; s/^'"'"'//; s/'"'"'$//' \
      | tr -d '[:space:]')"
  fi
  echo "${lvl:-normal}"   # default normal when unset/missing
}

# --- arg parsing ------------------------------------------------------------
INSTANCE="" TARGET="log" AGENT="" LEVEL="INFO" EVENT="" MSG="" RELPATH=""
declare -a EXTRA_KEYS=() EXTRA_VALS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --instance) INSTANCE="$2"; shift 2 ;;
    --target)   TARGET="$2";   shift 2 ;;
    --agent)    AGENT="$2";    shift 2 ;;
    --level)    LEVEL="$2";    shift 2 ;;
    --event)    EVENT="$2";    shift 2 ;;
    --msg)      MSG="$2";      shift 2 ;;
    --path)     RELPATH="$2";  shift 2 ;;
    --*)        EXTRA_KEYS+=("${1#--}"); EXTRA_VALS+=("$2"); shift 2 ;;
    *) echo "log.sh: unexpected arg: $1" >&2; exit 2 ;;
  esac
done
[[ -n "$INSTANCE" ]] || { echo "log.sh: --instance required" >&2; exit 2; }
LEVEL="$(echo "$LEVEL" | tr '[:lower:]' '[:upper:]')"

# --- gating -----------------------------------------------------------------
OBS="$(read_obs_level)"
is_verdict=false
[[ "$EVENT" == verdict* || "$EVENT" == "stage_verdict" ]] && is_verdict=true

level_rank() { case "$1" in ERROR) echo 3;; WARN) echo 2;; INFO) echo 1;; *) echo 1;; esac; }
min_rank=2  # normal
case "$OBS" in
  none)     min_rank=99 ;;
  minimal)  min_rank=3  ;;
  normal)   min_rank=2  ;;
  detailed) min_rank=1  ;;
esac

if [[ "$TARGET" == "journal" ]]; then
  # Journal always keeps verdict events (quality gate, even under `none`).
  if ! $is_verdict; then
    [[ "$OBS" == "none" ]] && exit 0
    [[ "$(level_rank "$LEVEL")" -lt "$min_rank" ]] && exit 0
  fi
else
  # Agent self-log: fully suppressed under `none` (short-circuit safety net).
  [[ "$OBS" == "none" ]] && exit 0
  [[ "$(level_rank "$LEVEL")" -lt "$min_rank" ]] && exit 0
fi

# --- resolve output path ----------------------------------------------------
if [[ "$TARGET" == "journal" ]]; then
  OUT_DIR="$PROJECT_ROOT/workspace/$INSTANCE/_journal"
  OUT_FILE="$OUT_DIR/run.jsonl"
else
  # agent stage dir derived from --path (its directory) or fallback to agent name
  if [[ -n "$RELPATH" ]]; then
    OUT_DIR="$PROJECT_ROOT/$(dirname "$RELPATH")"
  else
    OUT_DIR="$PROJECT_ROOT/workspace/$INSTANCE/${AGENT:-_agent}"
  fi
  OUT_FILE="$OUT_DIR/_log.jsonl"
fi
mkdir -p "$OUT_DIR"

# --- local timestamp with explicit offset (ISO 8601) ------------------------
TS="$(date +%Y-%m-%dT%H:%M:%S%:z)"

# --- JSON string escaper ----------------------------------------------------
json_escape() {
  local s="$1"
  s="${s//\\/\\\\}"; s="${s//\"/\\\"}"
  s="${s//$'\n'/\\n}"; s="${s//$'\r'/\\r}"; s="${s//$'\t'/\\t}"
  printf '%s' "$s"
}

# --- build and append the JSON line ----------------------------------------
line="{\"ts\":\"$TS\",\"level\":\"$(json_escape "$LEVEL")\",\"agent\":\"$(json_escape "$AGENT")\",\"instance\":\"$(json_escape "$INSTANCE")\",\"event\":\"$(json_escape "$EVENT")\",\"msg\":\"$(json_escape "$MSG")\""
[[ -n "$RELPATH" ]] && line="$line,\"path\":\"$(json_escape "$RELPATH")\""
for i in "${!EXTRA_KEYS[@]}"; do
  line="$line,\"$(json_escape "${EXTRA_KEYS[$i]}")\":\"$(json_escape "${EXTRA_VALS[$i]}")\""
done
line="$line}"

printf '%s\n' "$line" >> "$OUT_FILE"
```

### Blueprint Declaration Template

Every agent Blueprint that logs includes a section like this. The **first line is the `none` short-circuit**—the single boolean an agent must evaluate:

```markdown
## Logging (QUA-04)

First read `config.yml`. **If `observability` is `none`, skip this entire section**
(do not call `scripts/log.sh` at all). Otherwise, call `scripts/log.sh` at these
moments (the script handles level filtering; you do not):

- On starting:        `--level INFO  --event task_start  --msg "..."`
- On degradation /
  scope-reduction /
  any difficulty:     `--level WARN  --event <slug>      --msg "..."`
- On failure:         `--level ERROR --event <slug>      --msg "..."`

Standard call:

    scripts/log.sh --instance {INSTANCE_ID} --target log --agent {THIS_AGENT} \
      --level WARN --event tool_fallback \
      --path {YOUR_OUTPUT_DIR}/_log.jsonl \
      --msg "Write blocked by heuristic; fell back to Bash to write the required deliverable"

**Important**: this Blueprint references the observability level from `config.yml`
and does not restate what each level means (avoids drift). If `log.sh` is
unavailable, append one schema-conformant JSON line to `_log.jsonl` by hand.
```

The Orchestrator Blueprint additionally logs to the journal—an `agent_call` event before each invocation and a `stage_verdict` event after each acceptance check:

```markdown
After verifying a stage against its Blueprint's completion criteria, record the verdict:

    scripts/log.sh --instance {INSTANCE_ID} --target journal --agent 00.orchestrator \
      --level INFO --event stage_verdict --msg "Stage 01 accepted" \
      --stage 01.research --result pass
```

### Generation Checklist

When generating a system with QUA-04 adopted:

- [ ] `config.yml` created in project root with the user's chosen `observability` level
- [ ] `scripts/log.sh` written verbatim from the reference implementation
- [ ] Every agent Blueprint has a `## Logging` section starting with the `none` short-circuit
- [ ] The Orchestrator Blueprint logs `agent_call` and `stage_verdict` to the journal
- [ ] No Blueprint restates level semantics (references `config.yml` only)

## Examples

### A `normal`-level agent log after a degraded run

```jsonl
{"ts":"2026-06-07T20:03:33+08:00","level":"WARN","agent":"01.researcher","instance":"ai-coding-2025","event":"tool_fallback","msg":"Write blocked by workspace heuristic; fell back to Bash to write required deliverable","path":"workspace/ai-coding-2025/01.research/_log.jsonl","criteria-impact":"none"}
{"ts":"2026-06-07T20:05:01+08:00","level":"ERROR","agent":"01.researcher","instance":"ai-coding-2025","event":"fetch_failed","msg":"Source URL returned 404; excluded from findings","path":"workspace/ai-coding-2025/01.research/source_list.md"}
```

The first line is exactly the kind of degradation event that previously lived only in the one-shot tool-return message—now durable and auditable.

### The orchestrator journal under `none`

Even with logging off, the quality gate leaves a trail:

```jsonl
{"ts":"2026-06-07T20:04:05+08:00","level":"INFO","agent":"00.orchestrator","instance":"ai-coding-2025","event":"stage_verdict","msg":"Stage 01 accepted","stage":"01.research","result":"pass"}
```

## Related Patterns

- **[Verifiable Data Lineage](./QUA-03-verifiable-data-lineage.md)**: Orthogonal complement—QUA-03 makes *data* trustworthy, QUA-04 makes *execution* observable
- **[Faithful Agent Instantiation](./BHV-02-faithful-agent-instantiation.md)**: The acceptance verdict logged to `run.jsonl` is part of BHV-02's quality gate; WARN events flag possible self-lowering of criteria
- **[Orchestrated Agent Pipeline](./BHV-01-orchestrated-agent-pipeline.md)**: The Orchestrator is the sole writer of the journal
- **[Filesystem Data Bus](./STR-02-filesystem-data-bus.md)**: Per-instance partitioning of `_log.jsonl` follows the same no-lock conflict-avoidance discipline
- **[Reference Data Configuration](./STR-01-reference-data-configuration.md)**: The observability level is externalized configuration, referenced (not restated) by Blueprints
- **[Deliverable Export Pipeline](./STR-09-deliverable-export-pipeline.md)**: Precedent for generating a script into `project/scripts/`
- **[Parallel Instance Execution](./BHV-03-parallel-instance-execution.md)**: Per-instance log partitioning keeps parallel writes safe

## Checklist

When designing a system with this pattern, confirm:

- [ ] Is logging treated as best-effort (correctness never depends on it)?
- [ ] Are there two streams: orchestrator `run.jsonl` and per-instance `_log.jsonl`?
- [ ] Is each `_log.jsonl` written inside its own agent's output directory (no shared file)?
- [ ] Is the observability level stored in `config.yml`, not passed as a per-call parameter?
- [ ] Do Blueprints reference the level rather than restating its semantics?
- [ ] Does `none` short-circuit in the Blueprint (agent does not call the script)?
- [ ] Are acceptance verdicts still recorded under `none`?
- [ ] Are timestamps local with an explicit offset?
- [ ] Does the log record references (paths) rather than duplicating file contents?
