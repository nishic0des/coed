import { Ollama } from "ollama";

const apiKey = process.env.OLLAMA_API_KEY;
if (!apiKey) {
	console.warn("OLLAMA_API_KEY is not set");
}

export const ollama = new Ollama({
	host: process.env.OLLAMA_HOST ?? "https://ollama.com",
	headers: apiKey
		? {
				Authorization: `Bearer ${process.env.OLLAMA_API_KEY}`,
			}
		: undefined,
});
