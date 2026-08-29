interface RateLimitEntry {
	count: number;
	resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up stale entries periodically
setInterval(() => {
	const now = Date.now();
	for (const [key, entry] of store) {
		if (now > entry.resetAt) store.delete(key);
	}
}, 60_000);

export function rateLimit(
	key: string,
	{ limit, windowMs }: { limit: number; windowMs: number },
): { success: boolean; remaining: number; resetAt: number } {
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
	return { success: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}
