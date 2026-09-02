import { db } from "@/lib/db";
import type { Account } from "@prisma/client";

export type GithubAuthError =
	| "NO_GITHUB_ACCOUNT"
	| "NO_ACCESS_TOKEN"
	| "MISSING_REPO_SCOPE";

export type GithubTokenResult =
	| { ok: true; token: string; account: Account }
	| { ok: false; error: GithubAuthError };

export async function getGithubAccount(
	userId: string,
): Promise<Account | null> {
	return db.account.findFirst({
		where: { userId, provider: "github" },
	});
}

export function hasRepoScope(account: Pick<Account, "scope"> | null): boolean {
	if (!account?.scope) return false;
	const scopes = account.scope.split(/[\s,]+/).filter(Boolean);
	return scopes.includes("repo");
}

export async function getGithubAccessToken(
	userId: string,
): Promise<GithubTokenResult> {
	const account = await getGithubAccount(userId);
	if (!account) {
		return { ok: false, error: "NO_GITHUB_ACCOUNT" };
	}
	if (!account.accessToken) {
		return { ok: false, error: "NO_ACCESS_TOKEN" };
	}
	if (!hasRepoScope(account)) {
		return { ok: false, error: "MISSING_REPO_SCOPE" };
	}
	return { ok: true, token: account.accessToken, account };
}

export function githubAuthErrorMessage(error: GithubAuthError): string {
	switch (error) {
		case "NO_GITHUB_ACCOUNT":
			return "Connect your GitHub account to import repositories";
		case "NO_ACCESS_TOKEN":
			return "GitHub access token missing. Please reconnect GitHub";
		case "MISSING_REPO_SCOPE":
			return "Grant repository access to import private repos";
		default:
			return "GitHub authentication required";
	}
}
