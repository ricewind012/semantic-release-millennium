import { type ExecException, execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { TomlFile } from "./toml.js";

const execFileAsync = promisify(execFile);

type PrCreationMode =
	/** Do nothing. */
	| "disabled"
	/** Commit update to fork, but open a PR manually. */
	| "commit-only"
	/** Automatically open a PR. */
	| "open-pr";

export const DEFAULT_CONFIG: PluginConfig = {
	prCreationMode: "disabled",
};
export const MILLENNIUM_CONFIG_FILE = "millennium.toml";

/** @see https://docs.steambrew.app/plugins/structure/config */
interface MillenniumPluginConfig {
	plugin: {
		author: string;
		description: string;
		id: string;
		name: string;
		version: string;
	};
}

interface PluginConfig {
	/** Controls the plugin database update. */
	prCreationMode: PrCreationMode;
}

interface RunOptions {
	allowedExitCodes: number[];
	env: Record<string, string>;
}

export const millenniumConfig = new TomlFile<MillenniumPluginConfig>(
	MILLENNIUM_CONFIG_FILE,
);
export const tmpDir = await mkdtemp(join(tmpdir(), "plugin-database-"));

export async function cleanup() {
	await rm(tmpDir, { force: true, recursive: true });
}

export async function run(
	command: string,
	args: readonly string[],
	options: Partial<RunOptions> = {},
) {
	try {
		const { stdout } = await execFileAsync(command, args, {
			encoding: "utf8",
			env: { ...process.env, ...options.env },
		});
		return { code: 0, output: stdout.trim() };
	} catch (ex) {
		const error = ex as ExecException;
		const code = Number(error.code);
		const output = error.stderr?.toString().trim() || error.message;
		if (options.allowedExitCodes?.includes(code)) {
			return { code, output };
		}

		throw new Error(`${command} ${args.join(" ")} failed: ${output}`);
	}
}
