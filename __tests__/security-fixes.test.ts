import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isOAuthEmailVerified } from "@/lib/oauth-email";
import {
	DEFAULT_CHAT_MODEL,
	resolveChatModel,
	resolveSuggestionModel,
} from "@/lib/ai-models";
import { parseTemplateContent } from "@/modules/playground/lib/template-content";

describe("isOAuthEmailVerified", () => {
	it("accepts Google profiles with email_verified", () => {
		expect(
			isOAuthEmailVerified("google", { email_verified: true, email: "a@b.c" }),
		).toBe(true);
	});

	it("rejects Google profiles without verification", () => {
		expect(isOAuthEmailVerified("google", { email: "a@b.c" })).toBe(false);
		expect(
			isOAuthEmailVerified("google", { email_verified: false, email: "a@b.c" }),
		).toBe(false);
	});

	it("accepts GitHub profiles with an email", () => {
		expect(isOAuthEmailVerified("github", { email: "a@b.c" })).toBe(true);
	});

	it("rejects unknown providers and empty profiles", () => {
		expect(isOAuthEmailVerified("discord", { email: "a@b.c" })).toBe(false);
		expect(isOAuthEmailVerified("github", null)).toBe(false);
	});
});

describe("resolveChatModel", () => {
	const originalModels = process.env.OLLAMA_CHAT_MODELS;
	const originalChat = process.env.OLLAMA_CHAT_MODEL;
	const originalSuggestion = process.env.OLLAMA_SUGGESTION_MODEL;

	beforeEach(() => {
		delete process.env.OLLAMA_CHAT_MODELS;
		delete process.env.OLLAMA_CHAT_MODEL;
		delete process.env.OLLAMA_SUGGESTION_MODEL;
	});

	afterEach(() => {
		process.env.OLLAMA_CHAT_MODELS = originalModels;
		process.env.OLLAMA_CHAT_MODEL = originalChat;
		process.env.OLLAMA_SUGGESTION_MODEL = originalSuggestion;
	});

	it("ignores models that are not allowlisted", () => {
		expect(resolveChatModel("llama2")).toBe(DEFAULT_CHAT_MODEL);
	});

	it("accepts an allowlisted model", () => {
		expect(resolveChatModel("qwen3-coder-next:cloud")).toBe(
			"qwen3-coder-next:cloud",
		);
	});

	it("uses env allowlist when set", () => {
		process.env.OLLAMA_CHAT_MODELS = "safe-model,other-model";
		expect(resolveChatModel("safe-model")).toBe("safe-model");
		expect(resolveChatModel("llama2")).toBe("safe-model");
	});

	it("resolves suggestion model from env or default", () => {
		expect(resolveSuggestionModel()).toBe("qwen3-coder-next:cloud");
		process.env.OLLAMA_SUGGESTION_MODEL = "custom-coder";
		expect(resolveSuggestionModel()).toBe("custom-coder");
	});
});

describe("parseTemplateContent", () => {
	const folder = { folderName: "root", items: [] };

	it("parses object trees", () => {
		expect(parseTemplateContent(folder)).toEqual(folder);
	});

	it("parses stringified trees", () => {
		expect(parseTemplateContent(JSON.stringify(folder))).toEqual(folder);
	});

	it("returns null for invalid payloads", () => {
		expect(parseTemplateContent(null)).toBeNull();
		expect(parseTemplateContent("{not-json")).toBeNull();
		expect(parseTemplateContent({ items: [] })).toBeNull();
	});
});
