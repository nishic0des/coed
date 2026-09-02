export type ParsedGithubRepo = {
	owner: string;
	repo: string;
};

/**
 * Parse GitHub repo identifiers into owner/repo.
 * Accepts:
 * - https://github.com/owner/repo
 * - https://github.com/owner/repo.git
 * - git@github.com:owner/repo.git
 * - owner/repo
 */
export function parseGithubUrl(input: string): ParsedGithubRepo {
	const trimmed = input.trim();
	if (!trimmed) {
		throw new Error("Repository URL is required");
	}

	// owner/repo shorthand
	const shorthand = trimmed.match(
		/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/,
	);
	if (shorthand && !trimmed.includes("://") && !trimmed.includes("@")) {
		return { owner: shorthand[1], repo: shorthand[2] };
	}

	// SSH: git@github.com:owner/repo.git
	const sshMatch = trimmed.match(
		/^git@github\.com:([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/,
	);
	if (sshMatch) {
		return { owner: sshMatch[1], repo: sshMatch[2] };
	}

	// HTTPS URLs
	let url: URL;
	try {
		url = new URL(trimmed);
	} catch {
		throw new Error(
			"Invalid repository URL. Use owner/repo or https://github.com/owner/repo",
		);
	}

	if (!["github.com", "www.github.com"].includes(url.hostname)) {
		throw new Error("Only github.com repository URLs are supported");
	}

	const parts = url.pathname.split("/").filter(Boolean);
	if (parts.length < 2) {
		throw new Error("Repository URL must include owner and repo name");
	}

	const owner = parts[0];
	const repo = parts[1].replace(/\.git$/i, "");

	if (!owner || !repo) {
		throw new Error("Could not parse owner and repo from URL");
	}

	return { owner, repo };
}
