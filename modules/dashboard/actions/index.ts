"use server";

import { db } from "@/lib/db";
import { currentUser } from "@/modules/auth/actions";
import { revalidatePath } from "next/cache";

export const toggleStarMarked = async (
	playgroundId: string,
	isChecked: boolean,
) => {
	const user = await currentUser();
	const userId = user?.id;
	if (!userId) {
		throw new Error("User Id is required");
	}
	try {
		if (isChecked) {
			// Try to update first, if it doesn't exist, create a new one
			const existing = await db.starMark.findFirst({
				where: {
					userId,
					playgroundId,
				},
			});
			if (existing) {
				// If it exists, update it
				await db.starMark.update({
					where: {
						id: existing.id,
					},
					data: {
						isMarked: true,
					},
				});
			}
		} else {
			await db.starMark.delete({
				where: {
					userId_playgroundId: {
						userId,
						playgroundId,
					},
				},
			});
		}
		return { success: true, isMarked: isChecked };
	} catch (error) {
		console.error("Error toggling starmark: ", error);
		return { success: false, error: "Failed to update" };
	}
};

export const getAllPlaygroundForUser = async () => {
	const user = await currentUser();
	try {
		const playground = await db.playground.findMany({
			where: {
				userId: user?.id,
			},
			include: {
				user: true,
				Starmark: {
					where: {
						userId: user?.id,
					},
					select: {
						isMarked: true,
					},
				},
			},
		});
		return playground;
	} catch (error) {
		console.error("Error fetching playgrounds:", error);
	}
};

export const createPlayground = async (data: {
	title: string;
	template: "REACT" | "NEXTJS" | "EXPRESS" | "VUE" | "HONO" | "ANGULAR";
	description?: string;
}) => {
	const user = await currentUser();
	const { template, title, description } = data;
	try {
		const playground = await db.playground.create({
			data: {
				title: title,
				description: description,
				template: template,
				// eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
				userId: user?.id!,
			},
		});
		return playground;
	} catch (error) {
		console.error("Error creating playground: ", error);
	}
};

export const deleteProjectById = async (id: string) => {
	try {
		await db.playground.delete({
			where: {
				id,
			},
		});
		revalidatePath("/dashboard");
	} catch (error) {
		console.error("Error deleting project: ", error);
	}
};

export const editProjectById = async (
	id: string,
	data: { title: string; description: string },
) => {
	try {
		await db.playground.update({
			where: {
				id,
			},
			data: data,
		});
		revalidatePath("/dashboard");
	} catch (error) {
		console.error("Error updating project: ", error);
	}
};

export const duplicateProjectById = async (id: string): Promise<void> => {
	try {
		const originalPlayground = await db.playground.findUnique({
			where: { id },
		});
		if (!originalPlayground) {
			throw new Error("Original playground not found");
		}

		await db.playground.create({
			data: {
				title: `${originalPlayground.title} (Copy)`,
				description: originalPlayground.description,
				template: originalPlayground.template,
				userId: originalPlayground.userId,
			},
		});
		revalidatePath("/dashboard");
	} catch (error) {
		console.error("Error duplicating playground: ", error);
		throw error;
	}
};
