import { spawn } from "node:child_process";
import { closeSync, mkdirSync, openSync, readFileSync } from "node:fs";
import { dirname } from "node:path";

import { resolveServiceCwd } from "./config.js";
import { logPathFor } from "./paths.js";

// Spawn a declared service. `detached: true` makes the shell a process group
// leader so terminateProcess can signal the whole tree via -pid; otherwise
// SIGTERM hits only the shell and grandchildren survive.
export function spawnService(projectCwd, svc, prefix) {
	const logPath = logPathFor(projectCwd, svc.name, prefix);
	mkdirSync(dirname(logPath), { recursive: true });
	const serviceCwd = resolveServiceCwd(projectCwd, svc.cwd);

	const logFd = openSync(logPath, "w");

	let child;
	try {
		child = spawn(svc.cmd, [], {
			shell: true,
			cwd: serviceCwd,
			env: { ...process.env, ...svc.env },
			stdio: ["ignore", logFd, logFd],
			detached: true,
		});
	} catch (err) {
		closeSync(logFd);
		throw err;
	}

	let closed = false;
	const closeFd = () => {
		if (closed) return;
		closed = true;
		try {
			closeSync(logFd);
		} catch {
			/* fd already closed */
		}
	};
	child.once("exit", closeFd);
	child.once("error", closeFd);

	return { child, logPath };
}

export async function waitForReadyPattern(logPath, pattern, { timeoutMs, pollMs }) {
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		try {
			if (pattern.test(readFileSync(logPath, "utf8"))) return { matched: true };
		} catch (err) {
			if (err.code !== "ENOENT") return { matched: false, reason: err.message };
		}
		await new Promise((r) => setTimeout(r, pollMs));
	}
	return { matched: false, reason: "timeout" };
}

function signalGroupOrPid(pid, sig) {
	try {
		process.kill(-pid, sig);
		return;
	} catch (err) {
		if (err.code !== "ESRCH" && err.code !== "EPERM") throw err;
	}
	try {
		process.kill(pid, sig);
	} catch (err) {
		if (err.code === "ESRCH") return;
		if (err.code !== "EPERM") throw err;
	}
}

export async function terminateProcess(pid, graceMs) {
	if (!Number.isInteger(pid) || pid <= 0) return;
	signalGroupOrPid(pid, "SIGTERM");
	await new Promise((r) => setTimeout(r, graceMs));
	signalGroupOrPid(pid, "SIGKILL");
}
