#!/usr/bin/env bash
# UserPromptSubmit. stdout is appended as additionalContext on every turn.
set -euo pipefail
stdin=$(cat)
node "${CLAUDE_PLUGIN_ROOT}/scripts/session-start.js" <<<"$stdin"
