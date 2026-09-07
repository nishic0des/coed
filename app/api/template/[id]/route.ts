import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
	loadTemplateStructure,
	templatePaths,
	type TemplateKey,
} from "@/lib/template";
import { parseTemplateContent } from "@/modules/playground/lib/template-content";
import type { Prisma } from "@prisma/client";
import { type NextRequest } from "next/server";

function validateJsonStructure(data: unknown): boolean {
	try {
		JSON.parse(JSON.stringify(data));
		return true;
	} catch (error) {
		console.error("Invalid JSON structure: ", error);
		return false;
	}
}

export async function GET(
	_request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const session = await auth();
		if (!session?.user?.id) {
			return Response.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { id } = await params;

		const playground = await db.playground.findFirst({
			where: { id, userId: session.user.id },
			include: { templateFiles: { take: 1 } },
		});

		if (!playground) {
			return Response.json({ error: "Playground not found" }, { status: 404 });
		}

		// Prefer saved template content from DB over filesystem scan
		const savedFile = playground.templateFiles[0];
		const parsed = parseTemplateContent(savedFile?.content);
		if (parsed) {
			return Response.json(
				{ success: true, templateJson: parsed },
				{ status: 200 },
			);
		}

		const templateKey = playground.template as TemplateKey;
		if (!(templateKey in templatePaths)) {
			return Response.json({ error: "Invalid template" }, { status: 404 });
		}

		const result = await loadTemplateStructure(templateKey);

		if (!validateJsonStructure(result.items)) {
			return Response.json(
				{ error: "Invalid JSON structure" },
				{ status: 500 },
			);
		}

		// Persist so later loads (and hosts without template files) work from DB
		await db.templateFile.upsert({
			where: { playgroundId: playground.id },
			update: { content: result as unknown as Prisma.InputJsonValue },
			create: {
				playgroundId: playground.id,
				content: result as unknown as Prisma.InputJsonValue,
			},
		});

		return Response.json(
			{ success: true, templateJson: result },
			{ status: 200 },
		);
	} catch (error) {
		console.error("Error in template API:", error);
		const message =
			error instanceof Error ? error.message : "Failed to generate template";
		return Response.json({ error: message }, { status: 500 });
	}
}
