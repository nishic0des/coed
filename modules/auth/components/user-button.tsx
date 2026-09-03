"use client";

import React from "react";
import Link from "next/link";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "../hooks/user-current-user";
import { LogOut, User } from "lucide-react";
import { cn } from "@/lib/utils";
import LogOutButton from "./logout-button";

const UserButton = () => {
	const user = useCurrentUser();

	if (!user) {
		return (
			<Button asChild variant="outline" size="sm">
				<Link href="/auth/sign-in">Sign In</Link>
			</Button>
		);
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger>
				<div className={cn("relative rounded-full")}>
					<Avatar>
						<AvatarImage src={user?.image ?? undefined} alt={user?.name ?? undefined} />
						<AvatarFallback className="bg-amber-600">
							<User className="text-white" />
						</AvatarFallback>
					</Avatar>
				</div>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="mr-4">
				<DropdownMenuItem>
					<span>{user?.email}</span>
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<LogOutButton>
					<DropdownMenuItem>
						<LogOut className="h-4 w-4 mr-2" />
						LogOut
					</DropdownMenuItem>
				</LogOutButton>
			</DropdownMenuContent>
		</DropdownMenu>
	);
};

export default UserButton;
