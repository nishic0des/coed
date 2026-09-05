import { db } from "@/lib/db";

interface RateLimitEntry {
	count: number;
	resetAt: number;
}

export type RateLimitResult = {
	success: boolean;
	remaining: number;
	resetAt: number;
};

const memoryStore = new Map<string, RateLimitEntry>();

function consumeMemory(
	store: Map<string, RateLimitEntry>,
	key: string,
	{ limit, windowMs }: { limit: number; windowMs: number },
): RateLimitResult {
	const now = Date.now();
	const entry = store.get(key);

	if (!entry || now > entry.resetAt) {
		const resetAt = now + windowMs;
		store.set(key, { count: 1, resetAt });
		return { success: true, remaining: limit - 1, resetAt };
	}

	if (entry.count >= limit) {
		return { success: false, remaining: 0, resetAt: entry.resetAt };
	}

	entry.count++;
	return {
		success: true,
		remaining: limit - entry.count,
		resetAt: entry.resetAt,
	};
}

function useMemoryStore(): boolean {
	return (
		process.env.VITEST === "true" || process.env.RATE_LIMIT_DRIVER === "memory"
	);
}

/**
 * In-process limiter. Used in tests and as a fallback if Mongo is unavailable.
 */
export function rateLimitMemory(
	key: string,
	opts: { limit: number; windowMs: number },
): RateLimitResult {
	return consumeMemory(memoryStore, key, opts);
}

async function rateLimitDb(
	key: string,
	{ limit, windowMs }: { limit: number; windowMs: number },
): Promise<RateLimitResult> {
	const now = Date.now();
	const existing = await db.rateLimitBucket.findUnique({ where: { key } });

	if (!existing || now > existing.resetAt.getTime()) {
		const resetAt = new Date(now + windowMs);
		await db.rateLimitBucket.upsert({
			where: { key },
			create: { key, count: 1, resetAt },
			update: { count: 1, resetAt },
		});
		return { success: true, remaining: limit - 1, resetAt: resetAt.getTime() };
	}

	if (existing.count >= limit) {
		return {
			success: false,
			remaining: 0,
			resetAt: existing.resetAt.getTime(),
		};
	}

	const updated = await db.rateLimitBucket.update({
		where: { key },
		data: { count: { increment: 1 } },
	});

	return {
		success: true,
		remaining: Math.max(0, limit - updated.count),
		resetAt: existing.resetAt.getTime(),
	};
}

/**
 * Shared rate limiter. Uses Mongo so limits hold across instances.
 * Falls back to memory if the database write fails.
 */
export async function rateLimit(
	key: string,
	opts: { limit: number; windowMs: number },
): Promise<RateLimitResult> {
	if (useMemoryStore()) {
		return rateLimitMemory(key, opts);
	}

	try {
		return await rateLimitDb(key, opts);
	} catch (error) {
		console.error("Rate limit store unavailable, using memory:", error);
		return rateLimitMemory(key, opts);
	}
}
