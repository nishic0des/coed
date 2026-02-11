import { type NextRequest, NextResponse } from "next/server";
import { unknown } from "zod";

interface ChatMessage {
	role: "user" | "assistant";
	content: string;
}

interface ChatRequest {
	message: string;
	history: ChatMessage[];
}

async function generateAIResponse(messages: ChatMessage[]): Promise<string> {
	const systemPrompt = `You are a helpful AI coding assistant. You help developers with:
- Code explanations and debugging
- Best practices and architecture advice  
- Writing clean, efficient code
- Troubleshooting errors
- Code reviews and optimizations

Always provide clear, practical answers. Use proper code formatting when showing examples.`;

	const fullMessages = [{ role: "user", content: systemPrompt }, ...messages];

	const prompt = fullMessages
		.map((msg) => `${msg.role}:${msg.content}`)
		.join("\n\n");

	try {
		const res = await fetch(
			"https://sinless-unglamourously-lavone.ngrok-free.dev/api/generate",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					model: "qwen3-coder-next:cloud",
					stream: false,
					options: {
						temperature: 0.7,
						max_tokes: 1000,
						top_p: 0.9,
					},
					prompt: prompt,
				}),
			},
		);
		const data = await res.json();
		if (!data.response) {
			throw new Error("Failed to generate response");
		}
		return data.response.trim();
	} catch (error) {
		console.error("Error generating response: ", error);
		throw new Error("Failed to generate response");
	}
}

export async function POST(req: NextRequest) {
	try {
		const body: ChatRequest = await req.json();
		const { message, history = [] } = body;

		if (!message || typeof message !== "string") {
			return NextResponse.json(
				{ error: "Message is required and must be a string" },
				{ status: 400 },
			);
		}

		const validHistory = Array.isArray(history)
			? history.filter(
					(msg) =>
						msg &&
						typeof msg === "object" &&
						typeof msg.role === "string" &&
						typeof msg.content === "string" &&
						["user", "assistant"].includes(msg.role),
				)
			: [];

		const recentHistory = validHistory.slice(-10);

		const messages: ChatMessage[] = [
			...recentHistory,
			{ role: "user", content: message },
		];

		const res = await generateAIResponse(messages);

		return NextResponse.json({
			response: res,
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		console.error("Chat API Error: ", error);
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error";

		return NextResponse.json(
			{
				error: "Failed to generate AI response",
				details: errorMessage,
				timestamp: new Date().toISOString(),
			},
			{
				status: 500,
			},
		);
	}
}
