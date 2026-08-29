import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
	db: {
		playground: {
			findFirst: vi.fn(),
		},
	},
}));

import { db } from "@/lib/db";
import {
	assertPlaygroundOwner,
	getPlaygroundForUser,
} from "@/modules/playground/lib/playground-auth";

const mockFindFirst = vi.mocked(db.playground.findFirst);

describe("playground-auth", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("getPlaygroundForUser", () => {
		it("returns playground when user owns it", async () => {
			const playground = { id: "pg-1", userId: "user-1", title: "Test" };
			mockFindFirst.mockResolvedValue(playground as never);

			const result = await getPlaygroundForUser("pg-1", "user-1");

			expect(result).toEqual(playground);
			expect(mockFindFirst).toHaveBeenCalledWith({
				where: { id: "pg-1", userId: "user-1" },
			});
		});

		it("returns null when user does not own playground", async () => {
			mockFindFirst.mockResolvedValue(null);

			const result = await getPlaygroundForUser("pg-1", "user-2");

			expect(result).toBeNull();
		});
	});

	describe("assertPlaygroundOwner", () => {
		it("returns playground when authorized", async () => {
			const playground = { id: "pg-1", userId: "user-1", title: "Test" };
			mockFindFirst.mockResolvedValue(playground as never);

			const result = await assertPlaygroundOwner("pg-1", "user-1");

			expect(result).toEqual(playground);
		});

		it("throws when playground not found or unauthorized", async () => {
			mockFindFirst.mockResolvedValue(null);

			await expect(assertPlaygroundOwner("pg-1", "user-2")).rejects.toThrow(
				"Playground not found",
			);
		});
	});
});
