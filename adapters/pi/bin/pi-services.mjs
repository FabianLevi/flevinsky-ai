#!/usr/bin/env node
import { spawn } from "node:child_process";
import {
	createWriteStream,
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

const STATUS = {
	RUNNING: "running",
	EXITED: "exited",
};

function usage(exitCode = 1) {
	const out = exitCode === 0 ? process.stdout : process.stderr;
	out.write(
		`Usage:\n  pi-services run <service> -- <cmd> [args...]\n\nExample:\n  pi-services run frontend -- pnpm dev\n`,
	);
	process.exit(exitCode);
}

function fail(message, exitCode = 1) {
	process.stderr.write(`pi-services: ${message}\n`);
	process.exit(exitCode);
}

const CANONICAL_DIR = ".flevinsky-ai";
const CANDIDATES = [".flevinsky-ai", ".services", ".pi", ".claude"];

function findProjectCwd(start) {
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

function readJson(path) {
	try {
		return JSON.parse(readFileSync(path, "utf8"));
	} catch (err) {
		fail(`failed to read ${path}: ${err.message}`);
	}
}

function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function loadService(projectCwd, prefix, name) {
	const configPath = join(projectCwd, prefix, "services.json");
	const raw = readJson(configPath);
	if (!isRecord(raw.services))
		fail(`${configPath}: missing object key 'services'`);
	const svc = raw.services[name];
	if (!isRecord(svc)) fail(`unknown service '${name}' in ${configPath}`);
	if (svc.kind !== "server" && svc.kind !== "task") {
		fail(`service '${name}': 'kind' must be 'server' or 'task'`);
	}
	const cmd = typeof svc.cmd === "string" ? svc.cmd : "";
	const cwd =
		typeof svc.cwd === "string" && svc.cwd.trim() !== "" ? svc.cwd : ".";
	const env = isRecord(svc.env)
		? Object.fromEntries(
				Object.entries(svc.env).filter(([, v]) => typeof v === "string"),
			)
		: {};
	return { name, kind: svc.kind, cmd, cwd, env };
}

function resolveServiceCwd(projectCwd, cwd) {
	if (isAbsolute(cwd))
		fail(`service cwd must be relative to project root: ${cwd}`);
	const resolved = resolve(projectCwd, cwd);
	const rel = relative(projectCwd, resolved);
	if (
		rel === ".." ||
		rel.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)
	) {
		fail(`service cwd escapes project root: ${cwd}`);
	}
	return resolved;
}

function stateDir(projectCwd, prefix) {
	return join(projectCwd, prefix, "services");
}

function logDir(projectCwd, prefix) {
	return join(stateDir(projectCwd, prefix), "logs");
}

function statePath(projectCwd, prefix) {
	return join(stateDir(projectCwd, prefix), "state.json");
}

function logPathFor(projectCwd, prefix, name) {
	return join(logDir(projectCwd, prefix), `${name}.log`);
}

function readState(projectCwd, prefix) {
	try {
		const parsed = JSON.parse(readFileSync(statePath(projectCwd, prefix), "utf8"));
		return isRecord(parsed) ? parsed : {};
	} catch {
		return {};
	}
}

function writeState(projectCwd, prefix, state) {
	mkdirSync(stateDir(projectCwd, prefix), { recursive: true });
	mkdirSync(logDir(projectCwd, prefix), { recursive: true });
	const target = statePath(projectCwd, prefix);
	const tmp = `${target}.tmp`;
	writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`);
	renameSync(tmp, target);
}

function shellQuotePart(part) {
	if (/^[A-Za-z0-9_/:=.,@%+-]+$/.test(part)) return part;
	return `'${part.replaceAll("'", `'\\''`)}'`;
}

function displayCommand(args) {
	return args.map(shellQuotePart).join(" ");
}

function exitCodeFor(code, signal) {
	if (typeof code === "number") return code;
	if (signal === "SIGINT") return 130;
	if (signal === "SIGTERM") return 143;
	return 1;
}

function writeEntry(projectCwd, prefix, name, patch) {
	const state = readState(projectCwd, prefix);
	writeState(projectCwd, prefix, { ...state, [name]: patch });
}

function patchEntryForPid(projectCwd, prefix, name, pid, patch) {
	const state = readState(projectCwd, prefix);
	const current = state[name];
	if (!current || current.pid !== pid) return;
	writeState(projectCwd, prefix, { ...state, [name]: { ...current, ...patch } });
}

async function runService(args) {
	const service = args[1];
	if (!service || args[2] !== "--" || args.length < 4) usage();
	const cmdArgs = args.slice(3);
	const { cwd: projectCwd, prefix } = findProjectCwd(process.cwd());
	const svc = loadService(projectCwd, prefix, service);
	const serviceCwd = resolveServiceCwd(projectCwd, svc.cwd);
	const logPath = logPathFor(projectCwd, prefix, service);
	mkdirSync(dirname(logPath), { recursive: true });

	const log = createWriteStream(logPath, { flags: "w" });
	const child = spawn(cmdArgs[0], cmdArgs.slice(1), {
		cwd: serviceCwd,
		env: { ...process.env, ...svc.env },
		stdio: ["inherit", "pipe", "pipe"],
	});

	let settled = false;
	let requestedSignal = null;

	child.stdout?.on("data", (chunk) => {
		process.stdout.write(chunk);
		log.write(chunk);
	});
	child.stderr?.on("data", (chunk) => {
		process.stderr.write(chunk);
		log.write(chunk);
	});

	child.once("spawn", () => {
		writeEntry(projectCwd, prefix, service, {
			pid: child.pid,
			status: STATUS.RUNNING,
			kind: svc.kind,
			cmd: displayCommand(cmdArgs),
			runner: "attached",
			startedAt: new Date().toISOString(),
		});
	});

	child.once("error", (err) => {
		settled = true;
		log.end();
		writeEntry(projectCwd, prefix, service, {
			pid: child.pid ?? 0,
			status: STATUS.EXITED,
			kind: svc.kind,
			cmd: displayCommand(cmdArgs),
			runner: "attached",
			startedAt: new Date().toISOString(),
			exitedAt: new Date().toISOString(),
			exitSignal: "ERROR",
		});
		fail(`failed to start '${service}': ${err.message}`);
	});

	const forward = (signal) => {
		requestedSignal = signal;
		if (typeof child.pid === "number") {
			try {
				child.kill(signal);
			} catch {
				/* already gone */
			}
		}
	};
	process.once("SIGINT", () => forward("SIGINT"));
	process.once("SIGTERM", () => forward("SIGTERM"));

	child.once("exit", (code, signal) => {
		if (settled) return;
		settled = true;
		log.end(() => {
			if (typeof child.pid === "number") {
				patchEntryForPid(projectCwd, prefix, service, child.pid, {
					status: STATUS.EXITED,
					exitedAt: new Date().toISOString(),
					exitCode: code ?? undefined,
					exitSignal: signal ?? requestedSignal ?? undefined,
				});
			}
			process.exit(exitCodeFor(code, signal ?? requestedSignal));
		});
	});
}

const args = process.argv.slice(2);
if (args.length === 0 || args[0] === "--help" || args[0] === "-h") usage(0);
if (args[0] === "run") {
	await runService(args);
} else {
	usage();
}
