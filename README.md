# flevinsky-ai

[![CI](https://github.com/FabianLevi/flevinsky-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/FabianLevi/flevinsky-ai/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/flevinsky-ai.svg)](https://www.npmjs.com/package/flevinsky-ai)
[![license](https://img.shields.io/npm/l/flevinsky-ai.svg)](LICENSE)
[![node](https://img.shields.io/node/v/flevinsky-ai.svg)](package.json)

Cross-agent dev service runner. Declare your project's long-running services once and run, observe, and tail logs from any supported AI coding agent — without losing state when the agent restarts.

## What it does

- **One config, many agents.** Declare services (frontend, api, workers…) in a single JSON file.
- **Persistent state.** Services keep running across agent sessions. State + logs land in `<root>/<prefix>/services/`.
- **Per-service logs.** Tail or grep them from inside the agent instead of re-running commands.
- **Fallback prefix chain.** Picks the first of `.flevinsky-ai`, `.services`, `.pi`, `.claude` that exists — so existing `pi-services` or Claude Code state keeps working.

## Agent compatibility

| Agent       | Mechanism              | Status |
|-------------|------------------------|--------|
| Claude Code | Plugin (MCP + hooks)   | ✅     |
| Pi          | Extension              | ✅     |
| CLI         | `flevinsky-ai` runner  | ✅     |
| Other MCP   | `bin/server.js`        | ✅     |

## Install

### macOS / Linux (one-liner)

```sh
curl -sL https://raw.githubusercontent.com/FabianLevi/flevinsky-ai/main/scripts/install.sh | bash
```

Auto-detects Homebrew → pnpm → npm. Force a method with `FL_METHOD=brew` / `FL_METHOD=pnpm` / `FL_METHOD=npm`.

### Homebrew

```sh
brew install FabianLevi/tap/flevinsky-ai
```

### pnpm

```sh
pnpm add -g flevinsky-ai
```

### npm

```sh
npm install -g flevinsky-ai
```

### Windows

Use pnpm or npm inside WSL2, PowerShell, or Git Bash. Native Windows is best-effort.

### Per-agent install

- **Claude Code** — `/plugin marketplace add FabianLevi/flevinsky-ai` then `/plugin install flevinsky-ai`
- **Pi** — installs as a Pi extension automatically when the package is on `$PATH`

## Declare services

Create `.flevinsky-ai/services.json` at your project root:

```json
{
  "services": {
    "frontend": {
      "kind": "server",
      "cmd": "pnpm dev",
      "cwd": "frontend",
      "readyPattern": "Local:\\s+http"
    },
    "api": {
      "kind": "server",
      "cmd": "uvicorn app:app --reload",
      "cwd": "backend"
    },
    "migrate": {
      "kind": "task",
      "cmd": "pnpm db:migrate"
    }
  }
}
```

Field reference: see [docs/architecture.md](docs/architecture.md#process-model).

## Use it

### From any terminal

```sh
flevinsky-ai list                          # show declared + live services
flevinsky-ai start frontend                # background-spawn
flevinsky-ai logs   frontend 200           # tail last 200 lines
flevinsky-ai stop   frontend
flevinsky-ai run    frontend -- pnpm dev   # attached: stream output to terminal, track state
```

### From inside Claude Code

The plugin exposes MCP tools `services_list / start / stop / restart / logs`. Just ask: *"tail frontend logs"*, *"restart api"*.

### From inside Pi

Same surface via the Pi extension — `/services list`, `/services logs frontend`, etc.

## Docs

- [Architecture](docs/architecture.md) — state layout, process model, plugin/extension wiring
- [Release checklist](docs/release-checklist.md) — how a `v*` tag becomes a release
- [Rollback](docs/rollback.md) — undoing a bad release
- [AGENTS.md](AGENTS.md) — skills, MCP tools, hooks index for AI agents

## License

MIT
