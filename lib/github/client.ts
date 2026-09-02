import { Octokit } from "@octokit/rest";

export function createGithubClient(accessToken: string): Octokit {
	return new Octokit({ auth: accessToken });
}
