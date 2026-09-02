import NextAuth from "next-auth";
import authConfig from "./auth.config";
import { db } from "./lib/db";
import { getUserById } from "./modules/auth/actions";

export const runtime = "nodejs";

type AccountFields = {
	type: string;
	provider: string;
	providerAccountId: string;
	refresh_token?: string | null;
	access_token?: string | null;
	expires_at?: number | null;
	token_type?: string | null;
	scope?: string | null;
	id_token?: string | null;
	session_state?: string | null;
};

function accountWriteData(account: AccountFields) {
	return {
		type: account.type,
		provider: account.provider,
		providerAccountId: account.providerAccountId,
		refreshToken: account.refresh_token,
		accessToken: account.access_token,
		expiresAt: account.expires_at,
		tokenType: account.token_type,
		scope: account.scope,
		idToken: account.id_token,
		sessionState: account.session_state as string | undefined,
	};
}

/**
 * Upsert an OAuth account onto `userId`.
 * If this provider account is already linked to a different user (duplicate
 * Google/GitHub signups), reassign it to `userId` — the user just proved
 * ownership via OAuth (needed for "Connect GitHub" while signed in).
 */
async function upsertOAuthAccount(userId: string, account: AccountFields) {
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
				userId,
				...accountWriteData(account),
			},
		});
		return;
	}

	await db.account.update({
		where: { id: existingAccount.id },
		data: {
			userId,
			...accountWriteData(account),
		},
	});
}

export const { handlers, signIn, signOut, auth } = NextAuth({
	session: {
		strategy: "jwt",
	},

	callbacks: {
		async signIn({ user, account }) {
			if (!user?.email || !account) return false;

			const existingUser = await db.user.findUnique({
				where: { email: user.email },
			});

			if (!existingUser) {
				const newUser = await db.user.create({
					data: {
						email: user.email,
						name: user.name || user.email,
						image: user.image || "",
					},
				});
				user.id = newUser.id;
				await upsertOAuthAccount(newUser.id, account);
				return true;
			}

			user.id = existingUser.id;
			await upsertOAuthAccount(existingUser.id, account);
			return true;
		},
		async jwt({ token, user }) {
			// On initial sign-in, prefer the id we set in the signIn callback
			if (user?.id) {
				token.sub = user.id;
			}
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
	// JWT sessions + custom signIn own user/account writes.
	// PrismaAdapter was also linking accounts and threw OAuthAccountNotLinked
	// when connecting GitHub while already signed in with Google (or when the
	// same GitHub account existed on a duplicate user row).
	secret: process.env.AUTH_SECRET,
	...authConfig,
});
