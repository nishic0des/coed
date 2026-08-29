"use server";

import { db } from "@/lib/db";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { currentUser } from "@/modules/auth/actions";

export async function saveChatMessage(
	role: string,
	content: string,
): Promise<ActionResult<void>> {
	const user = await currentUser();
	if (!user?.id) return fail("Unauthorized");

	try {
		await db.chatMessage.create({
			data: { userId: user.id, role, content },
		});
		return ok(undefined);
	} catch (error) {
		console.error("Error saving chat message:", error);
		return fail("Failed to save message");
	}
}

export async function loadChatMessages(): Promise<
	ActionResult<{ role: string; content: string; createdAt: Date }[]>
> {
	const user = await currentUser();
	if (!user?.id) return fail("Unauthorized");

	try {
		const messages = await db.chatMessage.findMany({
			where: { userId: user.id },
			orderBy: { createdAt: "asc" },
			take: 50,
			select: { role: true, content: true, createdAt: true },
		});
		return ok(messages);
	} catch (error) {
		console.error("Error loading chat messages:", error);
		return fail("Failed to load messages");
	}
}

export async function clearChatMessages(): Promise<ActionResult<void>> {
	const user = await currentUser();
	if (!user?.id) return fail("Unauthorized");

	try {
		await db.chatMessage.deleteMany({ where: { userId: user.id } });
		return ok(undefined);
	} catch (error) {
		console.error("Error clearing chat messages:", error);
		return fail("Failed to clear messages");
	}
}
