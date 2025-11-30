import NextAuth from "next-auth";
import authConfig from "./auth.config";
import { db } from "./lib/db";
import { getUserById } from "./modules/auth/actions";
import { PrismaAdapter } from "@auth/prisma-adapter";

export const runtime = "nodejs";

export const { handlers, signIn, signOut, auth } = NextAuth({
	session: {
		strategy: "jwt",
	},

	callbacks: {
		async signIn({ user, account }) {
			if (!user || !account) return false;

			const existingUser = await db.user.findUnique({
				where: { email: user.email! },
			});

			if (!existingUser) {
				const newUser = await db.user.create({
					data: {
						email: user.email!,
						name: user.name!,
						image: user.image || "",

						accounts: {
							create: {
								type: account.type,
								provider: account.provider,
								providerAccountId: account.providerAccountId,
								refreshToken: account.refresh_token,
								accessToken: account.access_token,
								expiresAt: account.expires_at,
								tokenType: account.token_type,
								scope: account.scope,
								idToken: account.id_token,
								sessionState: account.session_state as string,
							},
						},
					},
				});

				if (!newUser) return false;
				user.id = newUser.id; // IMPORTANT
			} else {
				user.id = existingUser.id; // IMPORTANT

				const existingAccount = await db.account.findUnique({
					where: {
						provider_providerAccountId: {
							provider: account.provider,
							providerAccountId: account.providerAccountId,
						},
					},
				});

				if (!existingAccount) {
					await db.account.create({
						data: {
							userId: existingUser.id,
							type: account.type,
							provider: account.provider,
							providerAccountId: account.providerAccountId,
							refreshToken: account.refresh_token,
							accessToken: account.access_token,
							expiresAt: account.expires_at,
							tokenType: account.token_type,
							scope: account.scope,
							idToken: account.id_token,
							sessionState: account.session_state as string,
						},
					});
				}
			}
			return true;
		},
		async jwt({ token }) {
			if (!token.sub) return token;
			const existingUser = await getUserById(token.sub);
			if (!existingUser) return token;
			token.name = existingUser.name;
			token.email = existingUser.email;
			token.role = existingUser.role;
			return token;
		},

		async session({ session, token }) {
			if (token.sub && session.user) {
				session.user.id = token.sub;
			}
			if (token.sub && session.user) {
				session.user.role = token.role;
			}
			return session;
		},
	},
	adapter: PrismaAdapter(db),
	secret: process.env.AUTH_SECRET,
	...authConfig,
});
