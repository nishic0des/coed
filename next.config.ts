import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	reactCompiler: true,
	// Add empty turbopack config to use Turbopack
	turbopack: {},
	// Keep webpack config for compatibility
	webpack: (config, { isServer }) => {
		if (!isServer) {
			config.resolve.fallback = {
				...config.resolve.fallback,
				fs: false,
				net: false,
				tls: false,
				wasm: false,
			};
		}
		return config;
	},
	transpilePackages: ["../generated/prisma"],

	experimental: {
		serverComponentsExternalPackages: ["@prisma/client"],
	},
};

export default nextConfig;
