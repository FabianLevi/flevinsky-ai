import { readFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

import { configPathFor } from "./paths.js";

function isRecord(v) {
	return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isStringRecord(v) {
	if (!isRecord(v)) return false;
	for (const x of Object.values(v)) if (typeof x !== "string") return false;
	return true;
}

export function loadServicesConfig(projectCwd, prefix) {
	const path = configPathFor(projectCwd, prefix);
	let raw;
	try {
		raw = JSON.parse(readFileSync(path, "utf8"));
	} catch (err) {
		if (err.code === "ENOENT") return { services: {}, warnings: [], path, missing: true };
		return { services: {}, warnings: [`services.json: ${err.message}`], path, missing: false };
	}
	const warnings = [];
	const services = {};
	if (!isRecord(raw) || !isRecord(raw.services)) {
		warnings.push("services.json: top level must be { services: { ... } }");
		return { services, warnings, path, missing: false };
	}
	for (const [name, def] of Object.entries(raw.services)) {
		const parsed = parseDef(name, def, warnings);
		if (parsed) services[name] = parsed;
	}
	return { services, warnings, path, missing: false };
}

function parseDef(name, def, warnings) {
	if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name)) {
		warnings.push(`service '${name}': invalid name`);
		return null;
	}
	if (!isRecord(def)) return null;
	if (def.kind !== "server" && def.kind !== "task") {
		warnings.push(`service '${name}': 'kind' must be 'server' or 'task'`);
		return null;
	}
	if (typeof def.cmd !== "string" || def.cmd.trim() === "") {
		warnings.push(`service '${name}': 'cmd' required`);
		return null;
	}
	const cwd = typeof def.cwd === "string" && def.cwd.trim() !== "" ? def.cwd : ".";
	const env = def.env !== undefined && isStringRecord(def.env) ? def.env : {};
	const autoStart = def.autoStart === true;
	let readyPattern;
	if (typeof def.readyPattern === "string") {
		try {
			new RegExp(def.readyPattern);
			readyPattern = def.readyPattern;
		} catch {
			warnings.push(`service '${name}': invalid readyPattern`);
		}
	}
	return { name, kind: def.kind, cmd: def.cmd, cwd, env, autoStart, readyPattern };
}

export function resolveServiceCwd(projectCwd, cwd) {
	if (isAbsolute(cwd)) throw new Error(`service cwd must be relative: ${cwd}`);
	const resolved = resolve(projectCwd, cwd);
	const rel = relative(projectCwd, resolved);
	if (rel === ".." || rel.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)) {
		throw new Error(`service cwd escapes project root: ${cwd}`);
	}
	return resolved;
}
