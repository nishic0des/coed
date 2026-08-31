import type { WebContainer } from "@webcontainer/api";

type WebContainerGlobal = typeof globalThis & {
	__coedWebContainerBootPromise?: Promise<WebContainer> | null;
	__coedWebContainerInstance?: WebContainer | null;
	__coedWebContainerPreviewUrl?: string | null;
	__coedWebContainerSetupComplete?: boolean;
	__coedWebContainerDevProcess?: { kill: () => void } | null;
};

function getStore(): WebContainerGlobal {
	return globalThis as WebContainerGlobal;
}

export async function getWebContainerInstance(): Promise<WebContainer> {
	const store = getStore();

	if (store.__coedWebContainerInstance) {
		return store.__coedWebContainerInstance;
	}

	if (!store.__coedWebContainerBootPromise) {
		store.__coedWebContainerBootPromise = import("@webcontainer/api")
			.then(({ WebContainer }) => WebContainer.boot())
			.then((instance) => {
				store.__coedWebContainerInstance = instance;
				return instance;
			})
			.catch((error) => {
				store.__coedWebContainerBootPromise = null;
				throw error;
			});
	}

	return store.__coedWebContainerBootPromise;
}

export function getBootedWebContainer(): WebContainer | null {
	return getStore().__coedWebContainerInstance ?? null;
}

export function getCachedPreviewUrl(): string | null {
	return getStore().__coedWebContainerPreviewUrl ?? null;
}

export function setCachedPreviewUrl(url: string | null) {
	getStore().__coedWebContainerPreviewUrl = url;
}

export function isWebContainerSetupComplete(): boolean {
	return getStore().__coedWebContainerSetupComplete === true;
}

export function setWebContainerSetupComplete(complete: boolean) {
	getStore().__coedWebContainerSetupComplete = complete;
}

export function getDevProcess() {
	return getStore().__coedWebContainerDevProcess ?? null;
}

export function setDevProcess(process: { kill: () => void } | null) {
	getStore().__coedWebContainerDevProcess = process;
}
