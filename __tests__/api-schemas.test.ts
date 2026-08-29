import { describe, it, expect } from "vitest";
import {
	ChatRequestSchema,
	CodeSuggestionRequestSchema,
} from "@/lib/api-schemas";

describe("ChatRequestSchema", () => {
	it("accepts valid request", () => {
		const result = ChatRequestSchema.safeParse({
			message: "Hello",
			history: [{ role: "user", content: "Hi" }],
		});
		expect(result.success).toBe(true);
	});

	it("rejects empty message", () => {
		const result = ChatRequestSchema.safeParse({ message: "" });
		expect(result.success).toBe(false);
	});

	it("rejects oversized message", () => {
		const result = ChatRequestSchema.safeParse({
			message: "x".repeat(10_001),
		});
		expect(result.success).toBe(false);
	});

	it("rejects too many history messages", () => {
		const history = Array.from({ length: 21 }, (_, i) => ({
			role: "user" as const,
			content: `msg ${i}`,
		}));
		const result = ChatRequestSchema.safeParse({ message: "Hi", history });
		expect(result.success).toBe(false);
	});
});

describe("CodeSuggestionRequestSchema", () => {
	it("accepts valid request", () => {
		const result = CodeSuggestionRequestSchema.safeParse({
			fileContent: "const x = 1;",
			cursorLine: 0,
			cursorColumn: 10,
			suggestionType: "inline",
		});
		expect(result.success).toBe(true);
	});

	it("rejects oversized file content", () => {
		const result = CodeSuggestionRequestSchema.safeParse({
			fileContent: "x".repeat(500_001),
			cursorLine: 0,
			cursorColumn: 0,
			suggestionType: "inline",
		});
		expect(result.success).toBe(false);
	});

	it("rejects negative cursor line", () => {
		const result = CodeSuggestionRequestSchema.safeParse({
			fileContent: "code",
			cursorLine: -1,
			cursorColumn: 0,
			suggestionType: "inline",
		});
		expect(result.success).toBe(false);
	});
});
