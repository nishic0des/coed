import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import type { NextAuthConfig } from "next-auth";

export default {
	providers: [
		GitHub({
			clientId: process.env.AUTH_GITHUB_ID,
			clientSecret: process.env.AUTH_GITHUB_SECRET,
			// GitHub returns `iss=https://github.com/login/oauth` (RFC 9207).
			// Without this, Auth.js compares against https://authjs.dev and fails.
			issuer: "https://github.com/login/oauth",
			authorization: {
				// Classic OAuth Apps have no contents:read; `repo` is required for private imports.
				params: { scope: "read:user user:email repo" },
			},
		}),
		Google({
			clientId: process.env.AUTH_GOOGLE_ID,
			clientSecret: process.env.AUTH_GOOGLE_SECRET,
		}),
	],
} satisfies NextAuthConfig;
