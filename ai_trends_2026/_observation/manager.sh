#!/usr/bin/env bash
# manager.sh — POMASA QUA-04 Observable Execution: unified write-only recorder
#
# A single, dependency-free recorder that BOTH the Orchestrator and every
# sub-agent call to write observation data into the project's `_observation/`
# tree. It writes two kinds of artifacts:
#
#   log     — append one structured JSON line to an append-only JSONL stream
#   status  — overwrite one whole-object JSON current-state snapshot
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
#       ├── run_manifest.json                 # static plan, written once by O (not by this script)
#       ├── 00.orchestrator/                  # ← only O writes here
#       │   ├── run.jsonl                      #   ledger: agent_call / stage_verdict / stage_enter|exit (append)
#       │   └── assigned/<key>.json            #   O's assigned status for one agent (overwrite)
#       └── <key>/                            # ← only that sub-agent writes here
#           ├── _log.jsonl                     #   self-log (append) → tail line ts == last heartbeat
#           └── status.json                    #   self status (overwrite)
#
# Usage:
#   manager.sh log    --instance <ID> --target <log|journal> --agent <name> \
#                     [--key <K>] --level <INFO|WARN|ERROR> --event <slug> \
#                     --msg "<text>" [--path <relpath>] [--key value ...]
#
#   manager.sh status --instance <ID> --by <self|assigned> --agent <name> \
#                     [--key <K>] --state <slug> [--detail "<text>"] \
#                     [--path <relpath>] [--key value ...]
#
#   <key> is the agent's partition key. It MUST carry the same distinguishing
#   detail as the deliverable partition: use "<stage>.<entity>" for parallel /
#   fan-out instances, or the blueprint/stage name for a one-shot agent.
#   Defaults to --agent when omitted.
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

# --- subcommand: log (append one JSONL line) --------------------------------
cmd_log() {
  local INSTANCE="" TARGET="log" AGENT="" KEY="" LEVEL="INFO" EVENT="" MSG="" RELPATH=""
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
      --*)        EK+=("${1#--}"); EV+=("$2"); shift 2 ;;
      *) echo "manager.sh log: unexpected arg: $1" >&2; exit 2 ;;
    esac
  done
  [[ -n "$INSTANCE" ]] || { echo "manager.sh log: --instance required" >&2; exit 2; }
  [[ -n "$KEY" ]] || KEY="${AGENT:-_agent}"
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
    # the BHV-02 quality gate). All other ledger events (agent_call, stage_enter,
    # stage_exit) are kept at every level EXCEPT `none` — matching the QUA-04 table
    # where minimal/normal both keep "verdicts + invocation records". Ledger events
    # are NOT level-ranked; the Orchestrator only logs structural milestones here,
    # and `detailed` differs by carrying more invocation parameters, not more lines.
    if ! $is_verdict && [[ "$OBS" == "none" ]]; then exit 0; fi
    OUT_DIR="$OBS_DIR/$INSTANCE/00.orchestrator"
    OUT_FILE="$OUT_DIR/run.jsonl"
  else
    # Agent self-log: fully suppressed under `none` (short-circuit safety net),
    # otherwise level-ranked (minimal=ERROR, normal=ERROR+WARN, detailed=all).
    [[ "$OBS" == "none" ]] && exit 0
    [[ "$(level_rank "$LEVEL")" -lt "$min_rank" ]] && exit 0
    OUT_DIR="$OBS_DIR/$INSTANCE/$KEY"
    OUT_FILE="$OUT_DIR/_log.jsonl"
  fi
  mkdir -p "$OUT_DIR"

  local TS; TS="$(ts)"
  local line
  line="{\"ts\":\"$TS\",\"level\":\"$(json_escape "$LEVEL")\",\"agent\":\"$(json_escape "$AGENT")\",\"instance\":\"$(json_escape "$INSTANCE")\",\"event\":\"$(json_escape "$EVENT")\",\"msg\":\"$(json_escape "$MSG")\""
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

# --- subcommand: status (overwrite one whole-object snapshot) ---------------
cmd_status() {
  local INSTANCE="" BY="" AGENT="" KEY="" STATE="" DETAIL="" RELPATH=""
  local -a EK=() EV=()
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --instance) INSTANCE="$2"; shift 2 ;;
      --by)       BY="$2";       shift 2 ;;
      --agent)    AGENT="$2";    shift 2 ;;
      --key)      KEY="$2";      shift 2 ;;
      --state)    STATE="$2";    shift 2 ;;
      --detail)   DETAIL="$2";   shift 2 ;;
      --path)     RELPATH="$2";  shift 2 ;;
      --*)        EK+=("${1#--}"); EV+=("$2"); shift 2 ;;
      *) echo "manager.sh status: unexpected arg: $1" >&2; exit 2 ;;
    esac
  done
  [[ -n "$INSTANCE" ]] || { echo "manager.sh status: --instance required" >&2; exit 2; }
  [[ -n "$STATE" ]]    || { echo "manager.sh status: --state required" >&2; exit 2; }
  case "$BY" in
    self|assigned) ;;
    *) echo "manager.sh status: --by must be self|assigned" >&2; exit 2 ;;
  esac
  [[ -n "$KEY" ]] || KEY="${AGENT:-_agent}"

  local OBS; OBS="$(read_obs_level)"
  # Gating: self status follows the self-log rule (suppressed under `none`);
  # assigned status is part of the orchestration ledger and is ALWAYS written.
  if [[ "$BY" == "self" && "$OBS" == "none" ]]; then exit 0; fi

  local OUT_DIR OUT_FILE
  if [[ "$BY" == "assigned" ]]; then
    OUT_DIR="$OBS_DIR/$INSTANCE/00.orchestrator/assigned"
    OUT_FILE="$OUT_DIR/$KEY.json"
  else
    OUT_DIR="$OBS_DIR/$INSTANCE/$KEY"
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

usage() {
  cat >&2 <<'EOF'
manager.sh — POMASA QUA-04 unified write-only recorder

  manager.sh log    --instance <ID> --target <log|journal> --agent <name> \
                    [--key <K>] --level <INFO|WARN|ERROR> --event <slug> \
                    --msg "<text>" [--path <relpath>] [--key value ...]

  manager.sh status --instance <ID> --by <self|assigned> --agent <name> \
                    [--key <K>] --state <slug> [--detail "<text>"] \
                    [--path <relpath>] [--key value ...]
EOF
}

# --- dispatch ---------------------------------------------------------------
SUB="${1:-help}"
if [[ $# -gt 0 ]]; then shift; fi
case "$SUB" in
  log)    cmd_log "$@" ;;
  status) cmd_status "$@" ;;
  help|-h|--help) usage ;;
  *) echo "manager.sh: unknown subcommand: $SUB" >&2; usage; exit 2 ;;
esac