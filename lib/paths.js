// Project root + state path resolution with a fallback chain so the same
// project works for Pi, Claude Code, or a new project that picks the
// canonical `.flevinsky-ai/` layout — no symlinks required.

import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export const CANONICAL_DIR = ".flevinsky-ai";

// Order matters: canonical first, then known agent locations. The first dir
// containing services.json wins. If none is found, fall back to canonical at
// the start directory (used when initializing a new project).
const CANDIDATES = [".flevinsky-ai", ".services", ".pi", ".claude"];

export function findProjectCwd(start) {
	let cur = resolve(start);
	while (true) {
		for (const dir of CANDIDATES) {
			if (existsSync(join(cur, dir, "services.json"))) {
				return { cwd: cur, prefix: dir };
			}
		}
		const parent = dirname(cur);
		if (parent === cur) return { cwd: resolve(start), prefix: CANONICAL_DIR };
		cur = parent;
	}
}

export function configPathFor(projectCwd, prefix = CANONICAL_DIR) {
	return join(projectCwd, prefix, "services.json");
}

export function stateDir(projectCwd, prefix = CANONICAL_DIR) {
	return join(projectCwd, prefix, "services");
}

export function statePath(projectCwd, prefix = CANONICAL_DIR) {
	return join(stateDir(projectCwd, prefix), "state.json");
}

export function logDir(projectCwd, prefix = CANONICAL_DIR) {
	return join(stateDir(projectCwd, prefix), "logs");
}

export function logPathFor(projectCwd, name, prefix = CANONICAL_DIR) {
	return join(logDir(projectCwd, prefix), `${name}.log`);
}
