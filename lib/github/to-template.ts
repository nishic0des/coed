import type {
	TemplateFile,
	TemplateFolder,
	TemplateFileItem,
} from "@/modules/playground/lib/path-to-json";

/** Extensions treated as binary — skipped or replaced with a placeholder. */
export const BINARY_EXTENSIONS = new Set([
	"png",
	"jpg",
	"jpeg",
	"gif",
	"webp",
	"ico",
	"bmp",
	"svg",
	"woff",
	"woff2",
	"ttf",
	"eot",
	"otf",
	"mp3",
	"mp4",
	"wav",
	"webm",
	"pdf",
	"zip",
	"gz",
	"tgz",
	"rar",
	"7z",
	"exe",
	"dll",
	"so",
	"dylib",
	"bin",
	"dat",
	"lock",
]);

export function isBinaryExtension(ext: string): boolean {
	return BINARY_EXTENSIONS.has(ext.toLowerCase().replace(/^\./, ""));
}

function isTemplateFolder(item: TemplateFileItem): item is TemplateFolder {
	return "folderName" in item && "items" in item;
}

/**
 * Replace binary file contents with a short placeholder so WebContainer
 * and Monaco stay text-focused. Mutates in place and returns the tree.
 */
export function filterBinaryPlaceholder(
	folder: TemplateFolder,
): TemplateFolder {
	folder.items = folder.items.map((item) => {
		if (isTemplateFolder(item)) {
			return filterBinaryPlaceholder(item);
		}
		const file = item as TemplateFile;
		if (isBinaryExtension(file.fileExtension)) {
			return {
				...file,
				content: `[Binary file omitted: ${file.filename}.${file.fileExtension}]`,
			};
		}
		return file;
	});
	return folder;
}

/**
 * Pure helper used in tests: decide whether a file should be omitted or
 * placeholder-replaced based on extension.
 */
export function shouldTreatAsBinary(filename: string): boolean {
	const parts = filename.split(".");
	if (parts.length < 2) return false;
	return isBinaryExtension(parts[parts.length - 1]);
}
