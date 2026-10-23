import { readFile } from "node:fs/promises";
import { join } from "node:path";
import SemanticReleaseError from "@semantic-release/error";
import type { PublishContext } from "semantic-release";

import { DEFAULT_CONFIG, millenniumConfig, run, tmpDir } from "../shared.js";

const DB_REPO = "SteamClientHomebrew/PluginDatabase";
const PAT_TOKEN = process.env.PAT_TOKEN ?? "";

function runGitAsMe(login: string, email: string, args: readonly string[]) {
	return run("git", args, {
		env: {
			GH_TOKEN: PAT_TOKEN,
			GIT_AUTHOR_EMAIL: email,
			GIT_AUTHOR_NAME: login,
			GIT_COMMITTER_EMAIL: email,
			GIT_COMMITTER_NAME: login,
		},
	});
}

function runGhCli(args: readonly string[]) {
	return run("gh", args, { env: { GH_TOKEN: PAT_TOKEN } });
}

export async function publish(config = DEFAULT_CONFIG, ctx: PublishContext) {
	if (config.prCreationMode === "disabled") {
		ctx.logger.log("PR creation is disabled, skipped creating a PR");
		return;
	}

	// prepare semantic-release
	const { repositoryUrl } = ctx.options;
	const { notes, gitTag, version } = ctx.nextRelease;
	if (!repositoryUrl || !notes) {
		const obj = JSON.stringify({ notes, repositoryUrl });
		throw new SemanticReleaseError(
			`semantic-release did not pass one of: ${obj}`,
		);
	}

	// fork
	await runGhCli(["repo", "fork", DB_REPO, "--clone", "--", tmpDir]);
	process.chdir(tmpDir);

	// prepare
	const { output: account } = await runGhCli([
		"api",
		"user",
		"--jq",
		"[.id, .login] | @tsv",
	]);
	const [accountId, login] = account.split(/\s+/);
	const email = `${accountId}+${login}@users.noreply.github.com`;
	await run("git", ["config", "credential.helper", "!gh auth git-credential"]);

	// real shit
	const { output: defBranch } = await run("git", [
		"symbolic-ref",
		"--short",
		"refs/remotes/origin/HEAD",
	]);
	const [, databaseBranch] = defBranch.split("/");
	await run("git", ["fetch", "upstream", databaseBranch]);

	const [, repoName] = new URL(repositoryUrl).pathname.slice(1).split("/");
	// Find an existing PR and use its branch instead of creating a new one.
	// Don't update the body because it's just spam
	const { output: existingPrBranch } = await runGhCli([
		"pr",
		"list",
		`--repo=${DB_REPO}`,
		"--state=open",
		`--base=${databaseBranch}`,
		"--json=headRefName",
		"--jq",
		`[.[] | select(.headRefName | startswith("${repoName}/v")) | .headRefName] | first // empty`,
	]);
	const prBranch = existingPrBranch || `${repoName}/v${version}`;
	if (existingPrBranch) {
		await run("git", ["pull", databaseBranch, existingPrBranch]);
		await run("git", ["switch", prBranch, "FETCH_HEAD"]);
	} else {
		await run("git", ["switch", "-c", prBranch, "FETCH_HEAD"]);
	}

	const submodulePath = join("plugins", repoName);
	const submodules = await run(
		"git",
		["config", "-f", ".gitmodules", "--get", `submodule.${submodulePath}.path`],
		{ allowedExitCodes: [1] },
	);
	const hasSubmodules = submodules.code === 0;
	await run(
		"git",
		hasSubmodules
			? ["submodule", "update", "--init", submodulePath]
			: ["submodule", "add", repositoryUrl, submodulePath],
	);

	await run("git", ["-C", submodulePath, "fetch", "origin", "--tags"]);
	const { output: targetCommit } = await run("git", [
		"-C",
		submodulePath,
		"rev-parse",
		"--verify",
		`${gitTag}^{commit}`,
	]);
	await run("git", ["-C", submodulePath, "checkout", "--detach", targetCommit]);
	const diff = await run(
		"git",
		["diff", "--exit-code", "--quiet", ".gitmodules", submodulePath],
		{ allowedExitCodes: [1] },
	);
	if (diff.code === 0) {
		ctx.logger.log("Plugin database already references this release");
		return;
	}

	const firstRelease = version === "1.0.0";
	const { plugin } = millenniumConfig.content;
	const commitMsg = firstRelease
		? `Add ${plugin.name}`
		: `Update ${plugin.name} to ${version}`;
	await run("git", ["add", ".gitmodules", submodulePath]);
	await runGitAsMe(login, email, ["commit", "-m", commitMsg]);
	await runGitAsMe(login, email, ["push", "-u", "origin", prBranch]);

	const msg = (() => {
		switch (true) {
			case !!existingPrBranch:
				return "there is already an open PR";
			case config.prCreationMode === "commit-only":
				return "PR creation mode is commit-only";
			case firstRelease && config.prCreationMode === "open-pr":
				return "first release";
		}
	})();
	if (msg) {
		ctx.logger.log(`Pushed update to fork, skipped creating PR because ${msg}`);
		return;
	}

	const title = firstRelease ? `Add ${plugin.name}` : `Update ${plugin.name}`;
	const templatePath = firstRelease
		? "pull_request_template.md"
		: join("PULL_REQUEST_TEMPLATE", "PLUGIN-UPDATE.md");
	const template = await readFile(join(".github", templatePath), "utf8");
	const body = template
		.replace("# REPLACE_WITH_PLUGIN_NAME", `# ${plugin.name}`)
		.replace(/REPLACE_WITH_UPDATE_SUMMARY/g, notes.replace(/^# [^\n]+/, ""));
	await runGhCli([
		"pr",
		"create",
		`--repo=${DB_REPO}`,
		`--base=${databaseBranch}`,
		`--head=${login}:${prBranch}`,
		`--title=${title}`,
		`--body=${body}`,
	]);
	ctx.logger.log(`Opened plugin database PR for ${version}`);
}
