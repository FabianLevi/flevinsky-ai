#!/usr/bin/env bash
# SessionEnd. Best-effort teardown of services this session owns.
# NOTE: not guaranteed to fire on hard kill of Claude Code; treat as cleanup,
# not a hard guarantee.

set -euo pipefail
stdin=$(cat)
node "${CLAUDE_PLUGIN_ROOT}/scripts/session-end.js" <<<"$stdin"
