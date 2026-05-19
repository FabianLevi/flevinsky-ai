#!/usr/bin/env node
// MCP server for flevinsky-ai (Claude Code plugin).
//
// Exposes tools the agent can call:
//   services_list / start / stop / restart / logs
//
// State lives under <project-root>/<prefix>/services/ — prefix resolved via
// fallback chain in lib/paths.js (.flevinsky-ai → .services → .pi → .claude).

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
	CallToolRequestSchema,
	ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { findProjectCwd, logPathFor } from "../lib/paths.js";
import { loadServicesConfig } from "../lib/config.js";
import { readState, writeState, STATUS, updateEntry, reconcileStale } from "../lib/state.js";
import {
	spawnService,
	terminateProcess,
	waitForReadyPattern,
} from "../lib/process.js";
import { tailLogFile } from "../lib/logs.js";

const STOP_GRACE_MS = 2_000;
const READY_TIMEOUT_MS = 30_000;
const READY_POLL_MS = 200;

const { cwd: projectCwd, prefix } = findProjectCwd(process.cwd());

const server = new Server(
	{ name: "flevinsky-ai", version: "0.1.0" },
	{ capabilities: { tools: {} } },
);

const TOOLS = [
	{
		name: "services_list",
		description: "List declared services and their live state.",
		inputSchema: { type: "object", properties: {} },
	},
	{
		name: "services_start",
		description: "Start a service declared in services.json.",
		inputSchema: {
			type: "object",
			required: ["name"],
			properties: { name: { type: "string" } },
		},
	},
	{
		name: "services_stop",
		description: "Stop a running service.",
		inputSchema: {
			type: "object",
			required: ["name"],
			properties: { name: { type: "string" } },
		},
	},
	{
		name: "services_restart",
		description: "Stop then start a service.",
		inputSchema: {
			type: "object",
			required: ["name"],
			properties: { name: { type: "string" } },
		},
	},
	{
		name: "services_logs",
		description:
			"Read recent log lines from a service. Use to debug long-running commands instead of re-running them.",
		inputSchema: {
			type: "object",
			required: ["name"],
			properties: {
				name: { type: "string" },
				tail: { type: "integer", minimum: 1, maximum: 500, default: 100 },
				grep: { type: "string", description: "case-insensitive regex" },
				errorsOnly: { type: "boolean", default: false },
			},
		},
	},
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
	const { name, arguments: args = {} } = req.params;
	try {
		switch (name) {
			case "services_list":
				return text(formatList());
			case "services_start":
				return text(await doStart(args.name));
			case "services_stop":
				return text(await doStop(args.name));
			case "services_restart":
				return text(await doRestart(args.name));
			case "services_logs":
				return text(formatLogs(args.name, args));
			default:
				return text(`unknown tool: ${name}`);
		}
	} catch (err) {
		return text(`error: ${err.message}`);
	}
});

function text(s) {
	return { content: [{ type: "text", text: s }] };
}

function nowIso() {
	return new Date().toISOString();
}

function formatList() {
	const cfg = loadServicesConfig(projectCwd, prefix);
	const state = readState(projectCwd, prefix);
	const declared = Object.values(cfg.services);
	if (declared.length === 0 && Object.keys(state).length === 0) {
		return `No services. Create ${cfg.path}.`;
	}
	const lines = [];
	for (const d of declared) {
		const e = state[d.name];
		lines.push(
			`${d.name} (${d.kind})  ${e ? `pid=${e.pid} ${e.status}` : "stopped"}  — ${d.cmd}`,
		);
	}
	for (const [n, e] of Object.entries(state)) {
		if (cfg.services[n]) continue;
		lines.push(`${n} (?)  pid=${e.pid} ${e.status}  — ${e.cmd ?? ""}`);
	}
	return lines.join("\n");
}

async function doStart(name) {
	if (!name) throw new Error("name required");
	const cfg = loadServicesConfig(projectCwd, prefix);
	const svc = cfg.services[name];
	if (!svc) throw new Error(`unknown service '${name}' in ${cfg.path}`);
	const existing = readState(projectCwd, prefix)[name];
	if (existing && (existing.status === STATUS.RUNNING || existing.status === STATUS.STARTING)) {
		return `${name}: already ${existing.status}`;
	}
	const { child, logPath } = spawnService(projectCwd, svc, prefix);
	if (!child.pid) throw new Error("spawn failed");
	writeState(projectCwd, {
		...readState(projectCwd, prefix),
		[name]: {
			pid: child.pid,
			status: STATUS.STARTING,
			kind: svc.kind,
			cmd: svc.cmd,
			runner: "mcp",
			startedAt: nowIso(),
		},
	}, prefix);
	child.unref();
	if (svc.kind === "task") return `${name}: started (task, pid=${child.pid})`;
	if (svc.readyPattern) {
		const r = await waitForReadyPattern(logPath, new RegExp(svc.readyPattern), {
			timeoutMs: READY_TIMEOUT_MS,
			pollMs: READY_POLL_MS,
		});
		const cur = readState(projectCwd, prefix);
		if (r.matched && cur[name]?.status === STATUS.STARTING) {
			writeState(projectCwd, updateEntry(cur, name, { status: STATUS.RUNNING }), prefix);
			return `${name}: running (pid=${child.pid})`;
		}
		await terminateProcess(child.pid, STOP_GRACE_MS);
		return `${name}: readyPattern ${r.reason ?? "no match"}`;
	}
	const cur = readState(projectCwd, prefix);
	if (cur[name]?.status === STATUS.STARTING) {
		writeState(projectCwd, updateEntry(cur, name, { status: STATUS.RUNNING }), prefix);
	}
	return `${name}: running (pid=${child.pid})`;
}

async function doStop(name) {
	if (!name) throw new Error("name required");
	const state = readState(projectCwd, prefix);
	const entry = state[name];
	if (!entry) throw new Error(`${name}: not in state`);
	if (entry.status !== STATUS.RUNNING && entry.status !== STATUS.STARTING) {
		return `${name}: already ${entry.status}`;
	}
	writeState(projectCwd, updateEntry(state, name, { status: STATUS.STOPPING }), prefix);
	await terminateProcess(entry.pid, STOP_GRACE_MS);
	const cur = readState(projectCwd, prefix);
	if (cur[name]) {
		writeState(projectCwd, updateEntry(cur, name, {
			status: STATUS.STOPPED,
			exitedAt: nowIso(),
		}), prefix);
	}
	return `${name}: stopped`;
}

async function doRestart(name) {
	await doStop(name).catch(() => {});
	return doStart(name);
}

function formatLogs(name, { tail = 100, grep, errorsOnly } = {}) {
	if (!name) throw new Error("name required");
	const logPath = logPathFor(projectCwd, name, prefix);
	const { lines, truncated, warnings } = tailLogFile(logPath, {
		tail,
		grep: errorsOnly ? "(error|err|fatal|panic|failed|traceback|exception)" : grep,
	});
	const entry = readState(projectCwd, prefix)[name];
	const header = entry
		? `service=${name} status=${entry.status} pid=${entry.pid}${entry.exitCode !== undefined ? ` exit=${entry.exitCode}` : ""}`
		: `service=${name} status=not-running`;
	const warnLine = warnings?.length ? `\nwarnings: ${warnings.join("; ")}` : "";
	const body = lines.length > 0 ? lines.join("\n") : "(no log content)";
	return `${header}${truncated ? `  (showing last ${tail} lines)` : ""}${warnLine}\n\n${body}`;
}

// Reconcile stale entries on startup so dead PIDs don't linger.
const { state: reconciled, removed } = reconcileStale(readState(projectCwd, prefix));
if (removed.length > 0) writeState(projectCwd, reconciled, prefix);

const transport = new StdioServerTransport();
await server.connect(transport);
