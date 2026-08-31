import { serve } from "@hono/node-server";
import { watch } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appPath = path.join(__dirname, "app.ts");
const port = 3000;

async function loadApp() {
	const url = `${pathToFileURL(appPath).href}?t=${Date.now()}`;
	const mod = await import(url);
	return mod.default;
}

let app = await loadApp();

serve({
	fetch: (request) => app.fetch(request),
	port,
});

console.log(`Server is running on http://localhost:${port}`);

let reloading = false;
watch(path.join(__dirname), { recursive: true }, async (_event, filename) => {
	if (!filename || filename === "server.ts") return;
	if (reloading) return;
	reloading = true;
	try {
		app = await loadApp();
		console.log(`[hot-reload] Reloaded ${filename}`);
	} catch (error) {
		console.error("[hot-reload] Failed to reload:", error);
	} finally {
		reloading = false;
	}
});
