import { readFileSync } from "node:fs";

export const ERROR_PATTERN = /\b(error|err|fatal|panic|fail(ed)?|traceback|exception)\b/i;

export function tailLogFile(logPath, { tail = 100, grep, since } = {}) {
	let raw;
	try {
		raw = readFileSync(logPath, "utf8");
	} catch (err) {
		if (err.code === "ENOENT") return { lines: [], truncated: false, warnings: [] };
		return { lines: [], truncated: false, warnings: [err.message] };
	}
	let lines = raw.split("\n");
	if (lines.at(-1) === "") lines.pop();
	const warnings = [];

	if (since) {
		const cutoff = Date.parse(since);
		if (!Number.isNaN(cutoff)) {
			lines = lines.filter((l) => {
				const m = l.match(/^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)/);
				if (!m) return true;
				const t = Date.parse(m[1]);
				return Number.isNaN(t) ? true : t >= cutoff;
			});
		} else {
			warnings.push(`since: not a parseable timestamp: ${since}`);
		}
	}

	if (grep) {
		try {
			const re = new RegExp(grep, "i");
			lines = lines.filter((l) => re.test(l));
		} catch (err) {
			warnings.push(`grep: invalid regex: ${err.message}`);
		}
	}

	const truncated = lines.length > tail;
	if (truncated) lines = lines.slice(-tail);
	return { lines, truncated, warnings };
}

export function extractRecentErrors(logPath, scanLines, max) {
	const { lines } = tailLogFile(logPath, { tail: scanLines });
	const errs = lines.filter((l) => ERROR_PATTERN.test(l));
	return errs.slice(-max);
}

export function clampString(s, max) {
	if (s.length <= max) return s;
	return `${s.slice(0, max - 1)}…`;
}
