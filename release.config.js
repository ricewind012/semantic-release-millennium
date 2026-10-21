/** biome-ignore-all lint/suspicious/noTemplateCurlyInString: Lodash template */

/** @type {import("semantic-release").GlobalConfig} */
export default {
	plugins: [
		"@semantic-release/commit-analyzer",
		"@semantic-release/release-notes-generator",
		"@sebbo2002/semantic-release-jsr",
		"@semantic-release/npm",
		"@semantic-release/git",
		"@semantic-release/github",
	],
};
