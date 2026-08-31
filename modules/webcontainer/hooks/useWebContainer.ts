import { useState, useEffect, useCallback, useRef } from "react";
import type { WebContainer } from "@webcontainer/api";
import { TemplateFolder } from "@/modules/playground/lib/path-to-json";
import { getWebContainerInstance } from "@/modules/webcontainer/lib/webcontainer-singleton";

const isClient = typeof window !== "undefined";

interface UseWebContainerProps {
	templateData: TemplateFolder;
}

interface UseWebContainerReturn {
	serverUrl: string | null;
	isLoading: boolean;
	error: string | null;
	instance: WebContainer | null;
	writeFileSync: (path: string, content: string) => Promise<void>;
	destroy: () => void;
	setServerUrl: (url: string) => void;
}

export const useWebContainer = ({
	templateData,
}: UseWebContainerProps): UseWebContainerReturn => {
	const [serverUrl, setServerUrl] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState<boolean>(true);
	const [error, setError] = useState<string | null>(null);
	const [instance, setInstance] = useState<WebContainer | null>(null);
	const bootedRef = useRef(false);

	const hasTemplate = Boolean(templateData?.items?.length);

	useEffect(() => {
		if (!isClient || !hasTemplate || bootedRef.current) return;

		let mounted = true;
		bootedRef.current = true;

		async function initializeWebContainer() {
			try {
				const webcontainerInstance = await getWebContainerInstance();
				if (!mounted) return;
				setInstance(webcontainerInstance);
				setIsLoading(false);
			} catch (err) {
				if (mounted) {
					console.error("Failed to initialize WebContainer:", err);
					setError(
						err instanceof Error
							? err.message
							: "Failed to initialize WebContainer",
					);
					setIsLoading(false);
					bootedRef.current = false;
				}
			}
		}

		initializeWebContainer();

		return () => {
			mounted = false;
		};
	}, [hasTemplate]);

	const writeFileSync = useCallback(
		async (path: string, content: string) => {
			if (!instance) {
				throw new Error("WebContainer instance is not available");
			}
			try {
				// Only write — do not remount the FS or restart the dev server.
				// Vite / Next HMR picks up the change automatically.
				await instance.fs.writeFile(path, content);
			} catch (err) {
				// If parent dirs are missing (new file), create them then retry
				const pathParts = path.split("/");
				const folderPath = pathParts.slice(0, -1).join("/");
				if (folderPath) {
					await instance.fs.mkdir(folderPath, { recursive: true });
					await instance.fs.writeFile(path, content);
					return;
				}
				const errorMessage =
					err instanceof Error ? err.message : "Failed to write file";
				console.error(`Failed to write file at path ${path}: ${err}`);
				throw new Error(`Failed to write file at path ${path}:${errorMessage}`);
			}
		},
		[instance],
	);

	const destroy = useCallback(() => {
		if (instance) {
			instance.teardown();
			setInstance(null);
			setServerUrl(null);
			bootedRef.current = false;
		}
	}, [instance]);

	return {
		serverUrl,
		isLoading,
		error,
		instance,
		writeFileSync,
		destroy,
		setServerUrl,
	};
};
