#!/usr/bin/env node
// Stops services flagged as owned by this session id. Ownership tracking is
// done by the MCP server when it spawns a service (it stamps `sessionId` on
// the state entry); the attached runner does NOT mark ownership because the
// user owns that lifecycle from their terminal.

import { readFileSync } from "node:fs";
import { findProjectCwd } from "../lib/paths.js";
import { readState, writeState, STATUS } from "../lib/state.js";

const stdin = readFileSync(0, "utf8");
let event = {};
try {
	event = JSON.parse(stdin);
} catch {}

const sessionId = event.session_id;
const { cwd: projectCwd, prefix } = findProjectCwd(event.cwd || process.cwd());
const state = readState(projectCwd, prefix);
const next = { ...state };
let touched = false;

for (const [name, entry] of Object.entries(state)) {
	if (entry.sessionId !== sessionId) continue;
	if (
		entry.status !== STATUS.RUNNING &&
		entry.status !== STATUS.STARTING &&
		entry.status !== STATUS.STOPPING
	) {
		continue;
	}
	try {
		process.kill(entry.pid, "SIGTERM");
	} catch {}
	next[name] = { ...entry, status: STATUS.STOPPED, exitedAt: new Date().toISOString() };
	touched = true;
}
if (touched) writeState(projectCwd, next, prefix);
