"use server";

import { db } from "@/lib/db";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { currentUser } from "@/modules/auth/actions";
import { assertPlaygroundOwner } from "@/modules/playground/lib/playground-auth";

export async function saveChatMessage(
	role: string,
	content: string,
	playgroundId: string,
): Promise<ActionResult<void>> {
	const user = await currentUser();
	if (!user?.id) return fail("Unauthorized");
	if (!playgroundId) return fail("Playground is required");

	try {
		await assertPlaygroundOwner(playgroundId, user.id);
		await db.chatMessage.create({
			data: { userId: user.id, playgroundId, role, content },
		});
		return ok(undefined);
	} catch (error) {
		console.error("Error saving chat message:", error);
		return fail("Failed to save message");
	}
}

export async function loadChatMessages(
	playgroundId: string,
): Promise<
	ActionResult<{ role: string; content: string; createdAt: Date }[]>
> {
	const user = await currentUser();
	if (!user?.id) return fail("Unauthorized");
	if (!playgroundId) return fail("Playground is required");

	try {
		await assertPlaygroundOwner(playgroundId, user.id);
		const messages = await db.chatMessage.findMany({
			where: { userId: user.id, playgroundId },
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

export async function clearChatMessages(
	playgroundId: string,
): Promise<ActionResult<void>> {
	const user = await currentUser();
	if (!user?.id) return fail("Unauthorized");
	if (!playgroundId) return fail("Playground is required");

	try {
		await assertPlaygroundOwner(playgroundId, user.id);
		await db.chatMessage.deleteMany({
			where: { userId: user.id, playgroundId },
		});
		return ok(undefined);
	} catch (error) {
		console.error("Error clearing chat messages:", error);
		return fail("Failed to clear messages");
	}
}
