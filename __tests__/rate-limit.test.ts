import { describe, it, expect, beforeEach, vi } from "vitest";

describe("rateLimit", () => {
	beforeEach(() => {
		vi.resetModules();
	});

	it("allows requests within limit", async () => {
		const { rateLimit } = await import("@/lib/rate-limit");

		const r1 = rateLimit("test-user", { limit: 3, windowMs: 60_000 });
		const r2 = rateLimit("test-user", { limit: 3, windowMs: 60_000 });
		const r3 = rateLimit("test-user", { limit: 3, windowMs: 60_000 });

		expect(r1.success).toBe(true);
		expect(r2.success).toBe(true);
		expect(r3.success).toBe(true);
		expect(r3.remaining).toBe(0);
	});

	it("blocks requests over limit", async () => {
		const { rateLimit } = await import("@/lib/rate-limit");

		for (let i = 0; i < 2; i++) {
			rateLimit("blocked-user", { limit: 2, windowMs: 60_000 });
		}
		const result = rateLimit("blocked-user", { limit: 2, windowMs: 60_000 });

		expect(result.success).toBe(false);
		expect(result.remaining).toBe(0);
	});

	it("tracks different keys independently", async () => {
		const { rateLimit } = await import("@/lib/rate-limit");

		rateLimit("user-a", { limit: 1, windowMs: 60_000 });
		const blockedA = rateLimit("user-a", { limit: 1, windowMs: 60_000 });
		const allowedB = rateLimit("user-b", { limit: 1, windowMs: 60_000 });

		expect(blockedA.success).toBe(false);
		expect(allowedB.success).toBe(true);
	});
});
