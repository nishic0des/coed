import { db } from "@/lib/db";

/**
 * Returns the playground only if it belongs to the given user.
 * Returns null for missing playgrounds and unauthorized access (same response to avoid ID enumeration).
 */
export async function getPlaygroundForUser(
	playgroundId: string,
	userId: string,
) {
	return db.playground.findFirst({
		where: { id: playgroundId, userId },
	});
}

/**
 * Throws if the playground does not exist or does not belong to the user.
 */
export async function assertPlaygroundOwner(
	playgroundId: string,
	userId: string,
) {
	const playground = await getPlaygroundForUser(playgroundId, userId);
	if (!playground) {
		throw new Error("Playground not found");
	}
	return playground;
}
