import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";

import { logDir, stateDir, statePath } from "./paths.js";

export const STATUS = {
	STARTING: "starting",
	RUNNING: "running",
	STOPPING: "stopping",
	STOPPED: "stopped",
	EXITED: "exited",
};

export function readState(projectCwd, prefix) {
	try {
		const parsed = JSON.parse(readFileSync(statePath(projectCwd, prefix), "utf8"));
		return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
	} catch {
		return {};
	}
}

export function writeState(projectCwd, state, prefix) {
	mkdirSync(stateDir(projectCwd, prefix), { recursive: true });
	mkdirSync(logDir(projectCwd, prefix), { recursive: true });
	const target = statePath(projectCwd, prefix);
	const tmp = `${target}.tmp`;
	writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`);
	renameSync(tmp, target);
}

export function isProcessAlive(pid) {
	try {
		process.kill(pid, 0);
		return true;
	} catch (err) {
		return err.code === "EPERM";
	}
}

export function reconcileStale(state) {
	const next = {};
	const removed = [];
	const live = [STATUS.RUNNING, STATUS.STARTING, STATUS.STOPPING];
	for (const [name, entry] of Object.entries(state)) {
		if (live.includes(entry.status) && !isProcessAlive(entry.pid)) {
			removed.push(name);
			continue;
		}
		next[name] = entry;
	}
	return { state: next, removed };
}

export function updateEntry(state, name, patch) {
	const existing = state[name];
	if (!existing) throw new Error(`service '${name}' not in state`);
	return { ...state, [name]: { ...existing, ...patch } };
}
