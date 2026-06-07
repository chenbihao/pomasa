# Observable Execution Logging

**Category**: Quality
**Necessity**: Recommended
**Observation Schema**: `1.1`

## Problem

How can we observe and audit what a multi-agent system actually *did* during a run—not just what it produced—and see, at any moment, **what state each agent is in**?

In a declarative MAS, a subagent communicates with its Orchestrator through two channels:

1. **Filesystem Data Bus (STR-02)**: formal deliverables, persisted and auditable.
2. **Tool-return message (self-report)**: one-shot, never persisted.

Critical *process* information lives only in the second channel and evaporates when the run ends: "the Write tool was blocked by a heuristic, so I fell back to Bash", "the source was unreachable, so I narrowed scope to 4 items", "completion took 3 retries". These **degradation / scope-reduction / difficulty** events appear nowhere in the deliverables and nowhere in the data lineage (QUA-03), yet they are exactly what an auditor or debugger needs.

Two related questions have no durable answer either:

- **What is the current state of each agent?** A human (or a frontend) watching a long run wants to see "01.research is running, 02.report is pending" without replaying a transcript.
- **When an agent stalls or errors, who recorded that, and how?** The Orchestrator may decide a stage timed out and re-dispatch it—but if that decision lives only in the conversation, the run's history loses it.

Without a persistent, structured record of both *events* and *current state*:

- Post-mortem debugging relies on transcripts that may be gone
- Silent degradations (an agent quietly lowering its own bar) go unnoticed
- There is no machine-readable record of *when* each stage ran, *how* it was judged, or *what state* each agent reached
- A human or frontend has nothing simple to read to see live progress

## Context

This pattern applies to the following scenarios:

- Batch or long-running pipelines where transcripts are impractical to review
- Systems where auditability of the *process* (not just the data) matters
- Runs where you want to detect agents deviating from their Blueprints (see BHV-02)
- Systems where a human or a frontend will watch run progress while it executes
- Any system already using the Filesystem Data Bus (STR-02) and an Orchestrator (BHV-01)

This pattern is **orthogonal and complementary to QUA-03**: QUA-03 makes the *data* trustworthy (every conclusion traces to a source); this pattern makes the *execution* observable (what the system did, when, how it was judged, and what state each agent is in).

## Forces

- **Observability vs Token cost**: Every recorder call an agent makes consumes context tokens; full observability is not always wanted
- **Completeness vs Reliability**: A prompt-defined agent may forget to record; observation can never be the basis of correctness
- **Centralized config vs Per-call parameters**: The verbosity level is a run-wide constant, not a per-task input
- **Human-readable vs Machine-parseable**: Auditors read by eye; tooling (and a frontend) parses programmatically
- **History vs Current state**: An audit needs the full sequence of events; a live view needs only the latest value—these want different file shapes
- **Concurrency**: Parallel agents must not corrupt a shared file
- **Zero infrastructure**: The runtime must stay dependency-free (STR-02); no database, no daemon, no `jq`

## Solution

**Record execution as two kinds of artifact under a single `_observation/` tree: append-only event logs (`.jsonl`) and whole-object current-state snapshots (`.json`). Both are written by one dependency-free recorder script (`manager.sh`), partitioned per writer so parallel agents never collide, and gated by a project-level observability level. Treat all of it as best-effort observability—never as a correctness mechanism, never as a control plane.**

### Non-Negotiable Principle: Observation Is Best-Effort, Never a Control Plane

System correctness is guaranteed by **acceptance verification (BHV-02)** and **data lineage (QUA-03)**, never by the presence of a log line or a status file. A prompt-defined agent may forget to record; that must never break the run or invalidate a result.

Two corollaries that the whole design depends on:

- **A status snapshot is a *report*, not a *command*.** `manager.sh` only ever *writes* what the Orchestrator or an agent already decided. It never reads state to make a decision, never kills, retries, or re-dispatches. The Orchestrator may of course decide to re-dispatch a stalled agent—that is ordinary BHV-01 orchestration—but the recorder's job is only to *record* that decision, not to drive it.
- **`self` status `done` is not "done".** Real completion is the Orchestrator's BHV-02 acceptance check against the deliverables on disk. An agent's self-reported state is a low-trust hint only.

### One Tree, Two Writers, Two Artifact Shapes

All observation lives under a single top-level `_observation/` directory (sibling of `workspace/`), so `workspace/` holds only deliverables. Within it, **every folder has exactly one writer**:

```
project/
├── _observation/
│   ├── manager.sh                       # the only recorder; write-only
│   └── {INSTANCE}/                       # one run (STR-02 first-level partition; omitted for one-shot systems)
│       ├── run_manifest.json             # static plan, written ONCE by the Orchestrator (not by manager.sh)
│       ├── 00.orchestrator/              # ← only the Orchestrator writes here
│       │   ├── run.jsonl                  #   ledger: agent_call / stage_enter / stage_exit / stage_verdict  (append)
│       │   └── assigned/
│       │       └── {KEY}.json             #   the Orchestrator's assigned state for one agent  (overwrite)
│       └── {KEY}/                        # ← only that sub-agent writes here
│           ├── _log.jsonl                 #   the agent's own INFO/WARN/ERROR events  (append)
│           └── status.json                #   the agent's self-reported state  (overwrite)
├── workspace/                            # deliverables only — no observation files
└── config.yml                            # holds the observability level (STR-01)
```

| Artifact | Shape | Sole writer | Records |
|----------|-------|-------------|---------|
| **`run.jsonl`** | append-only JSONL | Orchestrator | Each invocation + stage boundary + **acceptance verdict** |
| **`{KEY}/_log.jsonl`** | append-only JSONL | that agent instance | That instance's own INFO/WARN/ERROR events |
| **`assigned/{KEY}.json`** | whole-object JSON | Orchestrator | The state the Orchestrator *assigns* an agent (`running` / `timed_out` / `done` / …) |
| **`{KEY}/status.json`** | whole-object JSON | that agent instance | The agent's *self-reported* state (`running` / `done` / `failed`) |

**Why `.jsonl` for events and `.json` for state.** An audit needs the full *history* of what happened, so events are append-only JSONL—each call is one `>>`-appended line, no read-modify-write, safe under concurrent appends, `tail -f`-able. A live view needs only the *latest value*, so state is a whole-object JSON snapshot, overwritten in place—a frontend `fetch`es one object and renders it. Forcing one shape on both breaks: a single JSON event log needs an O(n) rewrite per append; a JSONL status stream forces a reader to fold every line and grows without bound. The two shapes are the event-log / current-state-projection split, and keeping them distinct is deliberate—do not "unify" them.

### Two Status Streams: `self` (low trust) vs `assigned` (authoritative)

State has two independent writers, mirroring the two log streams:

- **`status.json` (self)** — written by the agent itself. Low trust: it says only "what the agent last reported about itself". A crashed or stalled agent typically leaves this stuck at `running`, because it never got the chance to write `done`/`failed`.
- **`assigned/{KEY}.json` (assigned)** — written by the Orchestrator. Authoritative for "what actually happened to this agent", because its writer is also the actor and the verifier (no self-attestation problem).

**Merge rule (for any consumer—human, frontend, dashboard):** when the two disagree, **`assigned` wins** for "what really happened"; `self` only ever means "the agent's last self-report". A view showing `self=running, assigned=timed_out` is not a bug—it is exactly the useful signal that the agent believed it was working while the Orchestrator judged it stalled.

**Heartbeat comes for free.** Every `_log.jsonl` line carries a `ts`; the **timestamp of an agent's last log line is its last sign of life**. A consumer detecting "stuck" reads that tail `ts`—the recorder writes nothing extra. Caveat to state plainly: heartbeat resolution equals recorder-call frequency. An agent deep inside one long web fetch (not calling the recorder) will look stale though it is alive—so this is a **coarse liveness hint, not precise monitoring**, and must never be the sole basis for declaring an agent dead.

### Per-Writer Partitioning Makes Concurrency Safe

The filesystem has no locking (STR-02). Safety comes from **one writer per file**, not from locks. Each agent instance writes only inside its own `_observation/{INSTANCE}/{KEY}/`; the Orchestrator owns `_observation/{INSTANCE}/00.orchestrator/`. Parallel instances (BHV-03) physically cannot collide because their `{KEY}`s differ.

**The `{KEY}` carries the partition identity.** When observation lived inside each agent's *output* directory, uniqueness was free—the output dir was already partitioned by entity. Centralizing under `_observation/` removes that free uniqueness, so `{KEY}` must now encode the *same* distinguishing detail as the deliverable partition: use `{stage}.{entity}` for parallel / fan-out instances, or the blueprint/stage name for a one-shot agent. This is the single hard rule introduced by centralization.

Status snapshots add no concurrency hazard despite being overwritten: each is a single-writer file, and `manager.sh` writes via temp-file-and-atomic-rename, so a concurrent reader never sees a half-written file.

### Observability Levels

A single project-wide level controls verbosity:

| Level | `_log.jsonl` (agent self-log) | `status.json` (self) | `run.jsonl` (orchestrator ledger) | `assigned/*.json` |
|-------|-------------------------------|----------------------|-----------------------------------|-------------------|
| `none` | not produced | not produced | **verdicts only** | **still written** |
| `minimal` | ERROR only | written | verdicts + ledger events | written |
| `normal` *(default)* | ERROR + WARN (incl. degradation / scope-reduction / difficulty) | written | verdicts + ledger events | written |
| `detailed` | all (incl. INFO milestones) | written | all + invocation parameters | written |

Three deliberate choices:

- **`none` is short-circuit, not filter.** Its purpose is to save tokens. Tokens are spent by the *act of calling* `manager.sh` (the command text and its return enter the agent's context), so under `none` the agent must skip the recording steps in its Blueprint entirely and not call the script at all. The script *also* returns early on `none` for the agent self-log and self-status, as a safety net for hand-written fallbacks.
- **`none` still keeps acceptance verdicts and assigned status.** A verdict is part of the BHV-02 *quality gate*; assigned status is the Orchestrator's own ledger of what it did to each agent. Both are orchestration record, not pure agent self-observation, so even with all agent logging off, a failed run is never completely opaque.
- **Ledger events are not level-ranked.** The Orchestrator logs only structural milestones to `run.jsonl` (a handful per stage); `agent_call` / `stage_enter` / `stage_exit` are kept at every level except `none`. `detailed` differs by carrying *more invocation parameters per event*, not more events. Only the agent self-log is level-ranked (ERROR / +WARN / +INFO).

### Level Is Configuration, Not a Parameter

The observability level is a **run-wide constant**, so it belongs to project configuration (STR-01), **not** to the per-call parameters of BHV-02. It is stored once in `config.yml` and read independently by three parties:

- **Orchestrator** reads it to decide how much to write to `run.jsonl`
- **Each agent** reads it only to answer one boolean: "is it `none`?" → whether to record at all
- **`manager.sh`** reads it to do the `minimal`/`normal`/`detailed` fine-grained filtering

Agents never see the fine-grained distinctions; changing verbosity means editing one config key, not N Blueprints. As with all reference configuration (STR-01), Blueprints **reference** the config but **never restate** its meaning, to prevent drift.

## Consequences

### Benefits

- **Process auditability**: A durable, machine-readable record of what ran, when, and how it was judged
- **Live, frontend-friendly state**: `status.json` snapshots are exactly what a human or a UI reads to see progress—no transcript replay, no fold logic in the reader
- **Catches silent degradation**: WARN events surface agents lowering their own bar (a BHV-02 violation signal)
- **Self-vs-assigned divergence is visible**: a stalled agent's `self=running, assigned=timed_out` is a first-class, readable signal
- **No concurrency hazard**: One writer per file (+ atomic rename for snapshots) means parallel agents never corrupt a shared file
- **Clean separation**: `workspace/` holds only deliverables; all observation is under one `_observation/` tree
- **Token-aware**: `none` truly costs nothing; verbosity scales to need
- **Tooling-friendly**: JSONL is trivially parsed (`tail -f`, `json.loads`) and JSON snapshots are one `fetch` for a frontend
- **Zero dependency**: bash + `date`/`grep`/`sed` only; status uses whole-object overwrite to avoid needing `jq`

### Liabilities

- **Best-effort only**: A forgetful agent may omit a line or a snapshot; observation is not a guarantee of what happened
- **Status can lie or lag**: `self` may be stale (the heartbeat caveat); `assigned` is only as current as the Orchestrator's last write at a stage boundary
- **Token overhead** at `detailed`: Many recorder calls consume context
- **Relies on convention**: Like STR-03 isolation, enforced by Blueprint discipline, not by the runtime
- **`{KEY}` discipline**: Centralizing under `_observation/` means a wrong/duplicated `{KEY}` can collide; the partition rule must be followed
- **Config drift risk**: If a Blueprint restates level semantics instead of referencing the config (mitigated by the STR-01 reference rule)

## Implementation Guidelines

### Observation Schema Version

The observation layout is versioned so consumers (a frontend, a dashboard, an external `pomasa-dashboard` tool) can declare which contract they support. **The schema is owned by this pattern, not by any tool.**

| Version | Contents | Compatibility |
|---------|----------|---------------|
| `1.0` | logs only (`run.jsonl` / `_log.jsonl`) under `workspace/` | original QUA-04, retroactively named |
| `1.1` | `_observation/` tree; `+ run_manifest.json`; `+ self/assigned status snapshots`; `+ stage_enter/stage_exit ledger events`; state-derivation rules | MINOR, additive |

`1.0 → 1.1` is **MINOR (purely additive)**: a 1.0 log can still derive `done`/`failed`/`running` (just not `pending`, for lack of a manifest); old consumers ignore new fields. Semantics: MAJOR = breaking change to field meaning; MINOR = new fields only. The version is recorded in two places (both written into the generated project): `run_manifest.json`'s `schema_version`, and the first line of `run.jsonl` as a self-describing `run_start` meta event.

### Run Decision: State Derivation vs Persisted State

This pattern persists `status.json`/`assigned` snapshots **and** keeps the `run.jsonl` event log, on purpose:

- `run.jsonl` is the **authoritative history**: an append-only event log. Current state is always *derivable* from it by folding events in append order (`agent_call`/`stage_enter` → `running`; `stage_verdict`/`stage_exit` → `done`/`failed`; later events overwrite earlier, so a retry just appends and the fold follows automatically).
- The `status.json`/`assigned` snapshots are a **materialized current-state view** of that same history, written at stage boundaries so a frontend can read state cheaply. They are a cache, not a second source of truth: if they are missing or stale, a consumer can always rebuild state by folding `run.jsonl`.

Read in append order, **not** sorted by `ts`: `run.jsonl` is single-writer append, so file order is causal order; `ts` is only a same-machine wall clock. To compute `pending`, a consumer needs the planned stage list, which is exactly what `run_manifest.json` supplies. A 1.0 log without a manifest can still yield `running`/`done`/`failed`; only `pending` is unknowable. Under `none`, only verdicts exist, so `running` is not derivable—show a non-terminal stage as `pending`/`unknown`, not as "stuck".

### `run_manifest.json`

Written **once** by the Orchestrator at start (immutable thereafter—if it could be rewritten mid-run it would drift toward being a state file / control plane). It declares only the *static stage skeleton*, never status. Dynamic fan-out leaves (BHV-03/04) are not enumerated; a stage marks `"fanout": "dynamic"` and its leaf count is observed from `run.jsonl`.

```jsonc
// _observation/{INSTANCE}/run_manifest.json
{
  "schema_version": "1.1",
  "instance": "ai-trends-2026",
  "created": "2026-06-08T09:00:00+08:00",
  "stages": [
    { "id": "01.research", "agent": "01.researcher", "depends_on": [], "fanout": "none" },
    { "id": "02.report",   "agent": "02.reporter",   "depends_on": ["01.research"], "fanout": "none" }
  ]
}
```

### `config.yml`

Generated into the project root. Carries project-level runtime configuration; QUA-04 introduces it with a single `observability` key, designed to be shared by future runtime-config needs.

```yaml
# POMASA project-level runtime configuration.
# Introduced by QUA-04; extensible for future runtime config.
# Blueprints READ values here but do not restate their meaning (avoids drift).

# observability: none | minimal | normal | detailed
observability: normal
```

### Generated-Project `.gitignore`

Observation data is run output and is normally not committed, but the recorder script is. With `manager.sh` living at the root of `_observation/`, ignore only the per-instance subdirectories:

```gitignore
# Keep _observation/manager.sh; ignore the run data under it
_observation/*/
```

### Log Line Schema

Every line in a `.jsonl` is one JSON object. Common fields:

| Field | Always? | Meaning |
|-------|---------|---------|
| `ts` | yes | Local timestamp, ISO 8601 **with explicit offset** (e.g. `2026-06-08T09:03:33+08:00`) |
| `level` | yes | `INFO` / `WARN` / `ERROR` |
| `agent` | yes | Agent name (e.g. `01.researcher`) |
| `instance` | yes | Run instance / first-level partition (e.g. `ai-trends-2026`) |
| `event` | yes | Short slug (`task_start`, `tool_fallback`, `agent_call`, `stage_enter`, `stage_exit`, `stage_verdict`, …) |
| `msg` | yes | Human-readable description |
| `path` | optional | Relevant deliverable path (log the reference, not the content) |
| *extra* | optional | Any `--key value` pairs (e.g. `stage`, `result`, `criteria-impact`) |

**Timestamp rationale**: local time with an explicit offset is both human-readable and lexically sortable on a single machine (constant offset), avoiding the ambiguity of a bare local time.

**Do not log file contents**: the content already lives on the data bus and in lineage; the log records only references (path, size, hash if needed) to avoid duplication and bloat.

Verdict events (`event` starting with `verdict` / `stage_verdict`) are special: the journal keeps them at every level, including `none`.

### Status Snapshot Schema

Every `status.json` / `assigned/{KEY}.json` is one whole JSON object, overwritten each time. Fields:

| Field | Always? | Meaning |
|-------|---------|---------|
| `ts` | yes | When this snapshot was written (ISO 8601 with offset) |
| `by` | yes | `self` (the agent) or `assigned` (the Orchestrator) |
| `state` | yes | A state slug (see vocabulary below) |
| `agent` | yes | Agent name |
| `key` | yes | Partition key (`{stage}.{entity}` or blueprint name) |
| `instance` | yes | Run instance |
| `detail` | optional | Human-readable note (e.g. "5min no return, judged timed out") |
| `path` | optional | Relevant deliverable path |
| *extra* | optional | Any `--key value` pairs |

**State vocabulary** (slugs, convention only—not enforced by the script):

- **`self`** (low trust): `running` / `done` / `failed`
- **`assigned`** (authoritative): `pending` / `running` / `done` / `failed` / `timed_out` / `error` / `superseded`
  - `timed_out` — the Orchestrator judged the agent stalled (a heuristic—see heartbeat caveat)
  - `error` — the runtime returned an error for this invocation
  - `superseded` — this instance was replaced by a re-dispatched one; mark the old `{KEY}` so the view shows it was abandoned, not completed

### Reference Implementation: `_observation/manager.sh`

The generator copies [`scripts/manager.sh`](./scripts/manager.sh) **verbatim** into the generated project's `_observation/` directory. This file is the single canonical source—keeping one implementation guarantees an identical observation format across all projects, and a frontend/dashboard can target one stable contract. It depends only on `bash`, `date`, `grep`, `sed`—no `jq`/YAML parser. (The full source lives in the script file and is intentionally **not** duplicated here, to avoid the drift an embedded copy invites.)

Its contract, in one paragraph: **write-only, no control decisions, one writer per folder, zero dependency.** Two subcommands:

```bash
# append one event line (target: log = agent self-log, journal = orchestrator ledger)
manager.sh log    --instance {INSTANCE} --target {log|journal} --agent {NAME} \
                  [--key {KEY}] --level {INFO|WARN|ERROR} --event {slug} \
                  --msg "..." [--path {relpath}] [--key value ...]

# overwrite one current-state snapshot (by: self = agent, assigned = orchestrator)
manager.sh status --instance {INSTANCE} --by {self|assigned} --agent {NAME} \
                  [--key {KEY}] --state {slug} [--detail "..."] [--key value ...]
```

`status` writes by whole-object atomic overwrite (so no `jq`, no half-written reads); `self` status is suppressed under `none`, `assigned` status is always written. The script is **write-only by design**: it never reads state to decide anything—consumers (humans, a frontend) read the files directly.

### Blueprint Declaration Template

Every agent Blueprint that records includes a section like this. The **first line is the `none` short-circuit**—the single boolean an agent must evaluate:

```markdown
## Observation (QUA-04)

First read `config.yml`. **If `observability` is `none`, skip this entire section**
(do not call `_observation/manager.sh` at all). Otherwise, your partition key is
`{KEY}` (passed by the Orchestrator). Call `_observation/manager.sh` at these moments
(the script handles level filtering; you do not):

- On starting:        `status --by self --state running`
                      `log --level INFO  --event task_start --msg "..."`
- On degradation /
  scope-reduction /
  any difficulty:     `log --level WARN  --event <slug>     --msg "..."`
- On failure:         `status --by self --state failed`
                      `log --level ERROR --event <slug>     --msg "..."`
- On finishing:       `status --by self --state done`
                      `log --level INFO  --event task_done  --msg "..."`

Standard calls:

    _observation/manager.sh log --instance {INSTANCE} --target log \
      --agent {THIS_AGENT} --key {KEY} \
      --level WARN --event tool_fallback \
      --msg "Write blocked by heuristic; fell back to Bash to write the deliverable"

    _observation/manager.sh status --instance {INSTANCE} --by self \
      --agent {THIS_AGENT} --key {KEY} --state running --detail "collecting sources"

**Important**: this Blueprint references the observability level from `config.yml`
and does not restate what each level means (avoids drift). Your `self` status is a
low-trust hint, not proof of completion—the Orchestrator verifies your deliverables.
If `manager.sh` is unavailable, append one schema-conformant line/object by hand.
```

The Orchestrator Blueprint additionally: writes `run_manifest.json` once at start; logs `agent_call` before each invocation and `stage_verdict` after each acceptance check; and writes `assigned` status at each stage boundary (including `timed_out` / `error` / `superseded` when it judges an agent stalled and re-dispatches):

```markdown
On dispatching a stage:

    _observation/manager.sh status --instance {INSTANCE} --by assigned \
      --agent 01.researcher --key 01.research --state running --detail "dispatched"
    _observation/manager.sh log --instance {INSTANCE} --target journal \
      --agent 00.orchestrator --level INFO --event agent_call \
      --msg "dispatch 01.researcher" --stage 01.research --blueprint agents/01.researcher.md

After verifying a stage against its Blueprint's completion criteria:

    _observation/manager.sh log --instance {INSTANCE} --target journal \
      --agent 00.orchestrator --level INFO --event stage_verdict \
      --msg "Stage 01 accepted" --stage 01.research --result pass
    _observation/manager.sh status --instance {INSTANCE} --by assigned \
      --agent 01.researcher --key 01.research --state done

If a dispatched agent returns a timeout/error, or the Orchestrator judges it stalled
and re-dispatches, record it (this does NOT drive the decision—it records it):

    _observation/manager.sh status --instance {INSTANCE} --by assigned \
      --agent 01.researcher --key 01.research --state timed_out \
      --detail "no return in 5min; re-dispatching as 01.research.retry"
```

### Generation Checklist

When generating a system with QUA-04 adopted:

- [ ] `config.yml` created in project root with the user's chosen `observability` level
- [ ] `_observation/manager.sh` copied verbatim from the reference implementation
- [ ] Generated-project `.gitignore` keeps `manager.sh` but ignores `_observation/*/`
- [ ] Orchestrator Blueprint writes `run_manifest.json` once at start (with `schema_version`)
- [ ] Orchestrator Blueprint writes `run_start` as the first `run.jsonl` line (carrying `schema_version`)
- [ ] Every agent Blueprint has an `## Observation` section starting with the `none` short-circuit
- [ ] Every agent Blueprint is told its `{KEY}` and writes `self` status at start / finish / failure
- [ ] The Orchestrator Blueprint logs `agent_call`, `stage_verdict`, and writes `assigned` status at stage boundaries
- [ ] No Blueprint restates level semantics (references `config.yml` only)

## Examples

### A `normal`-level run: ledger, self-log, and the two status streams

`_observation/ai-trends-2026/00.orchestrator/run.jsonl` (Orchestrator ledger):

```jsonl
{"ts":"2026-06-08T09:00:00+08:00","level":"INFO","agent":"00.orchestrator","instance":"ai-trends-2026","event":"run_start","schema_version":"1.1","msg":"run started"}
{"ts":"2026-06-08T09:00:01+08:00","level":"INFO","agent":"00.orchestrator","instance":"ai-trends-2026","event":"agent_call","msg":"dispatch 01.researcher","stage":"01.research","blueprint":"agents/01.researcher.md"}
{"ts":"2026-06-08T09:05:09+08:00","level":"INFO","agent":"00.orchestrator","instance":"ai-trends-2026","event":"stage_verdict","msg":"Stage 01 accepted: 7 findings (>=5), sources complete","stage":"01.research","result":"pass"}
```

`_observation/ai-trends-2026/01.research/_log.jsonl` (agent self-log, after a degraded run):

```jsonl
{"ts":"2026-06-08T09:03:33+08:00","level":"WARN","agent":"01.researcher","instance":"ai-trends-2026","event":"tool_fallback","msg":"Write blocked by workspace heuristic; fell back to Bash","criteria-impact":"none"}
```

The two status snapshots after the stage is accepted:

```jsonc
// 01.research/status.json  (self)
{"ts":"2026-06-08T09:05:00+08:00","by":"self","state":"done","agent":"01.researcher","key":"01.research","instance":"ai-trends-2026"}
// 00.orchestrator/assigned/01.research.json  (assigned, authoritative)
{"ts":"2026-06-08T09:05:09+08:00","by":"assigned","state":"done","agent":"01.researcher","key":"01.research","instance":"ai-trends-2026"}
```

### A stalled agent: self and assigned diverge

```jsonc
// 01.research/status.json  (self — stuck, never got to write done)
{"ts":"2026-06-08T09:01:10+08:00","by":"self","state":"running","agent":"01.researcher","key":"01.research","instance":"ai-trends-2026","detail":"fetching sources"}
// 00.orchestrator/assigned/01.research.json  (assigned — Orchestrator judged it stalled)
{"ts":"2026-06-08T09:06:10+08:00","by":"assigned","state":"timed_out","agent":"01.researcher","key":"01.research","instance":"ai-trends-2026","detail":"no return in 5min; re-dispatching"}
```

A consumer applies the merge rule (`assigned` wins for "what happened") and shows `01.research` as timed out, while still surfacing that the agent itself believed it was running—the exact divergence signal that is otherwise lost.

### The orchestrator ledger under `none`

Even with logging off, the quality gate and the assigned ledger leave a trail:

```jsonl
{"ts":"2026-06-08T09:05:09+08:00","level":"INFO","agent":"00.orchestrator","instance":"ai-trends-2026","event":"stage_verdict","msg":"Stage 01 accepted","stage":"01.research","result":"pass"}
```

(plus `assigned/01.research.json` with `state:"done"`; no `_log.jsonl`, no self `status.json`).

## Related Patterns

- **[Verifiable Data Lineage](./QUA-03-verifiable-data-lineage.md)**: Orthogonal complement—QUA-03 makes *data* trustworthy, QUA-04 makes *execution* observable
- **[Faithful Agent Instantiation](./BHV-02-faithful-agent-instantiation.md)**: The acceptance verdict logged to `run.jsonl` and the `assigned` status are part of BHV-02's quality gate; `self` status `done` is never proof of completion; WARN events flag possible self-lowering of criteria
- **[Orchestrated Agent Pipeline](./BHV-01-orchestrated-agent-pipeline.md)**: The Orchestrator is the sole writer of the journal and of `assigned` status; re-dispatch decisions are ordinary BHV-01 orchestration, merely *recorded* here
- **[Filesystem Data Bus](./STR-02-filesystem-data-bus.md)**: `_observation/` is a sibling of `workspace/`; per-writer partitioning follows the same no-lock conflict-avoidance discipline; `{INSTANCE}` is STR-02's first-level partition
- **[Workspace Isolation](./STR-03-workspace-isolation.md)**: `_observation/` is inside the project boundary; like isolation, the `{KEY}` and write-only disciplines are enforced by Blueprint convention, not the runtime
- **[Reference Data Configuration](./STR-01-reference-data-configuration.md)**: The observability level is externalized configuration, referenced (not restated) by Blueprints
- **[Deliverable Export Pipeline](./STR-09-deliverable-export-pipeline.md)**: Precedent for generating a script (`export.sh`) into the project; `manager.sh` follows the same generate-a-script approach
- **[Parallel Instance Execution](./BHV-03-parallel-instance-execution.md)**: Per-writer partitioning by `{KEY}` keeps parallel writes safe; dynamic fan-out leaf counts are observed from `run.jsonl`, not pre-enumerated in the manifest

## Checklist

When designing a system with this pattern, confirm:

- [ ] Is all observation treated as best-effort (correctness never depends on it) and write-only (never a control plane)?
- [ ] Is everything under one `_observation/` tree, leaving `workspace/` for deliverables only?
- [ ] Are there two log streams (orchestrator `run.jsonl`, per-instance `_log.jsonl`) and two status streams (`self` `status.json`, `assigned/*.json`)?
- [ ] Does every folder have exactly one writer, and does `{KEY}` carry the deliverable partition's distinguishing detail?
- [ ] Are events append-only `.jsonl` and current-state whole-object `.json` (snapshots overwritten, not appended)?
- [ ] Is the merge rule clear (assigned wins for "what happened"; self is a low-trust hint; self `done` ≠ accepted)?
- [ ] Is the observability level stored in `config.yml`, not passed as a per-call parameter?
- [ ] Do Blueprints reference the level rather than restating its semantics?
- [ ] Does `none` short-circuit in the Blueprint (agent does not call the script), while verdicts and assigned status are still recorded?
- [ ] Is `run_manifest.json` written once (immutable) with a `schema_version`, and is `run_start` the first ledger line?
- [ ] Are timestamps local with an explicit offset, and is current state derivable by folding `run.jsonl` in append order?
- [ ] Does the log record references (paths) rather than duplicating file contents?
