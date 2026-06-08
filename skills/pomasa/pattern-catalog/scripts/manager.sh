#!/usr/bin/env bash
# manager.sh — POMASA QUA-04 Observable Execution: unified write-only recorder
#
# A single, dependency-free recorder that BOTH the Orchestrator and every
# sub-agent call to write observation data into the project's `_observation/`
# tree. Two public commands:
#
#   init       — create the directory tree and run_manifest.json (called ONCE
#                by the Orchestrator at run start)
#   checkpoint — record one event (always) and optionally update a status
#                snapshot (when --state is provided). A single command replaces
#                the former separate log/status calls, eliminating the risk of
#                an agent forgetting one of the two.
#
# Design contract (do not break):
#   * WRITE-ONLY. This script never reads/aggregates state. Consumers (humans,
#     a frontend, a dashboard) read the files directly. Keeping it write-only
#     keeps logging best-effort and prevents it from becoming a control plane.
#   * NO CONTROL DECISIONS. The script records what the Orchestrator/agent
#     decided; it never kills, retries, or re-dispatches anything.
#   * SINGLE WRITER PER FOLDER. Each agent writes only inside its own
#     `_observation/<instance>/<key>/`; the Orchestrator owns
#     `_observation/<instance>/00.orchestrator/`. No shared file, no locking
#     needed (STR-02 filesystem has no locks).
#   * ZERO DEPENDENCY. bash + date + grep + sed only. No jq / YAML parser.
#     That is why status snapshots are written by WHOLE-OBJECT OVERWRITE
#     (printf > file) rather than field-level read-modify-write.
#
# Layout (this script lives at the root of `_observation/`):
#   _observation/
#   ├── manager.sh
#   └── <instance>/
#       ├── run_manifest.json                 # static plan, written by init
#       ├── 00.orchestrator/                  # ← only O writes here
#       │   ├── run.jsonl                      #   ledger: agent_call / stage_verdict (append)
#       │   └── assigned/<key>.json            #   O's assigned status for one agent (overwrite)
#       ├── <key>/                            # ← only that sub-agent writes here
#       │   ├── _log.jsonl                     #   self-log (append) → tail line ts == last heartbeat
#       │   └── status.json                    #   self status (overwrite)
#       └── _fallback/                        # ← unrecognized keys land here (not silently dropped)
#           ├── _log.jsonl                     #   all fallback events (each line keeps original key)
#           └── status.json                    #   fallback status if --state was provided
#
# Usage:
#   manager.sh init --instance <ID> --stages '<key>:<agent>,...'
#
#   manager.sh checkpoint --instance <ID> --agent <name> \
#              --target <log|journal> --level <INFO|WARN|ERROR> --event <slug> \
#              --msg "<text>" [--key <K>] [--state <slug>] [--by <self|assigned>] \
#              [--detail "<text>"] [--path <relpath>] [--key value ...]
#
#   checkpoint behavior:
#     * ALWAYS appends one JSONL event line
#     * If --state is provided → also writes a status snapshot (self or assigned)
#     * If --state is omitted  → only appends the event, status unchanged
#
#   <key> is the agent's partition key. It MUST carry the same distinguishing
#   detail as the deliverable partition: use "<stage>.<entity>" for parallel /
#   fan-out instances, or the blueprint/stage name for a one-shot agent.
#   Defaults to --agent when omitted.
#
#   Fallback: if <key> is not in the manifest stages and is not "00.orchestrator",
#   the event is redirected to _fallback/ instead of being silently dropped.
#   A warning is printed to stderr. This ensures observation data is never lost.
#
# Gating by observability level (config.yml `observability:`):
#   none     : self-log + self-status suppressed entirely;
#              journal keeps only verdict events; assigned status still kept.
#   minimal  : ERROR only          (journal also keeps call + verdict events)
#   normal   : ERROR + WARN         (default)
#   detailed : ERROR + WARN + INFO
#   Status snapshots are not level-ranked: self status writes unless `none`;
#   assigned status ALWAYS writes (it is part of the orchestration ledger).
#
# Exit codes: 0 = written or intentionally skipped; 2 = usage error.
set -euo pipefail

# --- locate roots (this script lives at the root of _observation/) ----------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OBS_DIR="$SCRIPT_DIR"                          # _observation/
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"   # project root
CONFIG_FILE="$PROJECT_ROOT/config.yml"

# --- read observability level (no YAML parser dependency) -------------------
read_obs_level() {
  local lvl=""
  if [[ -f "$CONFIG_FILE" ]]; then
    lvl="$(grep -E '^[[:space:]]*observability[[:space:]]*:' "$CONFIG_FILE" 2>/dev/null \
      | head -n1 | sed -E 's/^[^:]*:[[:space:]]*//; s/[[:space:]]*#.*$//; s/^"//; s/"$//; s/^'"'"'//; s/'"'"'$//' \
      | tr -d '[:space:]')"
  fi
  echo "${lvl:-normal}"   # default normal when unset/missing
}

# --- local timestamp with explicit offset (ISO 8601, lexically sortable) ----
ts() { date +%Y-%m-%dT%H:%M:%S%:z; }

# --- JSON string escaper ----------------------------------------------------
json_escape() {
  local s="$1"
  s="${s//\\/\\\\}"; s="${s//\"/\\\"}"
  s="${s//$'\n'/\\n}"; s="${s//$'\r'/\\r}"; s="${s//$'\t'/\\t}"
  printf '%s' "$s"
}

level_rank() { case "$1" in ERROR) echo 3;; WARN) echo 2;; INFO) echo 1;; *) echo 1;; esac; }

# --- load valid keys from manifest (for _fallback/ validation) ---------------
# Returns a newline-separated list of stage ids + "00.orchestrator".
# If no manifest exists, returns empty (all keys accepted — backward compat).
valid_keys() {
  local manifest="$OBS_DIR/$1/run_manifest.json"
  if [[ ! -f "$manifest" ]]; then
    return   # empty = accept all
  fi
  # Extract ALL "id" values from manifest using grep -oE (no jq dependency).
  # The manifest may be a single line, so grep -oE finds every occurrence.
  grep -oE '"id"[[:space:]]*:[[:space:]]*"[^"]+"' "$manifest" 2>/dev/null \
    | sed -E 's/"id"[[:space:]]*:[[:space:]]*"([^"]+)"/\1/' \
    || true
  echo "00.orchestrator"
}

# --- resolve key: if not in manifest, redirect to _fallback -----------------
# Sets RESOLVED_KEY and IS_FALLBACK.
resolve_key() {
  local instance="$1" key="$2"
  local vk
  vk="$(valid_keys "$instance")" || true
  if [[ -z "$vk" ]] || echo "$vk" | grep -qx "$key"; then
    RESOLVED_KEY="$key"
    IS_FALLBACK=false
  else
    RESOLVED_KEY="_fallback"
    IS_FALLBACK=true
  fi
}

# --- internal: append one JSONL line ----------------------------------------
_internal_log() {
  local INSTANCE="$1" TARGET="$2" AGENT="$3" KEY="$4" \
        LEVEL="$5" EVENT="$6" MSG="$7" RELPATH="$8"
  shift 8
  local -a EK=() EV=()
  while [[ $# -gt 0 ]]; do
    EK+=("$1"); EV+=("$2"); shift 2
  done

  LEVEL="$(printf '%s' "$LEVEL" | tr '[:lower:]' '[:upper:]')"

  local OBS; OBS="$(read_obs_level)"
  local is_verdict=false
  [[ "$EVENT" == verdict* || "$EVENT" == "stage_verdict" ]] && is_verdict=true

  local min_rank=2  # normal (self-log only)
  case "$OBS" in
    none) min_rank=99 ;; minimal) min_rank=3 ;; normal) min_rank=2 ;; detailed) min_rank=1 ;;
  esac

  local OUT_DIR OUT_FILE
  if [[ "$TARGET" == "journal" ]]; then
    # Journal is the orchestration ledger. Verdicts survive even `none` (they are
    # the BHV-02 quality gate). All other ledger events are kept at every level
    # EXCEPT `none`.
    if ! $is_verdict && [[ "$OBS" == "none" ]]; then return 0; fi
    OUT_DIR="$OBS_DIR/$INSTANCE/00.orchestrator"
    OUT_FILE="$OUT_DIR/run.jsonl"
  else
    # Agent self-log: fully suppressed under `none`, otherwise level-ranked.
    [[ "$OBS" == "none" ]] && return 0
    [[ "$(level_rank "$LEVEL")" -lt "$min_rank" ]] && return 0
    # Resolve key for fallback
    local RESOLVED_KEY IS_FALLBACK
    resolve_key "$INSTANCE" "$KEY"
    if $IS_FALLBACK; then
      echo "[QUA-04] key '$KEY' not in manifest; redirected to _fallback/" >&2
    fi
    OUT_DIR="$OBS_DIR/$INSTANCE/$RESOLVED_KEY"
    OUT_FILE="$OUT_DIR/_log.jsonl"
  fi
  mkdir -p "$OUT_DIR"

  local TS; TS="$(ts)"
  local line
  line="{\"ts\":\"$TS\",\"level\":\"$(json_escape "$LEVEL")\",\"agent\":\"$(json_escape "$AGENT")\",\"instance\":\"$(json_escape "$INSTANCE")\",\"event\":\"$(json_escape "$EVENT")\",\"msg\":\"$(json_escape "$MSG")\""
  # Preserve original key even when redirected to _fallback
  local ACTUAL_KEY="${RESOLVED_KEY:-$KEY}"
  [[ "$ACTUAL_KEY" != "$KEY" ]] && line="$line,\"original_key\":\"$(json_escape "$KEY")\""
  line="$line,\"key\":\"$(json_escape "$KEY")\""
  [[ -n "$RELPATH" ]] && line="$line,\"path\":\"$(json_escape "$RELPATH")\""
  if [[ ${#EK[@]} -gt 0 ]]; then
    local i
    for i in "${!EK[@]}"; do
      line="$line,\"$(json_escape "${EK[$i]}")\":\"$(json_escape "${EV[$i]}")\""
    done
  fi
  line="$line}"
  printf '%s\n' "$line" >> "$OUT_FILE"   # APPEND
}

# --- internal: overwrite one whole-object snapshot ---------------------------
_internal_status() {
  local INSTANCE="$1" BY="$2" AGENT="$3" KEY="$4" \
        STATE="$5" DETAIL="$6" RELPATH="$7"
  shift 7
  local -a EK=() EV=()
  while [[ $# -gt 0 ]]; do
    EK+=("$1"); EV+=("$2"); shift 2
  done

  local OBS; OBS="$(read_obs_level)"
  # Gating: self status follows the self-log rule (suppressed under `none`);
  # assigned status is part of the orchestration ledger and is ALWAYS written.
  if [[ "$BY" == "self" && "$OBS" == "none" ]]; then return 0; fi

  local OUT_DIR OUT_FILE
  if [[ "$BY" == "assigned" ]]; then
    OUT_DIR="$OBS_DIR/$INSTANCE/00.orchestrator/assigned"
    OUT_FILE="$OUT_DIR/$KEY.json"
  else
    # Resolve key for fallback
    local RESOLVED_KEY IS_FALLBACK
    resolve_key "$INSTANCE" "$KEY"
    if $IS_FALLBACK; then
      echo "[QUA-04] key '$KEY' not in manifest; redirected to _fallback/" >&2
    fi
    OUT_DIR="$OBS_DIR/$INSTANCE/$RESOLVED_KEY"
    OUT_FILE="$OUT_DIR/status.json"
  fi
  mkdir -p "$OUT_DIR"

  local TS; TS="$(ts)"
  local obj
  obj="{\"ts\":\"$TS\",\"by\":\"$(json_escape "$BY")\",\"state\":\"$(json_escape "$STATE")\",\"agent\":\"$(json_escape "$AGENT")\",\"key\":\"$(json_escape "$KEY")\",\"instance\":\"$(json_escape "$INSTANCE")\""
  [[ -n "$DETAIL" ]]  && obj="$obj,\"detail\":\"$(json_escape "$DETAIL")\""
  [[ -n "$RELPATH" ]] && obj="$obj,\"path\":\"$(json_escape "$RELPATH")\""
  if [[ ${#EK[@]} -gt 0 ]]; then
    local i
    for i in "${!EK[@]}"; do
      obj="$obj,\"$(json_escape "${EK[$i]}")\":\"$(json_escape "${EV[$i]}")\""
    done
  fi
  obj="$obj}"
  # WHOLE-OBJECT OVERWRITE via atomic rename, so a concurrent reader never sees
  # a half-truncated file. Single writer per file, so no lock is needed.
  local TMP="$OUT_FILE.$$.tmp"
  printf '%s\n' "$obj" > "$TMP"
  mv -f "$TMP" "$OUT_FILE"
}

# --- public command: init ----------------------------------------------------
# Creates directory tree + run_manifest.json with strict schema.
# Stages are parsed from a comma-separated "key:agent" string.
# depends_on is auto-inferred linearly (each stage depends on its predecessor).
cmd_init() {
  local INSTANCE="" STAGES_RAW=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --instance) INSTANCE="$2"; shift 2 ;;
      --stages)   STAGES_RAW="$2"; shift 2 ;;
      *) echo "manager.sh init: unexpected arg: $1" >&2; exit 2 ;;
    esac
  done
  [[ -n "$INSTANCE" ]] || { echo "manager.sh init: --instance required" >&2; exit 2; }
  [[ -n "$STAGES_RAW" ]] || { echo "manager.sh init: --stages required" >&2; exit 2; }

  local INST_DIR="$OBS_DIR/$INSTANCE"

  # Guard: instance directory must not already exist with a manifest
  if [[ -f "$INST_DIR/run_manifest.json" ]]; then
    echo "manager.sh init: instance '$INSTANCE' already initialized (run_manifest.json exists)" >&2
    exit 2
  fi

  # Parse stages: "key1:agent1,key2:agent2,..."
  local -a STAGE_IDS=() STAGE_AGENTS=()
  local IFS=','
  for pair in $STAGES_RAW; do
    local key="${pair%%:*}"
    local agent="${pair#*:}"
    [[ -n "$key" && -n "$agent" ]] || {
      echo "manager.sh init: invalid stage pair '$pair' (expected key:agent)" >&2; exit 2;
    }
    STAGE_IDS+=("$key")
    STAGE_AGENTS+=("$agent")
  done
  [[ ${#STAGE_IDS[@]} -gt 0 ]] || {
    echo "manager.sh init: no stages provided" >&2; exit 2;
  }

  # Create directory structure
  mkdir -p "$INST_DIR/00.orchestrator/assigned"
  mkdir -p "$INST_DIR/_fallback"
  local i
  for i in "${!STAGE_IDS[@]}"; do
    mkdir -p "$INST_DIR/${STAGE_IDS[$i]}"
  done

  # Build run_manifest.json
  local TS; TS="$(ts)"
  local manifest
  manifest="{\"instance\":\"$(json_escape "$INSTANCE")\",\"created\":\"$TS\",\"stages\":["

  for i in "${!STAGE_IDS[@]}"; do
    local sid="${STAGE_IDS[$i]}"
    local sag="${STAGE_AGENTS[$i]}"
    # Auto-infer depends_on: first stage depends on nothing, rest on predecessor
    local deps="[]"
    if [[ $i -gt 0 ]]; then
      deps="[\"$(json_escape "${STAGE_IDS[$((i-1))]}")\"]"
    fi
    [[ $i -gt 0 ]] && manifest="$manifest,"
    manifest="$manifest{\"id\":\"$(json_escape "$sid")\",\"agent\":\"$(json_escape "$sag")\",\"depends_on\":$deps,\"fanout\":\"none\"}"
  done
  manifest="$manifest]}"

  printf '%s\n' "$manifest" > "$INST_DIR/run_manifest.json"
}

# --- public command: checkpoint ----------------------------------------------
# Unified entry point: always logs an event, optionally updates status.
cmd_checkpoint() {
  local INSTANCE="" TARGET="log" AGENT="" KEY="" \
        LEVEL="INFO" EVENT="" MSG="" RELPATH="" \
        STATE="" BY="self" DETAIL=""
  local -a EK=() EV=()
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --instance) INSTANCE="$2"; shift 2 ;;
      --target)   TARGET="$2";   shift 2 ;;
      --agent)    AGENT="$2";    shift 2 ;;
      --key)      KEY="$2";      shift 2 ;;
      --level)    LEVEL="$2";    shift 2 ;;
      --event)    EVENT="$2";    shift 2 ;;
      --msg)      MSG="$2";      shift 2 ;;
      --path)     RELPATH="$2";  shift 2 ;;
      --state)    STATE="$2";    shift 2 ;;
      --by)       BY="$2";       shift 2 ;;
      --detail)   DETAIL="$2";   shift 2 ;;
      --*)        EK+=("${1#--}"); EV+=("$2"); shift 2 ;;
      *) echo "manager.sh checkpoint: unexpected arg: $1" >&2; exit 2 ;;
    esac
  done
  [[ -n "$INSTANCE" ]] || { echo "manager.sh checkpoint: --instance required" >&2; exit 2; }
  [[ -n "$EVENT" ]]    || { echo "manager.sh checkpoint: --event required" >&2; exit 2; }
  [[ -n "$KEY" ]] || KEY="${AGENT:-_agent}"

  # Interleave extra key-value pairs for passing to internal functions
  local -a XARGS=()
  if [[ ${#EK[@]} -gt 0 ]]; then
    local xi
    for xi in "${!EK[@]}"; do XARGS+=("${EK[$xi]}" "${EV[$xi]}"); done
  fi

  # 1. Always append the event line
  _internal_log "$INSTANCE" "$TARGET" "$AGENT" "$KEY" \
                "$LEVEL" "$EVENT" "$MSG" "$RELPATH" \
                "${XARGS[@]+"${XARGS[@]}"}"

  # 2. If --state provided, also write a status snapshot
  if [[ -n "$STATE" ]]; then
    case "$BY" in
      self|assigned) ;;
      *) echo "manager.sh checkpoint: --by must be self|assigned" >&2; exit 2 ;;
    esac
    _internal_status "$INSTANCE" "$BY" "$AGENT" "$KEY" \
                     "$STATE" "$DETAIL" "$RELPATH" \
                     "${XARGS[@]+"${XARGS[@]}"}"
  fi
}

usage() {
  cat >&2 <<'EOF'
manager.sh — POMASA QUA-04 unified write-only recorder

  manager.sh init --instance <ID> --stages '<key>:<agent>,...'
      Create directory tree and run_manifest.json (call ONCE per run).

  manager.sh checkpoint --instance <ID> --agent <name> \
             --target <log|journal> --level <INFO|WARN|ERROR> --event <slug> \
             --msg "<text>" [--key <K>] [--state <slug>] [--by <self|assigned>] \
             [--detail "<text>"] [--path <relpath>] [--key value ...]
      Record an event. If --state is provided, also update status snapshot.
      If --state is omitted, only the event is logged (status unchanged).
EOF
}

# --- dispatch (only when executed, not when sourced) -------------------------
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  SUB="${1:-help}"
  if [[ $# -gt 0 ]]; then shift; fi
  case "$SUB" in
    init)       cmd_init "$@" ;;
    checkpoint) cmd_checkpoint "$@" ;;
    help|-h|--help) usage ;;
    *) echo "manager.sh: unknown subcommand: $SUB" >&2; usage; exit 2 ;;
  esac
fi
