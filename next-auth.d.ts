import { UserRole } from "./src/generated";
import NextAuth, { User, type DefaultSession } from "next-auth";

export type ExtendedUser = DefaultSession["user"] & {
	role: UserRole;
};

declare module "next-auth" {
	interface Session {
		user: {
			id: string;
			role: UserRole;
		} & DefaultSession["user"];
	}
}

import { JWT } from "next-auth/jwt";

declare module "next-auth/jwt" {
	interface JWT {
		role: UserRole;
	}
}
