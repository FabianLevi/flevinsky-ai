# AGENTS.md

Index of skills, slash commands, and agent-facing entry points in this repo. AI coding agents (Claude Code, Pi, Cursor, etc.) should consult this file first to know which capability to invoke for which task.

## Skills

| Name        | Trigger / invocation             | Path                          | Purpose                                                                 |
|-------------|----------------------------------|-------------------------------|-------------------------------------------------------------------------|
| `services`  | `/services [list\|start\|stop\|restart\|logs\|run] [name]` | `skills/services/SKILL.md` | Manage long-running dev services via the `flevinsky-ai` MCP tools.      |

## MCP tools (server: `flevinsky-ai`)

| Tool                | Args                  | Purpose                              |
|---------------------|-----------------------|--------------------------------------|
| `services_list`     | —                     | List declared + live services        |
| `services_start`    | `name`                | Background-spawn a service           |
| `services_stop`     | `name`                | Stop a running service (SIGTERM)     |
| `services_restart`  | `name`                | Stop + start                         |
| `services_logs`     | `name`, `tail?`       | Tail last N lines of combined log    |

Server entry: `bin/server.js`. MCP manifest: `.mcp.json`.

## Hooks (Claude Code)

| Event          | Script                       | Purpose                                       |
|----------------|------------------------------|-----------------------------------------------|
| `SessionStart` | `scripts/session-start.js`   | Reconcile stale state, auto-start servers     |
| `SessionEnd`   | `scripts/session-end.js`     | Mark exited servers; keep autostart entries   |

Definitions: `hooks/hooks.json`.

## Pi extension

Registered via `package.json` → `pi.extensions`. Adds the `/services` slash commands and a TUI overlay. Source: `adapters/pi/extensions/services.ts`.

## CLI

```
flevinsky-ai list | start <n> | stop <n> | restart <n> | logs <n> [tail] | run <n> -- <cmd> | path
```

Entry: `bin/flevinsky-ai`.

## Where to add new skills

1. New dir: `skills/<name>/SKILL.md` with frontmatter (`name`, `description`, `argument-hint`, `user-invocable`).
2. Add a row to the table above.
3. If it needs an MCP tool, add the handler in `bin/server.js` and document it under "MCP tools".

## Conventions

- Slash command names: lowercase, hyphens, no colons (Pi reserves `:` for collision suffixes).
- State paths: always through `findProjectCwd(start)` — never hard-code `.flevinsky-ai` because the fallback chain handles `.services`, `.pi`, `.claude`.
- New code: TypeScript in `adapters/pi/lib/` (run with `--experimental-strip-types`), plain JS in root `lib/` (no build step).

See [docs/architecture.md](docs/architecture.md) for the broader picture.
