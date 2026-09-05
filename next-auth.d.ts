import { UserRole } from "@prisma/client";
import { type DefaultSession } from "next-auth";

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

declare module "next-auth/jwt" {
	interface JWT {
		role?: UserRole;
	}
}

declare module "@auth/core/jwt" {
	interface JWT {
		role?: UserRole;
	}
}
