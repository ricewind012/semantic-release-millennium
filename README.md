# semantic-release-millennium

This plugin updates the version in your `millennium.toml` and optionally opens a pull request to add or update your Millennium plugin in the [plugin database][plugin-db].

> [!NOTE]
> You still need to check the boxes in the PR template.

## Usage

### Config

```js
export default {
	plugins: [
		"@semantic-release/commit-analyzer",
		"@semantic-release/release-notes-generator",
		"@semantic-release/npm",
		"@semantic-release/github",
		"@ricewind012/semantic-release-millennium",
		[
			"@semantic-release/git",
			{
				assets: ["millennium.toml", "package.json", "package-lock.json"],
			},
		],
	],
};
```

The [@semantic-release/commit-analyzer][sr-commit-analyzer] and [@semantic-release/release-notes-generator][sr-release-notes-generator] plugins must run _before_ this one so they can generate the release notes used in the PR template.

The [@semantic-release/git][sr-git] plugin must run _after_ this one so it can commit the updated version in `millennium.toml`.

### GitHub Actions

If `prCreationMode` is not disabled, create a personal access token with the `public_repo` scope.

## Environment Variables

| Variable    | Description                                                                                                 |
| ----------- | ----------------------------------------------------------------------------------------------------------- |
| `PAT_TOKEN` | Personal access token so the plugin can fork the plugin database repository and open the PR on your behalf. |

## Options

| Option           | Description                                                                                                                             | Default      |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| `prCreationMode` | `"commit-only"` pushes a commit to your fork but does not open a PR; `"open-pr"` opens the PR automatically (except the first release). | `"disabled"` |

[plugin-db]: https://github.com/SteamClientHomebrew/PluginDatabase
[sr-commit-analyzer]: https://github.com/semantic-release/commit-analyzer
[sr-git]: https://github.com/semantic-release/git
[sr-github]: https://github.com/semantic-release/github
[sr-release-notes-generator]: https://github.com/semantic-release/release-notes-generator
