import { db } from "@/lib/db";
import { templatePaths } from "@/lib/template";
import {
	readTemplateStructureFromJson,
	saveTemplateStructureToJson,
} from "@/modules/playground/lib/path-to-json";
import { NextRequest } from "next/server";
import path from "path";
import { unlink } from "fs/promises";
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

// In /api/template/[id]/route.ts
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const { id } = await params;
		console.log("🔍 Fetching template for ID:", id);

		const playground = await db.playground.findUnique({
			where: { id },
		});

		console.log("🎯 Playground found:", playground);

		if (!playground) {
			console.log("❌ Playground not found for ID:", id);
			return Response.json({ error: "Playground not found" }, { status: 404 });
		}

		const templateKey = playground.template as keyof typeof templatePaths;
		const templatePath = templatePaths[templateKey];

		console.log("📁 Template key:", templateKey);
		console.log("📂 Template path:", templatePath);

		if (!templatePath) {
			console.log("❌ Invalid template:", templateKey);
			return Response.json({ error: "Invalid template" }, { status: 404 });
		}

		const inputPath = path.join(process.cwd(), templatePath);
		const outputFile = path.join(process.cwd(), `output/${templateKey}.json`);

		console.log("📂 Full input path:", inputPath);
		console.log("📄 Output file:", outputFile);

		// Check if template directory exists
		try {
			await fs.promises.access(inputPath);
			console.log("✅ Template directory exists");
		} catch (error) {
			console.log("❌ Template directory does not exist:", inputPath);
			throw new Error(`Template directory ${inputPath} does not exist`);
		}

		await saveTemplateStructureToJson(inputPath, outputFile);
		console.log("✅ Template structure saved");

		const result = await readTemplateStructureFromJson(outputFile);
		console.log("✅ Template structure read");

		if (!validateJsonStructure(result.items)) {
			console.log("❌ Invalid JSON structure");
			return Response.json(
				{ error: "Invalid JSON structure" },
				{ status: 500 },
			);
		}

		await unlink(outputFile);
		console.log("🗑️ Output file cleaned up");

		return Response.json(
			{ success: true, templateJson: result },
			{ status: 200 },
		);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} catch (error: any) {
		console.error("💥 Error in template API:", error);
		return Response.json(
			{
				error: "Failed to generate template",
				details: error.message,
				stack: error.stack,
			},
			{ status: 500 },
		);
	}
}
