import { auth } from "@/auth";
import { ChatRequestSchema } from "@/lib/api-schemas";
import { rateLimit } from "@/lib/rate-limit";
import { type NextRequest, NextResponse } from "next/server";
import ollama from "ollama";

const DEFAULT_MODEL = "qwen3.5:397b-cloud";

interface ChatMessage {
	role: "user" | "assistant";
	content: string;
}

function buildPrompt(messages: ChatMessage[]): string {
	const systemPrompt = `You are a helpful AI coding assistant. You help developers with:
- Code explanations and debugging
- Best practices and architecture advice  
- Writing clean, efficient code
- Troubleshooting errors
- Code reviews and optimizations

Always provide clear, practical answers. Use proper code formatting when showing examples.`;

	const fullMessages = [{ role: "user", content: systemPrompt }, ...messages];

	return fullMessages
		.map((msg) => `${msg.role}:${msg.content}`)
		.join("\n\n");
}

async function generateAIResponse(
	messages: ChatMessage[],
	model: string,
): Promise<string> {
	const prompt = buildPrompt(messages);

	const res = await ollama.chat({
		model,
		messages: [{ role: "user", content: prompt }],
	});

	const data = res.message.content;
	if (!data) {
		throw new Error("Failed to generate response");
	}
	return data.trim();
}

async function streamAIResponse(
	messages: ChatMessage[],
	model: string,
): Promise<ReadableStream<Uint8Array>> {
	const prompt = buildPrompt(messages);
	const encoder = new TextEncoder();

	const ollamaStream = await ollama.chat({
		model,
		messages: [{ role: "user", content: prompt }],
		stream: true,
	});

	return new ReadableStream({
		async start(controller) {
			try {
				for await (const chunk of ollamaStream) {
					const content = chunk.message?.content;
					if (content) {
						controller.enqueue(encoder.encode(content));
					}
				}
				controller.close();
			} catch (error) {
				controller.error(error);
			}
		},
	});
}

export async function POST(req: NextRequest) {
	try {
		const session = await auth();
		if (!session?.user?.id) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const limitResult = rateLimit(`chat:${session.user.id}`, {
			limit: 20,
			windowMs: 60_000,
		});
		if (!limitResult.success) {
			return NextResponse.json(
				{ error: "Rate limit exceeded. Please try again later." },
				{
					status: 429,
					headers: {
						"Retry-After": String(
							Math.ceil((limitResult.resetAt - Date.now()) / 1000),
						),
					},
				},
			);
		}

		const rawBody = await req.json();
		const parsed = ChatRequestSchema.safeParse(rawBody);
		if (!parsed.success) {
			return NextResponse.json(
				{ error: "Invalid request", issues: parsed.error.issues },
				{ status: 400 },
			);
		}

		const { message, history, model, stream } = parsed.data;
		const recentHistory = history.slice(-10);
		const selectedModel = model ?? DEFAULT_MODEL;

		const messages: ChatMessage[] = [
			...recentHistory,
			{ role: "user", content: message },
		];

		if (stream) {
			const body = await streamAIResponse(messages, selectedModel);
			return new Response(body, {
				headers: {
					"Content-Type": "text/plain; charset=utf-8",
					"Cache-Control": "no-cache",
				},
			});
		}

		const res = await generateAIResponse(messages, selectedModel);

		return NextResponse.json({
			response: res,
			model: selectedModel,
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		console.error("Chat API Error: ", error);

		return NextResponse.json(
			{
				error: "Failed to generate AI response",
				timestamp: new Date().toISOString(),
			},
			{ status: 500 },
		);
	}
}
