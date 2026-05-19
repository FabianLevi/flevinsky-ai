# Architecture

## Overview

`flevinsky-ai` is one npm package that serves three roles:

| Role               | Entry                                      |
|--------------------|--------------------------------------------|
| Claude Code plugin | `.claude-plugin/`, `.mcp.json`, `hooks/`   |
| Pi extension       | `adapters/pi/extensions/`                  |
| CLI / generic MCP  | `bin/flevinsky-ai`, `bin/server.js`        |

All three drive the same on-disk state, so a service started from one agent is visible to the others.

## State layout

```
<project-root>/<prefix>/services/
  state.json            # { name: { pid, status, exitCode, startedAt } }
  logs/<name>.log       # combined stdout+stderr, append-only
```

`<prefix>` is the first existing of `.flevinsky-ai`, `.services`, `.pi`, `.claude` walking up from the cwd. If none exists, the runner creates `.flevinsky-ai`. The chain is deliberate: legacy `pi-services` (`.pi`) and Claude Code (`.claude`) installations keep working without migration.

`findProjectCwd(start)` returns `{cwd, prefix}` — every read/write threads `prefix` so concurrent agents agree on a single state file.

## Process model

- `kind: "server"` — spawned `detached: true`, in its own process group. Termination uses `process.kill(-pid, sig)` so child trees die with the parent.
- `kind: "task"` — one-shot; exit code captured into `state.json`.
- `readyPattern` (servers only) — regex matched against log output; status flips to `running` on first match, otherwise stays `starting`.
- `autoStart` — Claude Code session-start hook spawns matching servers.

## Claude Code integration

| File                              | Purpose                                              |
|-----------------------------------|------------------------------------------------------|
| `.claude-plugin/plugin.json`      | Plugin manifest                                      |
| `.claude-plugin/marketplace.json` | Self-hosted marketplace entry                        |
| `.mcp.json`                       | Registers `flevinsky-ai` MCP server (`bin/server.js`)|
| `hooks/hooks.json`                | `SessionStart` / `SessionEnd` hooks                  |
| `monitors/monitors.json`          | Status-line config                                   |
| `skills/services/SKILL.md`        | `/services` slash command                            |

MCP tools exposed: `services_list`, `services_start`, `services_stop`, `services_restart`, `services_logs`.

## Pi integration

`package.json` declares `"pi": {"extensions": ["./adapters/pi/extensions"]}`. The Pi adapter registers `/services` slash commands and an overlay UI driven by the same `lib/` helpers as the CLI. Tests live in `adapters/pi/tests/`.

## Distribution

- **npm**: `pnpm publish` on `v*` tag (see [release-checklist.md](release-checklist.md))
- **Homebrew**: tag job regenerates `Formula/flevinsky-ai.rb` in `FabianLevi/homebrew-tap`
- **install.sh**: `curl | bash`, auto-detects brew/pnpm/npm

## Why one repo

Three packaging surfaces share ~90% of code (config loader, state IO, process spawner, log tailer). Splitting them would mean version-locking three packages just to ship one feature. One repo, three thin adapter directories.
