import type { TemplateFolder } from "./path-to-json";

export function isTemplateFolder(value: unknown): value is TemplateFolder {
	if (!value || typeof value !== "object") return false;
	const folder = value as Partial<TemplateFolder>;
	return typeof folder.folderName === "string" && Array.isArray(folder.items);
}

export function parseTemplateContent(raw: unknown): TemplateFolder | null {
	if (raw == null) return null;

	if (typeof raw === "string") {
		try {
			return parseTemplateContent(JSON.parse(raw));
		} catch {
			return null;
		}
	}

	return isTemplateFolder(raw) ? raw : null;
}
