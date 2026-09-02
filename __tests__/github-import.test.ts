import { describe, it, expect } from "vitest";
import { parseGithubUrl } from "@/lib/github/parse-url";
import { hasRepoScope } from "@/lib/github/auth";
import {
	filterBinaryPlaceholder,
	isBinaryExtension,
	shouldTreatAsBinary,
} from "@/lib/github/to-template";
import type { TemplateFolder } from "@/modules/playground/lib/path-to-json";
import {
	ImportGithubRepoSchema,
	SyncGithubRepoSchema,
} from "@/lib/api-schemas";

describe("parseGithubUrl", () => {
	it("parses owner/repo shorthand", () => {
		expect(parseGithubUrl("vercel/next.js")).toEqual({
			owner: "vercel",
			repo: "next.js",
		});
	});

	it("parses https URLs with trailing slash and .git", () => {
		expect(parseGithubUrl("https://github.com/owner/repo.git/")).toEqual({
			owner: "owner",
			repo: "repo",
		});
	});

	it("parses SSH URLs", () => {
		expect(parseGithubUrl("git@github.com:owner/repo.git")).toEqual({
			owner: "owner",
			repo: "repo",
		});
	});

	it("rejects non-GitHub hosts", () => {
		expect(() => parseGithubUrl("https://gitlab.com/owner/repo")).toThrow(
			/github.com/,
		);
	});

	it("rejects empty input", () => {
		expect(() => parseGithubUrl("")).toThrow(/required/i);
	});
});

describe("hasRepoScope", () => {
	it("returns true when repo scope is present", () => {
		expect(hasRepoScope({ scope: "read:user user:email repo" })).toBe(true);
	});

	it("returns false when repo scope is missing", () => {
		expect(hasRepoScope({ scope: "read:user user:email" })).toBe(false);
	});

	it("returns false for null account", () => {
		expect(hasRepoScope(null)).toBe(false);
	});
});

describe("binary file helpers", () => {
	it("detects binary extensions", () => {
		expect(isBinaryExtension("png")).toBe(true);
		expect(isBinaryExtension(".woff2")).toBe(true);
		expect(isBinaryExtension("ts")).toBe(false);
		expect(shouldTreatAsBinary("logo.png")).toBe(true);
		expect(shouldTreatAsBinary("index.tsx")).toBe(false);
	});

	it("replaces binary file content with placeholder", () => {
		const folder: TemplateFolder = {
			folderName: "root",
			items: [
				{
					filename: "logo",
					fileExtension: "png",
					content: "binary-bytes",
				},
				{
					filename: "index",
					fileExtension: "ts",
					content: " console.log(1)",
				},
			],
		};

		filterBinaryPlaceholder(folder);

		const logo = folder.items[0] as {
			filename: string;
			content: string;
		};
		const index = folder.items[1] as {
			filename: string;
			content: string;
		};

		expect(logo.content).toContain("Binary file omitted");
		expect(index.content).toBe(" console.log(1)");
	});
});

describe("GitHub import schemas", () => {
	it("accepts valid import payload", () => {
		const result = ImportGithubRepoSchema.safeParse({
			repoUrl: "owner/repo",
			branch: "main",
			title: "My Project",
		});
		expect(result.success).toBe(true);
	});

	it("rejects empty repoUrl", () => {
		const result = ImportGithubRepoSchema.safeParse({ repoUrl: "" });
		expect(result.success).toBe(false);
	});

	it("accepts sync payload", () => {
		const result = SyncGithubRepoSchema.safeParse({
			playgroundId: "ckxyz123",
		});
		expect(result.success).toBe(true);
	});
});
