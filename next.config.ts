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
			};
		}
		return config;
	},
	transpilePackages: ["../generated/prisma"],

	experimental: {
		serverComponentsExternalPackages: ["@prisma/client"],
	},
	// Add headers for WebContainer COOP support
	// In next.config.ts
	async headers() {
		return [
			{
				source: "/(.*)",
				headers: [
					{
						key: "Cross-Origin-Embedder-Policy",
						value: "credentialless", // Changed from "require-corp"
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
			{
				// Allow WebContainer iframe sources
				source: "/api/webcontainer/(.*)",
				headers: [
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
