#!/usr/bin/env node
// Reads SessionStart JSON from stdin and emits a "[services]" context snippet
// on stdout for prompt injection so the agent can see declared + live state.

import { readFileSync } from "node:fs";
import { findProjectCwd } from "../lib/paths.js";
import { loadServicesConfig } from "../lib/config.js";
import { readState, reconcileStale } from "../lib/state.js";

const stdin = readFileSync(0, "utf8");
let event = {};
try {
	event = JSON.parse(stdin);
} catch {
	/* ignore */
}

const { cwd: projectCwd, prefix } = findProjectCwd(event.cwd || process.cwd());
const cfg = loadServicesConfig(projectCwd, prefix);
const { state } = reconcileStale(readState(projectCwd, prefix));

const declared = Object.values(cfg.services);
const running = Object.entries(state);
if (declared.length === 0 && running.length === 0) process.exit(0);

const lines = ["[services]"];
lines.push(
	`Project services declared in ${cfg.path}. Use the \`services_logs\` MCP tool to read live logs by name.`,
);
if (declared.length > 0) {
	lines.push("Declared:");
	for (const d of declared) lines.push(`  - ${d.name} (${d.kind}): ${d.cmd}`);
}
if (running.length > 0) {
	lines.push("Live:");
	for (const [n, e] of running) {
		lines.push(
			`  - ${n}: ${e.status} pid=${e.pid}${e.exitCode !== undefined ? ` exit=${e.exitCode}` : ""}`,
		);
	}
}
process.stdout.write(lines.join("\n"));
