import type { WebContainer } from "@webcontainer/api";

type WebContainerGlobal = typeof globalThis & {
	__coedWebContainerBootPromise?: Promise<WebContainer> | null;
	__coedWebContainerInstance?: WebContainer | null;
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
