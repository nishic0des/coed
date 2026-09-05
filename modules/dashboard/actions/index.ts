"use server";

import { db } from "@/lib/db";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { currentUser } from "@/modules/auth/actions";
import { assertPlaygroundOwner } from "@/modules/playground/lib/playground-auth";
import { revalidatePath } from "next/cache";
import type { Playground, Prisma, StarMark, User } from "@prisma/client";

type PlaygroundWithRelations = Playground & {
	user: User;
	Starmark: Pick<StarMark, "isMarked">[];
};

export const toggleStarMarked = async (
	playgroundId: string,
	isChecked: boolean,
): Promise<ActionResult<{ isMarked: boolean }>> => {
	const user = await currentUser();
	const userId = user?.id;
	if (!userId) {
		return fail("Unauthorized");
	}
	try {
		await assertPlaygroundOwner(playgroundId, userId);
		if (isChecked) {
			const existing = await db.starMark.findFirst({
				where: { userId, playgroundId },
			});
			if (existing) {
				await db.starMark.update({
					where: { id: existing.id },
					data: { isMarked: true },
				});
			} else {
				await db.starMark.create({
					data: { userId, playgroundId, isMarked: true },
				});
			}
		} else {
			await db.starMark.delete({
				where: {
					userId_playgroundId: { userId, playgroundId },
				},
			});
		}
		return ok({ isMarked: isChecked });
	} catch (error) {
		console.error("Error toggling starmark: ", error);
		return fail("Failed to update");
	}
};

export const getAllPlaygroundForUser = async (): Promise<
	ActionResult<PlaygroundWithRelations[]>
> => {
	const user = await currentUser();
	if (!user?.id) {
		return fail("Unauthorized");
	}
	try {
		const playgrounds = await db.playground.findMany({
			where: { userId: user.id },
			include: {
				user: true,
				Starmark: {
					where: { userId: user.id },
					select: { isMarked: true },
				},
			},
		});
		return ok(playgrounds);
	} catch (error) {
		console.error("Error fetching playgrounds:", error);
		return fail("Failed to fetch playgrounds");
	}
};

export const createPlayground = async (data: {
	title: string;
	template: "REACT" | "NEXTJS" | "EXPRESS" | "VUE" | "HONO" | "ANGULAR";
	description?: string;
}): Promise<ActionResult<Playground>> => {
	const user = await currentUser();
	if (!user?.id) {
		return fail("Unauthorized");
	}
	const { template, title, description } = data;
	try {
		const playground = await db.playground.create({
			data: {
				title,
				description,
				template,
				userId: user.id,
			},
		});
		return ok(playground);
	} catch (error) {
		console.error("Error creating playground: ", error);
		return fail("Failed to create playground");
	}
};

export const deleteProjectById = async (
	id: string,
): Promise<ActionResult<void>> => {
	const user = await currentUser();
	if (!user?.id) return fail("Unauthorized");

	try {
		await assertPlaygroundOwner(id, user.id);
		await db.playground.delete({ where: { id } });
		revalidatePath("/dashboard");
		return ok(undefined);
	} catch (error) {
		console.error("Error deleting project: ", error);
		return fail("Failed to delete project");
	}
};

export const editProjectById = async (
	id: string,
	data: { title: string; description: string },
): Promise<ActionResult<void>> => {
	const user = await currentUser();
	if (!user?.id) return fail("Unauthorized");

	try {
		await assertPlaygroundOwner(id, user.id);
		await db.playground.update({ where: { id }, data });
		revalidatePath("/dashboard");
		return ok(undefined);
	} catch (error) {
		console.error("Error updating project: ", error);
		return fail("Failed to update project");
	}
};

export const duplicateProjectById = async (
	id: string,
): Promise<ActionResult<void>> => {
	const user = await currentUser();
	if (!user?.id) return fail("Unauthorized");

	try {
		const originalPlayground = await db.playground.findUnique({
			where: { id },
			include: { templateFiles: true },
		});
		if (!originalPlayground) {
			return fail("Playground not found");
		}

		await assertPlaygroundOwner(id, user.id);

		const newPlayground = await db.playground.create({
			data: {
				title: `${originalPlayground.title} (Copy)`,
				description: originalPlayground.description,
				template: originalPlayground.template,
				sourceType: originalPlayground.sourceType,
				githubOwner: originalPlayground.githubOwner,
				githubRepo: originalPlayground.githubRepo,
				githubBranch: originalPlayground.githubBranch,
				githubCommitSha: originalPlayground.githubCommitSha,
				githubRepoUrl: originalPlayground.githubRepoUrl,
				userId: user.id,
			},
		});

		if (originalPlayground.templateFiles.length > 0) {
			await db.templateFile.create({
				data: {
					playgroundId: newPlayground.id,
					content: originalPlayground.templateFiles[0]
						.content as Prisma.InputJsonValue,
				},
			});
		}

		revalidatePath("/dashboard");
		return ok(undefined);
	} catch (error) {
		console.error("Error duplicating playground: ", error);
		return fail("Failed to duplicate playground");
	}
};
