export const DEFAULT_CHAT_MODEL = "gemma4:31b";
export const DEFAULT_SUGGESTION_MODEL = "gpt-oss:20b";

export const CHAT_MODELS = [
	{ id: DEFAULT_CHAT_MODEL, label: "Gemma 4 31B" },
	{ id: "gpt-oss:120b", label: "GPT-OSS 120B" },
	{ id: DEFAULT_SUGGESTION_MODEL, label: "GPT-OSS" },
] as const;

function parseModelList(value: string | undefined): string[] {
	if (!value) return [];
	return value
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean);
}

export function allowedChatModelIds(): string[] {
	const fromEnv = parseModelList(process.env.OLLAMA_CHAT_MODELS);
	if (fromEnv.length > 0) return fromEnv;
	return CHAT_MODELS.map((model) => model.id);
}

export function resolveChatModel(requested?: string | null): string {
	const allowed = allowedChatModelIds();
	if (requested && allowed.includes(requested)) return requested;
	const fallback = process.env.OLLAMA_CHAT_MODEL?.trim();
	if (fallback && allowed.includes(fallback)) return fallback;
	return allowed[0] ?? DEFAULT_CHAT_MODEL;
}

export function resolveSuggestionModel(): string {
	return (
		process.env.OLLAMA_SUGGESTION_MODEL?.trim() || DEFAULT_SUGGESTION_MODEL
	);
}
