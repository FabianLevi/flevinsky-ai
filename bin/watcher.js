#!/usr/bin/env node
// Background monitor (declared in monitors/monitors.json). Each stdout line
// becomes a session notification. We watch state.json transitions and emit a
// line when a service moves to "exited" unexpectedly.

import { watch } from "node:fs";
import { findProjectCwd, statePath } from "../lib/paths.js";
import { readState } from "../lib/state.js";

const { cwd: projectCwd, prefix } = findProjectCwd(process.cwd());
let prev = readState(projectCwd, prefix);

function tick() {
	const cur = readState(projectCwd, prefix);
	for (const [name, entry] of Object.entries(cur)) {
		const before = prev[name];
		if (before && before.status !== "exited" && entry.status === "exited") {
			const code = entry.exitCode ?? "?";
			process.stdout.write(`service '${name}' exited (code=${code})\n`);
		}
	}
	prev = cur;
}

try {
	watch(statePath(projectCwd, prefix), { persistent: true }, tick);
} catch {
	// File may not exist yet; poll instead.
	setInterval(tick, 2000);
}
