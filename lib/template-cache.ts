import {
	scanTemplateDirectory,
	type TemplateFolder,
} from "@/modules/playground/lib/path-to-json";

interface CacheEntry {
	data: TemplateFolder;
	cachedAt: number;
}

const cache = new Map<string, CacheEntry>();
const TTL_MS = 5 * 60 * 1000;

export async function getCachedTemplateStructure(
	templateKey: string,
	templatePath: string,
): Promise<TemplateFolder> {
	const cached = cache.get(templateKey);
	if (cached && Date.now() - cached.cachedAt < TTL_MS) {
		return cached.data;
	}

	const data = await scanTemplateDirectory(templatePath);
	cache.set(templateKey, { data, cachedAt: Date.now() });
	return data;
}

export function invalidateTemplateCache(templateKey?: string) {
	if (templateKey) {
		cache.delete(templateKey);
	} else {
		cache.clear();
	}
}

// Ensure template edits on disk are picked up after deploys / local changes
invalidateTemplateCache("HONO");
invalidateTemplateCache("REACT");
