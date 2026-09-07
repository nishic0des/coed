import fs from "fs";
import path from "path";
import { getCachedTemplateStructure } from "@/lib/template-cache";
import type { TemplateFolder } from "@/modules/playground/lib/path-to-json";

export const templatePaths = {
	REACT: "/templates/bolt-vite-react-ts",
	NEXTJS: "/templates/nextjs-new",
	VUE: "/templates/vue",
	EXPRESS: "/templates/express-simple",
	HONO: "/templates/hono-nodejs-starter",
	ANGULAR: "/templates/angular",
} as const;

export type TemplateKey = keyof typeof templatePaths;

export async function loadTemplateStructure(
	templateKey: TemplateKey,
): Promise<TemplateFolder> {
	const templatePath = templatePaths[templateKey];
	if (!templatePath) {
		throw new Error(`Invalid template: ${templateKey}`);
	}

	const inputPath = path.join(process.cwd(), templatePath);
	try {
		await fs.promises.access(inputPath);
	} catch {
		throw new Error(
			`Template directory ${inputPath} does not exist. Ensure templates are included in the deployment.`,
		);
	}

	return getCachedTemplateStructure(templateKey, inputPath);
}
