import { auth } from "@/auth";
import { resolveChatModel } from "@/lib/ai-models";
import { ChatRequestSchema } from "@/lib/api-schemas";
import { rateLimit } from "@/lib/rate-limit";
import { type NextRequest, NextResponse } from "next/server";
import { ollama } from "@/lib/ollama";

const SYSTEM_PROMPT = `You are a helpful AI coding assistant. You help developers with:
- Code explanations and debugging
- Best practices and architecture advice
- Writing clean, efficient code
- Troubleshooting errors
- Code reviews and optimizations

Always provide clear, practical answers. Use proper code formatting when showing examples.`;

interface ChatMessage {
	role: "user" | "assistant";
	content: string;
}

async function generateAIResponse(
	messages: ChatMessage[],
	model: string,
	files: { path: string; content: string }[],
	activeFilePath?: string,
): Promise<string> {
	const system = [SYSTEM_PROMPT, buildFileContextPrompt(files, activeFilePath)]
		.filter(Boolean)
		.join("\n\n");
	const res = await ollama.chat({
		model,
		messages: [{ role: "system", content: system }, ...messages],
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
	files: { path: string; content: string }[],
	activeFilePath?: string,
): Promise<ReadableStream<Uint8Array>> {
	const encoder = new TextEncoder();
	const system = [SYSTEM_PROMPT, buildFileContextPrompt(files, activeFilePath)]
		.filter(Boolean)
		.join("\n\n");

	const ollamaStream = await ollama.chat({
		model,
		messages: [{ role: "system", content: system }, ...messages],
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

function buildFileContextPrompt(
	files: { path: string; content: string }[],
	activeFilePath?: string,
): string {
	if (files.length === 0) return "";

	const blocks = files.map((f) => {
		const marker = f.path === activeFilePath ? " (active)" : "";
		return `### ${f.path}${marker}\n\`\`\`\n${f.content}\n\`\`\``;
	});

	return [
		"The user is editing a playground. Use this file context when relevant.",
		"Prefer the active file. Quote paths when you refer to code.",
		"",
		...blocks,
	].join("\n");
}

export async function POST(req: NextRequest) {
	try {
		const session = await auth();
		if (!session?.user?.id) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const limitResult = await rateLimit(`chat:${session.user.id}`, {
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

		const { message, history, stream, files, activeFilePath } = parsed.data;
		const selectedModel = resolveChatModel(parsed.data.model);
		const recentHistory = history.slice(-10);

		const messages: ChatMessage[] = [
			...recentHistory,
			{ role: "user", content: message },
		];

		if (stream) {
			const body = await streamAIResponse(
				messages,
				selectedModel,
				files,
				activeFilePath,
			);
			return new Response(body, {
				headers: {
					"Content-Type": "text/plain; charset=utf-8",
					"Cache-Control": "no-cache",
				},
			});
		}

		const res = await generateAIResponse(
			messages,
			selectedModel,
			files,
			activeFilePath,
		);

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
