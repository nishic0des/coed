"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";

export const getUserById = async (id: string) => {
	try {
		const user = await db.user.findUnique({
			where: { id },
			include: {
				accounts: true,
			},
		});
		return user;
	} catch (error) {
		console.error("Error finding user by ID: ", error);
		return null;
	}
};

export const getAccountByUserId = async (userId: string) => {
	try {
		const acc = await db.account.findFirst({
			where: {
				userId,
			},
		});
		return acc;
	} catch (error) {
		console.error("Error finding user by ID: ", error);
		return null;
	}
};

export const currentUser = async () => {
	const user = await auth();
	return user?.user;
};
