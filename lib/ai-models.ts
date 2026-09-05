export const DEFAULT_CHAT_MODEL = "qwen3.5:397b-cloud";
export const DEFAULT_SUGGESTION_MODEL = "qwen3-coder-next:cloud";

export const CHAT_MODELS = [
	{ id: DEFAULT_CHAT_MODEL, label: "Qwen 3.5" },
	{ id: DEFAULT_SUGGESTION_MODEL, label: "Qwen Coder" },
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
	return process.env.OLLAMA_SUGGESTION_MODEL?.trim() || DEFAULT_SUGGESTION_MODEL;
}
