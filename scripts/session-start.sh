#!/usr/bin/env bash
# SessionStart hook. stdin = { session_id, cwd, source, model, ... }
# stdout is injected as additionalContext into the agent's prompt.

set -euo pipefail

stdin=$(cat)
node "${CLAUDE_PLUGIN_ROOT}/scripts/session-start.js" <<<"$stdin"
