"use server";

import { db } from "@/lib/db";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { TemplateFolder } from "../lib/path-to-json";
import { currentUser } from "@/modules/auth/actions";
import { assertPlaygroundOwner } from "../lib/playground-auth";
import type { TemplateFile } from "@prisma/client";

type PlaygroundData = {
	title: string;
	sourceType: string;
	githubOwner: string | null;
	githubRepo: string | null;
	githubBranch: string | null;
	githubCommitSha: string | null;
	githubRepoUrl: string | null;
	templateFiles: { content: unknown }[];
};

export const getPlaygroundById = async (
	id: string,
): Promise<ActionResult<PlaygroundData>> => {
	const user = await currentUser();
	if (!user?.id) return fail("Unauthorized");

	try {
		await assertPlaygroundOwner(id, user.id);

		const playground = await db.playground.findUnique({
			where: { id },
			select: {
				title: true,
				sourceType: true,
				githubOwner: true,
				githubRepo: true,
				githubBranch: true,
				githubCommitSha: true,
				githubRepoUrl: true,
				templateFiles: {
					select: { content: true },
				},
			},
		});

		if (!playground) return fail("Playground not found");
		return ok(playground);
	} catch (error) {
		console.error("Error fetching playground by id:", error);
		return fail("Failed to fetch playground");
	}
};

export const SaveUpdatedCode = async (
	playgroundId: string,
	data: TemplateFolder,
): Promise<ActionResult<TemplateFile>> => {
	const user = await currentUser();
	if (!user?.id) return fail("Unauthorized");

	try {
		await assertPlaygroundOwner(playgroundId, user.id);

		const updatedPlayground = await db.templateFile.upsert({
			where: { playgroundId },
			update: { content: JSON.stringify(data) },
			create: {
				playgroundId,
				content: JSON.stringify(data),
			},
		});
		return ok(updatedPlayground);
	} catch (error) {
		console.error("SaveUpdatedCode error: ", error);
		return fail("Failed to save code");
	}
};
