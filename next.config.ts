import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	reactCompiler: true,
	// Add empty turbopack config to use Turbopack
	turbopack: {},
	images: {
		remotePatterns: [
			{
				protocol: "https",
				hostname: "*",
				port: "",
				pathname: "/**",
			},
		],
	},
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
	// Add headers for WebContainer COOP support
	async headers() {
		return [
			{
				source: "/(.*)",
				headers: [
					{
						key: "Cross-Origin-Embedder-Policy",
						value: "require-corp",
					},
					{
						key: "Cross-Origin-Opener-Policy",
						value: "same-origin",
					},
					{
						key: "Cross-Origin-Resource-Policy",
						value: "cross-origin",
					},
				],
			},
		];
	},
};

export default nextConfig;
