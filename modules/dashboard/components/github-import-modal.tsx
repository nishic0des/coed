"use client";

import { useCallback, useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import {
	ChevronRight,
	Github,
	Globe,
	Loader2,
	Lock,
	Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
	getGithubConnectionStatus,
	importGithubRepo,
	listGithubRepos,
} from "@/modules/github/actions";
import type { GithubRepoSummary } from "@/lib/github/repos";

type GithubImportModalProps = {
	isOpen: boolean;
	onClose: () => void;
	onSubmit: (playgroundId: string) => void;
};

type Step = "select" | "configure";

const GithubImportModal = ({
	isOpen,
	onClose,
	onSubmit,
}: GithubImportModalProps) => {
	const [step, setStep] = useState<Step>("select");
	const [tab, setTab] = useState<"repos" | "url">("repos");
	const [connected, setConnected] = useState(false);
	const [hasRepoScope, setHasRepoScope] = useState(false);
	const [statusLoading, setStatusLoading] = useState(true);
	const [repos, setRepos] = useState<GithubRepoSummary[]>([]);
	const [reposLoading, setReposLoading] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [repoUrl, setRepoUrl] = useState("");
	const [branch, setBranch] = useState("");
	const [projectName, setProjectName] = useState("");
	const [selectedRepo, setSelectedRepo] = useState<GithubRepoSummary | null>(
		null,
	);
	const [error, setError] = useState<string | null>(null);
	const [isImporting, setIsImporting] = useState(false);

	const resetState = () => {
		setStep("select");
		setTab("repos");
		setSearchQuery("");
		setRepoUrl("");
		setBranch("");
		setProjectName("");
		setSelectedRepo(null);
		setError(null);
		setIsImporting(false);
	};

	const loadStatus = useCallback(async () => {
		setStatusLoading(true);
		setError(null);
		const result = await getGithubConnectionStatus();
		if (!result.success) {
			setError(result.error);
			setConnected(false);
			setHasRepoScope(false);
			setStatusLoading(false);
			return;
		}
		setConnected(result.data.connected);
		setHasRepoScope(result.data.hasRepoScope);
		setStatusLoading(false);
	}, []);

	const loadRepos = useCallback(async (search?: string) => {
		setReposLoading(true);
		setError(null);
		const result = await listGithubRepos({ search: search || undefined });
		if (!result.success) {
			setError(result.error);
			setRepos([]);
			setReposLoading(false);
			return;
		}
		setRepos(result.data.repos);
		setReposLoading(false);
	}, []);

	useEffect(() => {
		if (!isOpen) return;
		void loadStatus();
	}, [isOpen, loadStatus]);

	useEffect(() => {
		if (!isOpen || !connected || !hasRepoScope || tab !== "repos") return;
		const handle = setTimeout(() => {
			void loadRepos(searchQuery.trim());
		}, 300);
		return () => clearTimeout(handle);
	}, [isOpen, connected, hasRepoScope, tab, searchQuery, loadRepos]);

	const handleConnectGithub = () => {
		// Use the same Auth.js flow as /auth/sign-in (no invalid GitHub params).
		// Additional scopes come from auth.config.ts; GitHub will prompt to update permissions.
		void signIn("github", { callbackUrl: "/dashboard" });
	};

	const handleSelectRepo = (repo: GithubRepoSummary) => {
		setSelectedRepo(repo);
		setRepoUrl(repo.fullName);
		setBranch(repo.defaultBranch);
		setProjectName(repo.name);
		setError(null);
	};

	const handleContinue = () => {
		if (tab === "url") {
			if (!repoUrl.trim()) {
				setError("Enter a repository URL or owner/repo");
				return;
			}
			const parts = repoUrl
				.trim()
				.replace(/\.git$/i, "")
				.split("/");
			const inferredName = parts[parts.length - 1] || "Imported Project";
			if (!projectName) setProjectName(inferredName);
			if (!branch) setBranch("main");
		} else if (!selectedRepo) {
			setError("Select a repository to continue");
			return;
		}
		setError(null);
		setStep("configure");
	};

	const handleImport = async () => {
		setIsImporting(true);
		setError(null);
		const result = await importGithubRepo({
			repoUrl: selectedRepo?.fullName || repoUrl.trim(),
			branch: branch.trim() || undefined,
			title: projectName.trim() || undefined,
		});
		setIsImporting(false);
		if (!result.success) {
			setError(result.error);
			return;
		}
		onSubmit(result.data.id);
		resetState();
		onClose();
	};

	const needsAuth = !statusLoading && (!connected || !hasRepoScope);

	return (
		<Dialog
			open={isOpen}
			onOpenChange={(open) => {
				if (!open) {
					onClose();
					resetState();
				}
			}}>
			<DialogContent className="sm:max-w-[720px] max-h-[90vh] overflow-y-auto">
				{step === "select" ? (
					<>
						<DialogHeader>
							<DialogTitle className="text-2xl font-bold text-[#e93f3f] flex items-center gap-2">
								<Github size={24} className="text-[#e93f3f]" />
								Open GitHub Repository
							</DialogTitle>
							<DialogDescription>
								Import a repository into CoEd and keep it linked for sync
							</DialogDescription>
						</DialogHeader>

						{statusLoading ? (
							<div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
								<Loader2 className="h-5 w-5 animate-spin" />
								Checking GitHub connection...
							</div>
						) : needsAuth ? (
							<div className="flex flex-col items-center gap-4 py-10 text-center">
								<div className="rounded-full bg-[#E93F3F15] p-4">
									<Github className="h-8 w-8 text-[#E93F3F]" />
								</div>
								<div>
									<h3 className="text-lg font-semibold mb-1">
										{!connected ? "Connect GitHub" : "Grant repository access"}
									</h3>
									<p className="text-sm text-muted-foreground max-w-md">
										{!connected
											? "Sign in with GitHub to browse and import your repositories, including private ones."
											: "Your GitHub account is connected, but CoEd needs repository access to import private repos."}
									</p>
									<p className="text-xs text-muted-foreground max-w-md mt-3">
										If GitHub shows a redirect_uri error, add this exact
										callback URL in your GitHub OAuth App settings:{" "}
										<code className="text-[11px] bg-muted px-1 py-0.5 rounded">
											http://localhost:3000/api/auth/callback/github
										</code>
									</p>
								</div>
								<Button
									className="bg-[#E93F3F] hover:bg-[#d03636] text-white"
									onClick={handleConnectGithub}>
									<Github className="h-4 w-4 mr-2" />
									{!connected
										? "Sign in with GitHub"
										: "Grant repository access"}
								</Button>
								{error && <p className="text-sm text-destructive">{error}</p>}
							</div>
						) : (
							<div className="flex flex-col gap-4 py-2">
								<Tabs
									value={tab}
									onValueChange={(value) => setTab(value as "repos" | "url")}>
									<TabsList className="grid w-full grid-cols-2">
										<TabsTrigger value="repos">Your repositories</TabsTrigger>
										<TabsTrigger value="url">Paste URL</TabsTrigger>
									</TabsList>

									<TabsContent value="repos" className="mt-4 space-y-4">
										<div className="relative">
											<Search
												className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
												size={16}
											/>
											<Input
												placeholder="Search your repositories..."
												value={searchQuery}
												onChange={(e) => setSearchQuery(e.target.value)}
												className="pl-9"
											/>
										</div>

										{reposLoading ? (
											<div className="flex items-center justify-center py-10 text-muted-foreground gap-2">
												<Loader2 className="h-5 w-5 animate-spin" />
												Loading repositories...
											</div>
										) : repos.length === 0 ? (
											<div className="text-center py-10 text-muted-foreground text-sm">
												No repositories found
											</div>
										) : (
											<div className="grid gap-2 max-h-[320px] overflow-y-auto pr-1">
												{repos.map((repo) => (
													<button
														key={repo.fullName}
														type="button"
														onClick={() => handleSelectRepo(repo)}
														className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-all hover:border-[#E93F3F] ${
															selectedRepo?.fullName === repo.fullName
																? "border-[#E93F3F] shadow-[0_0_0_1px_#E93F3F]"
																: ""
														}`}>
														<div className="mt-0.5">
															{repo.private ? (
																<Lock
																	size={16}
																	className="text-muted-foreground"
																/>
															) : (
																<Globe
																	size={16}
																	className="text-muted-foreground"
																/>
															)}
														</div>
														<div className="flex-1 min-w-0">
															<div className="flex items-center gap-2">
																<span className="font-medium truncate">
																	{repo.fullName}
																</span>
																<Badge variant="outline" className="text-xs">
																	{repo.private ? "Private" : "Public"}
																</Badge>
															</div>
															{repo.description && (
																<p className="text-xs text-muted-foreground line-clamp-1 mt-1">
																	{repo.description}
																</p>
															)}
															<p className="text-xs text-muted-foreground mt-1">
																Default branch: {repo.defaultBranch}
															</p>
														</div>
													</button>
												))}
											</div>
										)}
									</TabsContent>

									<TabsContent value="url" className="mt-4 space-y-4">
										<div className="space-y-2">
											<Label htmlFor="repo-url">Repository URL</Label>
											<Input
												id="repo-url"
												placeholder="owner/repo or https://github.com/owner/repo"
												value={repoUrl}
												onChange={(e) => {
													setRepoUrl(e.target.value);
													setSelectedRepo(null);
												}}
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor="branch-url">Branch (optional)</Label>
											<Input
												id="branch-url"
												placeholder="main"
												value={branch}
												onChange={(e) => setBranch(e.target.value)}
											/>
										</div>
									</TabsContent>
								</Tabs>

								{error && <p className="text-sm text-destructive">{error}</p>}

								<div className="flex justify-end gap-3 pt-4 border-t">
									<Button variant="outline" onClick={onClose}>
										Cancel
									</Button>
									<Button
										className="bg-[#E93F3F] hover:bg-[#d03636] text-white"
										onClick={handleContinue}
										disabled={
											tab === "repos" ? !selectedRepo : !repoUrl.trim()
										}>
										Continue <ChevronRight size={16} className="ml-1" />
									</Button>
								</div>
							</div>
						)}
					</>
				) : (
					<>
						<DialogHeader>
							<DialogTitle className="text-2xl font-bold text-[#e93f3f]">
								Configure Import
							</DialogTitle>
							<DialogDescription>
								Review repository details before importing
							</DialogDescription>
						</DialogHeader>

						<div className="flex flex-col gap-4 py-4">
							<div className="p-4 rounded-lg border shadow-[0_0_0_1px_#E93F3F,0_8px_20px_rgba(233,63,63,0.15)] space-y-2">
								<div className="flex items-center gap-2">
									<Github size={18} />
									<span className="font-medium">
										{selectedRepo?.fullName || repoUrl}
									</span>
									{selectedRepo && (
										<Badge variant="outline">
											{selectedRepo.private ? "Private" : "Public"}
										</Badge>
									)}
								</div>
								<p className="text-sm text-muted-foreground">
									Branch: {branch || selectedRepo?.defaultBranch || "default"}
								</p>
							</div>

							<div className="space-y-2">
								<Label htmlFor="project-name">Project Name</Label>
								<Input
									id="project-name"
									placeholder="my-project"
									value={projectName}
									onChange={(e) => setProjectName(e.target.value)}
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="branch-config">Branch</Label>
								<Input
									id="branch-config"
									placeholder="main"
									value={branch}
									onChange={(e) => setBranch(e.target.value)}
								/>
							</div>

							{error && <p className="text-sm text-destructive">{error}</p>}
						</div>

						<div className="flex justify-between gap-3 pt-4 border-t">
							<Button
								variant="outline"
								onClick={() => setStep("select")}
								disabled={isImporting}>
								Back
							</Button>
							<Button
								className="bg-[#E93F3F] hover:bg-[#d03636] text-white"
								onClick={handleImport}
								disabled={isImporting}>
								{isImporting ? (
									<>
										<Loader2 className="h-4 w-4 mr-2 animate-spin" />
										Importing...
									</>
								) : (
									"Import Repository"
								)}
							</Button>
						</div>
					</>
				)}
			</DialogContent>
		</Dialog>
	);
};

export default GithubImportModal;
