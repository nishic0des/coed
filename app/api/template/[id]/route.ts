import { auth } from "@/auth";
import { db } from "@/lib/db";
import { templatePaths } from "@/lib/template";
import { getCachedTemplateStructure } from "@/lib/template-cache";
import { NextRequest } from "next/server";
import path from "path";
import fs from "fs";

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
	request: NextRequest,
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
		if (savedFile?.content) {
			const parsed =
				typeof savedFile.content === "string"
					? JSON.parse(savedFile.content)
					: savedFile.content;
			return Response.json(
				{ success: true, templateJson: parsed },
				{ status: 200 },
			);
		}

		const templateKey = playground.template as keyof typeof templatePaths;
		const templatePath = templatePaths[templateKey];

		if (!templatePath) {
			return Response.json({ error: "Invalid template" }, { status: 404 });
		}

		const inputPath = path.join(process.cwd(), templatePath);

		try {
			await fs.promises.access(inputPath);
		} catch {
			throw new Error(`Template directory ${inputPath} does not exist`);
		}

		const result = await getCachedTemplateStructure(templateKey, inputPath);

		if (!validateJsonStructure(result.items)) {
			return Response.json(
				{ error: "Invalid JSON structure" },
				{ status: 500 },
			);
		}

		return Response.json(
			{ success: true, templateJson: result },
			{ status: 200 },
		);
	} catch (error) {
		console.error("Error in template API:", error);
		return Response.json(
			{ error: "Failed to generate template" },
			{ status: 500 },
		);
	}
}
