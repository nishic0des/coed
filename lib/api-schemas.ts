import { z } from "zod";

export const ChatMessageSchema = z.object({
	role: z.enum(["user", "assistant"]),
	content: z.string().max(10_000),
});

export const ChatFileContextSchema = z.object({
	path: z.string().min(1).max(500),
	content: z.string().max(50_000),
	language: z.string().max(50).optional(),
});

export const ChatRequestSchema = z.object({
	message: z.string().min(1).max(10_000),
	history: z.array(ChatMessageSchema).max(20).optional().default([]),
	stream: z.boolean().optional(),
	mode: z.string().optional(),
	// Client hint only; the API allowlists this against server config.
	model: z.string().max(100).optional(),
	activeFilePath: z.string().max(500).optional(),
	files: z.array(ChatFileContextSchema).max(8).optional().default([]),
});

export const CodeSuggestionRequestSchema = z.object({
	fileContent: z.string().max(500_000),
	cursorLine: z.number().int().min(0),
	cursorColumn: z.number().int().min(0),
	suggestionType: z.string().min(1).max(100),
	fileName: z.string().max(500).optional(),
});

export const ImportGithubRepoSchema = z.object({
	repoUrl: z.string().min(1).max(500),
	branch: z.string().max(255).optional(),
	title: z.string().min(1).max(200).optional(),
});

export const SyncGithubRepoSchema = z.object({
	playgroundId: z.string().min(1).max(100),
});

export const ListGithubReposSchema = z.object({
	search: z.string().max(200).optional(),
	page: z.number().int().min(1).max(100).optional().default(1),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export type CodeSuggestionRequest = z.infer<typeof CodeSuggestionRequestSchema>;
export type ImportGithubRepoRequest = z.infer<typeof ImportGithubRepoSchema>;
export type SyncGithubRepoRequest = z.infer<typeof SyncGithubRepoSchema>;
export type ListGithubReposRequest = z.infer<typeof ListGithubReposSchema>;
