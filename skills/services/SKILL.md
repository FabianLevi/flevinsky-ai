---
name: services
description: "Manage project services declared in .flevinsky-ai/services.json (falls back to .services/.pi/.claude). Subcommands: list, start, stop, restart, logs, run."
argument-hint: "[list|start|stop|restart|logs|run] [name]"
user-invocable: true
---

# /services

Route the user's command to the appropriate `flevinsky-ai` MCP tool.

User arguments: `$ARGUMENTS`

Behavior:

- If `$ARGUMENTS` is empty or `list` → call `services_list`.
- If first token is `start` → call `services_start` with `name` = second token.
- If first token is `stop` → call `services_stop` with `name` = second token.
- If first token is `restart` → call `services_restart` with `name` = second token.
- If first token is `logs` → call `services_logs` with `name` = second token (and `tail` = third token if numeric).
- If first token is `run` → print: `flevinsky-ai run <name> -- <cmd>` (the attached runner CLI; not callable from inside Claude Code, only from the user's terminal).

Always report the tool's result back to the user verbatim. If the requested service name does not exist in state or in the project's `services.json`, surface the error from the tool.
