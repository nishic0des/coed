import type { Octokit } from "@octokit/rest";

export type GithubRepoSummary = {
	fullName: string;
	owner: string;
	name: string;
	defaultBranch: string;
	private: boolean;
	description: string | null;
	htmlUrl: string;
};

export async function getRepoMetadata(
	octokit: Octokit,
	owner: string,
	repo: string,
): Promise<GithubRepoSummary> {
	try {
		const { data } = await octokit.rest.repos.get({ owner, repo });
		return {
			fullName: data.full_name,
			owner: data.owner.login,
			name: data.name,
			defaultBranch: data.default_branch,
			private: data.private,
			description: data.description,
			htmlUrl: data.html_url,
		};
	} catch (error) {
		const status = (error as { status?: number }).status;
		if (status === 404) {
			throw new Error("Repository not found");
		}
		if (status === 403) {
			throw new Error("Access denied to this repository");
		}
		throw new Error("Failed to fetch repository metadata");
	}
}

export async function getCommitSha(
	octokit: Octokit,
	owner: string,
	repo: string,
	ref: string,
): Promise<string> {
	const { data } = await octokit.rest.repos.getCommit({
		owner,
		repo,
		ref,
	});
	return data.sha;
}

export async function listUserRepos(
	octokit: Octokit,
	options: { search?: string; page?: number; perPage?: number } = {},
): Promise<{ repos: GithubRepoSummary[]; hasMore: boolean }> {
	const page = options.page ?? 1;
	const perPage = options.perPage ?? 30;
	const search = options.search?.trim().toLowerCase();

	const { data } = await octokit.rest.repos.listForAuthenticatedUser({
		page,
		per_page: perPage,
		sort: "updated",
		affiliation: "owner,collaborator,organization_member",
	});

	let repos: GithubRepoSummary[] = data.map((item) => ({
		fullName: item.full_name,
		owner: item.owner.login,
		name: item.name,
		defaultBranch: item.default_branch,
		private: item.private,
		description: item.description,
		htmlUrl: item.html_url,
	}));

	if (search) {
		repos = repos.filter(
			(repo) =>
				repo.fullName.toLowerCase().includes(search) ||
				(repo.description?.toLowerCase().includes(search) ?? false),
		);
	}

	return { repos, hasMore: data.length === perPage && !search };
}
