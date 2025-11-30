import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import React from "react";
import { LogoutButtonProps } from "../types";

const LogOutButton = ({ children }: LogoutButtonProps) => {
	const router = useRouter();
	const onLogout = async () => {
		await signOut();
		router.refresh();
	};
	return (
		<span className="cursor-pointer" onClick={onLogout}>
			{children}
		</span>
	);
};

export default LogOutButton;
