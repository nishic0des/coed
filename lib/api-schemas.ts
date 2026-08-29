import { z } from "zod";

export const ChatMessageSchema = z.object({
	role: z.enum(["user", "assistant"]),
	content: z.string().max(10_000),
});

export const ChatRequestSchema = z.object({
	message: z.string().min(1).max(10_000),
	history: z.array(ChatMessageSchema).max(20).optional().default([]),
	stream: z.boolean().optional(),
	mode: z.string().optional(),
	model: z.string().optional(),
});

export const CodeSuggestionRequestSchema = z.object({
	fileContent: z.string().min(1).max(500_000),
	cursorLine: z.number().int().min(0),
	cursorColumn: z.number().int().min(0),
	suggestionType: z.string().min(1).max(100),
	fileName: z.string().max(500).optional(),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export type CodeSuggestionRequest = z.infer<typeof CodeSuggestionRequestSchema>;
