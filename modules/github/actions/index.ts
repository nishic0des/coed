"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import {
	ImportGithubRepoSchema,
	ListGithubReposSchema,
	SyncGithubRepoSchema,
} from "@/lib/api-schemas";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import {
	getGithubAccessToken,
	getGithubAccount,
	githubAuthErrorMessage,
	hasRepoScope,
} from "@/lib/github/auth";
import { createGithubClient } from "@/lib/github/client";
import { downloadAndConvertRepo } from "@/lib/github/import";
import { parseGithubUrl } from "@/lib/github/parse-url";
import {
	getRepoMetadata,
	listUserRepos,
	type GithubRepoSummary,
} from "@/lib/github/repos";
import { currentUser } from "@/modules/auth/actions";
import { assertPlaygroundOwner } from "@/modules/playground/lib/playground-auth";

export type GithubConnectionStatus = {
	connected: boolean;
	hasRepoScope: boolean;
};

export async function getGithubConnectionStatus(): Promise<
	ActionResult<GithubConnectionStatus>
> {
	const user = await currentUser();
	if (!user?.id) return fail("Unauthorized");

	const account = await getGithubAccount(user.id);
	return ok({
		connected: !!account,
		hasRepoScope: hasRepoScope(account),
	});
}

export async function listGithubRepos(input: {
	search?: string;
	page?: number;
}): Promise<
	ActionResult<{ repos: GithubRepoSummary[]; hasMore: boolean }>
> {
	const user = await currentUser();
	if (!user?.id) return fail("Unauthorized");

	const parsed = ListGithubReposSchema.safeParse(input);
	if (!parsed.success) {
		return fail(parsed.error.issues[0]?.message ?? "Invalid input");
	}

	const tokenResult = await getGithubAccessToken(user.id);
	if (!tokenResult.ok) {
		return fail(githubAuthErrorMessage(tokenResult.error));
	}

	try {
		const octokit = createGithubClient(tokenResult.token);
		const result = await listUserRepos(octokit, {
			search: parsed.data.search,
			page: parsed.data.page,
		});
		return ok(result);
	} catch (error) {
		console.error("listGithubRepos error:", error);
		return fail("Failed to list GitHub repositories");
	}
}

export async function importGithubRepo(input: {
	repoUrl: string;
	branch?: string;
	title?: string;
}): Promise<ActionResult<{ id: string }>> {
	const user = await currentUser();
	if (!user?.id) return fail("Unauthorized");

	const parsed = ImportGithubRepoSchema.safeParse(input);
	if (!parsed.success) {
		return fail(parsed.error.issues[0]?.message ?? "Invalid input");
	}

	const limit = await rateLimit(`github-import:${user.id}`, {
		limit: 5,
		windowMs: 10 * 60 * 1000,
	});
	if (!limit.success) {
		return fail("Too many imports. Please wait a few minutes and try again.");
	}

	const tokenResult = await getGithubAccessToken(user.id);
	if (!tokenResult.ok) {
		return fail(githubAuthErrorMessage(tokenResult.error));
	}

	let owner: string;
	let repo: string;
	try {
		({ owner, repo } = parseGithubUrl(parsed.data.repoUrl));
	} catch (error) {
		return fail(
			error instanceof Error ? error.message : "Invalid repository URL",
		);
	}

	try {
		const octokit = createGithubClient(tokenResult.token);
		const metadata = await getRepoMetadata(octokit, owner, repo);
		const branch = parsed.data.branch?.trim() || metadata.defaultBranch;

		const { template, commitSha } = await downloadAndConvertRepo(
			octokit,
			owner,
			repo,
			branch,
			tokenResult.token,
		);

		if (!template.items || template.items.length === 0) {
			return fail("Repository appears to be empty");
		}

		const title =
			parsed.data.title?.trim() || metadata.name || `${owner}/${repo}`;

		const playground = await db.playground.create({
			data: {
				title,
				description: metadata.description ?? `Imported from ${metadata.fullName}`,
				template: "IMPORTED",
				sourceType: "GITHUB",
				githubOwner: owner,
				githubRepo: repo,
				githubBranch: branch,
				githubCommitSha: commitSha,
				githubRepoUrl: metadata.htmlUrl,
				userId: user.id,
			},
		});

		await db.templateFile.create({
			data: {
				playgroundId: playground.id,
				content: template as unknown as Prisma.InputJsonValue,
			},
		});

		revalidatePath("/dashboard");
		return ok({ id: playground.id });
	} catch (error) {
		console.error("importGithubRepo error:", error);
		const message =
			error instanceof Error ? error.message : "Failed to import repository";
		return fail(message);
	}
}

export async function syncGithubRepo(input: {
	playgroundId: string;
}): Promise<
	ActionResult<{ commitSha: string; unchanged: boolean }>
> {
	const user = await currentUser();
	if (!user?.id) return fail("Unauthorized");

	const parsed = SyncGithubRepoSchema.safeParse(input);
	if (!parsed.success) {
		return fail(parsed.error.issues[0]?.message ?? "Invalid input");
	}

	const limit = await rateLimit(`github-sync:${user.id}`, {
		limit: 10,
		windowMs: 10 * 60 * 1000,
	});
	if (!limit.success) {
		return fail("Too many sync requests. Please wait a few minutes.");
	}

	try {
		await assertPlaygroundOwner(parsed.data.playgroundId, user.id);

		const playground = await db.playground.findUnique({
			where: { id: parsed.data.playgroundId },
			include: { templateFiles: { take: 1 } },
		});

		if (!playground) return fail("Playground not found");
		if (playground.sourceType !== "GITHUB") {
			return fail("This playground is not linked to a GitHub repository");
		}
		if (
			!playground.githubOwner ||
			!playground.githubRepo ||
			!playground.githubBranch
		) {
			return fail("GitHub repository metadata is incomplete");
		}

		const tokenResult = await getGithubAccessToken(user.id);
		if (!tokenResult.ok) {
			return fail(githubAuthErrorMessage(tokenResult.error));
		}

		const octokit = createGithubClient(tokenResult.token);
		const { template, commitSha } = await downloadAndConvertRepo(
			octokit,
			playground.githubOwner,
			playground.githubRepo,
			playground.githubBranch,
			tokenResult.token,
		);

		if (playground.githubCommitSha === commitSha) {
			return ok({ commitSha, unchanged: true });
		}

		await db.templateFile.upsert({
			where: { playgroundId: playground.id },
			update: {
				content: template as unknown as Prisma.InputJsonValue,
			},
			create: {
				playgroundId: playground.id,
				content: template as unknown as Prisma.InputJsonValue,
			},
		});

		await db.playground.update({
			where: { id: playground.id },
			data: { githubCommitSha: commitSha },
		});

		revalidatePath("/dashboard");
		revalidatePath(`/playground/${playground.id}`);
		return ok({ commitSha, unchanged: false });
	} catch (error) {
		console.error("syncGithubRepo error:", error);
		const message =
			error instanceof Error ? error.message : "Failed to sync repository";
		return fail(message);
	}
}
