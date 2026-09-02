"use client";

import { useState } from "react";
import { Github, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { syncGithubRepo } from "@/modules/github/actions";
import { toast } from "sonner";

type GithubSyncButtonProps = {
	playgroundId: string;
	owner: string;
	repo: string;
	branch: string;
	commitSha?: string | null;
	onSynced?: () => void | Promise<void>;
};

export default function GithubSyncButton({
	playgroundId,
	owner,
	repo,
	branch,
	commitSha,
	onSynced,
}: GithubSyncButtonProps) {
	const [isSyncing, setIsSyncing] = useState(false);
	const shortSha = commitSha ? commitSha.slice(0, 7) : null;

	const handleSync = async () => {
		setIsSyncing(true);
		try {
			const result = await syncGithubRepo({ playgroundId });
			if (!result.success) {
				toast.error(result.error);
				return;
			}
			if (result.data.unchanged) {
				toast.info("Already up to date with GitHub");
			} else {
				toast.success("Pulled latest changes from GitHub");
				await onSynced?.();
			}
		} catch (error) {
			console.error("GitHub sync failed:", error);
			toast.error("Failed to pull from GitHub");
		} finally {
			setIsSyncing(false);
		}
	};

	return (
		<div className="flex items-center gap-2">
			<div className="hidden sm:flex flex-col items-end text-xs text-muted-foreground mr-1">
				<span className="flex items-center gap-1">
					<Github className="h-3 w-3" />
					{owner}/{repo}
				</span>
				<span>
					{branch}
					{shortSha ? ` @ ${shortSha}` : ""}
				</span>
			</div>
			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						size="sm"
						variant="outline"
						onClick={handleSync}
						disabled={isSyncing}>
						{isSyncing ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<RefreshCw className="h-4 w-4" />
						)}
						<span className="ml-1 hidden md:inline">Pull</span>
					</Button>
				</TooltipTrigger>
				<TooltipContent>Pull from GitHub</TooltipContent>
			</Tooltip>
		</div>
	);
}
