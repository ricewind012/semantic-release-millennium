import { existsSync } from "node:fs";
import SemanticReleaseError from "@semantic-release/error";
import type { VerifyConditionsContext } from "semantic-release";

import { DEFAULT_CONFIG, MILLENNIUM_CONFIG_FILE } from "../shared.js";

export async function verifyConditions(
	config = DEFAULT_CONFIG,
	_ctx: VerifyConditionsContext,
) {
	if (!existsSync(MILLENNIUM_CONFIG_FILE)) {
		throw new SemanticReleaseError(`${MILLENNIUM_CONFIG_FILE} was not found`);
	}

	if (config.prCreationMode !== "disabled" && !process.env.PAT_TOKEN) {
		throw new SemanticReleaseError("PAT_TOKEN is required to do GitHub stuff");
	}
}
