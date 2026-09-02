import fs from "fs/promises";
import os from "os";
import path from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { createGunzip } from "zlib";
import { x as tarExtract } from "tar";
import type { Octokit } from "@octokit/rest";
import { scanTemplateDirectory } from "@/modules/playground/lib/path-to-json";
import type { TemplateFolder } from "@/modules/playground/lib/path-to-json";
import { filterBinaryPlaceholder } from "./to-template";

export type ImportedRepoContent = {
	template: TemplateFolder;
	commitSha: string;
};

async function extractTarballBuffer(
	buffer: Buffer,
	destDir: string,
): Promise<void> {
	await fs.mkdir(destDir, { recursive: true });
	await pipeline(
		Readable.from(buffer),
		createGunzip(),
		tarExtract({ cwd: destDir, strip: 1 }),
	);
}

/**
 * Download a GitHub repo tarball at `ref`, extract it, and convert to TemplateFolder.
 */
export async function downloadAndConvertRepo(
	octokit: Octokit,
	owner: string,
	repo: string,
	ref: string,
	accessToken: string,
): Promise<ImportedRepoContent> {
	const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "coed-gh-"));
	const extractDir = path.join(tempRoot, "repo");

	try {
		const tarballUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/tarball/${encodeURIComponent(ref)}`;

		const response = await fetch(tarballUrl, {
			headers: {
				Authorization: `Bearer ${accessToken}`,
				Accept: "application/vnd.github+json",
				"User-Agent": "coed-github-import",
				"X-GitHub-Api-Version": "2022-11-28",
			},
			redirect: "follow",
		});

		if (!response.ok) {
			if (response.status === 404) {
				throw new Error("Repository or branch not found");
			}
			if (response.status === 403) {
				throw new Error("Access denied to this repository");
			}
			throw new Error(`Failed to download repository archive (${response.status})`);
		}

		const arrayBuffer = await response.arrayBuffer();
		if (arrayBuffer.byteLength === 0) {
			throw new Error("Repository appears to be empty");
		}

		await extractTarballBuffer(Buffer.from(arrayBuffer), extractDir);

		let entries: string[] = [];
		try {
			entries = await fs.readdir(extractDir);
		} catch {
			throw new Error("Repository appears to be empty");
		}

		if (entries.length === 0) {
			throw new Error("Repository appears to be empty");
		}

		const template = await scanTemplateDirectory(extractDir, {
			ignoreFolders: [
				"node_modules",
				".git",
				".vscode",
				".idea",
				"dist",
				"build",
				"coverage",
				".next",
				".nuxt",
				".cache",
			],
			maxFileSize: 1024 * 1024,
		});

		template.folderName = repo;
		filterBinaryPlaceholder(template);

		const commitResponse = await octokit.rest.repos.getCommit({
			owner,
			repo,
			ref,
		});

		return {
			template,
			commitSha: commitResponse.data.sha,
		};
	} finally {
		await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => {});
	}
}
