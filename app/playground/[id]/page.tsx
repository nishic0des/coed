/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { Separator } from "@/components/ui/separator";

import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";

import { usePlayground } from "@/modules/playground/hooks/usePlayground";

import { TooltipProvider } from "@/components/ui/tooltip";

import { useParams } from "next/navigation";
import LoadingStep from "@/modules/playground/components/loader";
import React, { useCallback, useEffect, useRef, useState } from "react";

import { TemplateFileTree } from "@/modules/playground/components/playground-explorer";

import {
	TemplateFile,
	TemplateFolder,
} from "@/modules/playground/lib/path-to-json";

import { useFileExplorer } from "@/modules/playground/hooks/useFileExplorer";

import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";

import { Button } from "@/components/ui/button";

import {
	AlertCircle,
	Bot,
	FileText,
	FolderOpen,
	Save,
	Settings,
	X,
} from "lucide-react";

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Tabs, TabsList } from "@/components/ui/tabs";

import { TabsTrigger } from "@radix-ui/react-tabs";

import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "@/components/ui/resizable";

import { PlaygroundEditor } from "@/modules/playground/components/playground-editor";

import { useWebContainer } from "@/modules/webcontainer/hooks/useWebContainer";

import WebContainerPreview from "@/modules/webcontainer/components/webcontainer-preview";
import { findFilePath } from "@/modules/playground/lib";
import { toast } from "sonner";
import ToggleAI from "@/modules/playground/components/toggle-ai";
import { useAISuggestions } from "@/modules/playground/hooks/useAISuggestion";
import GithubSyncButton from "@/modules/playground/components/github-sync-button";

const MAX_FILES = 8;
const MAX_ACTIVE = 30_000;
const MAX_OTHER = 15_000;

function buildChatContext(
	openFiles: Array<{
		filename: string;
		fileExtension: string;
		content: string;
		id: string;
	}>,
	activeFileId: string | null,
	templateData: TemplateFolder | null,
) {
	const snippets = openFiles.slice(0, MAX_FILES).map((file) => {
		const path =
			(templateData && findFilePath(file, templateData)?.replace(/^\/+/, "")) ||
			`${file.filename}${file.fileExtension ? `.${file.fileExtension}` : ""}`;

		const isActive = file.id === activeFileId;
		const limit = isActive ? MAX_ACTIVE : MAX_OTHER;

		return {
			path,
			content: file.content.slice(0, limit),
			language: file.fileExtension || undefined,
		};
	});

	const active = openFiles.find((f) => f.id === activeFileId);
	const activeFilePath = active
		? (templateData &&
				findFilePath(active, templateData)?.replace(/^\/+/, "")) ||
			`${active.filename}${active.fileExtension ? `.${active.fileExtension}` : ""}`
		: undefined;

	snippets.sort((a, b) =>
		a.path === activeFilePath ? -1 : b.path === activeFilePath ? 1 : 0,
	);

	return { contextFiles: snippets, activeFilePath };
}

const MainPlaygroundPage = () => {
	const { id } = useParams<{ id: string }>();

	const {
		playgroundData,
		templateData,
		isLoading,
		error,
		saveTemplateData,
		loadPlayground,
	} = usePlayground(id);

	const {
		activeFileId,

		closeAllFiles,

		openFile,

		openFiles,

		setTemplateData,

		setActiveFileId,

		setPlaygroudId,

		setOpenFiles,

		closeFile,
		handleAddFile,
		handleAddFolder,
		handleDeleteFile,
		handleDeleteFolder,
		handleRenameFile,
		handleRenameFolder,
		updateFileContent,
	} = useFileExplorer();

	const { contextFiles, activeFilePath } = buildChatContext(
		openFiles,
		activeFileId,
		templateData,
	);

	const {
		serverUrl,

		isLoading: containerLoading,

		error: containerError,

		instance,

		writeFileSync,
	} = useWebContainer({ templateData: templateData! });

	const lastSynedContent = useRef<Map<string, string>>(new Map());

	useEffect(() => {
		setPlaygroudId(id);
	}, [id, setPlaygroudId]);

	useEffect(() => {
		setTemplateData(templateData);
	}, [templateData, setTemplateData, openFiles.length]);

	const activeFile = openFiles.find((f) => f.id === activeFileId);

	const hasUnsavedChanges = openFiles.some((file) => file.hasUnsavedChanges);

	const [isPreviewVisible, setIsPreviewVisible] = useState(true);

	const aiSuggestion = useAISuggestions();

	const handleFileSelect = (file: TemplateFile) => {
		openFile(file);
	};

	const handleSave = useCallback(
		async (fileId?: string, contentOverride?: string) => {
			const targetedFileId = fileId || activeFileId;
			if (!targetedFileId) return;

			const fileToSave = openFiles.find((f) => f.id === targetedFileId);

			if (!fileToSave) return;

			const content = contentOverride ?? fileToSave.content;

			const latestTemplateData = useFileExplorer.getState().templateData;
			if (!latestTemplateData) return;

			try {
				const filePath = findFilePath(fileToSave, latestTemplateData);
				if (!filePath) {
					toast.error(
						`Could not find path for file: ${fileToSave.filename}.${fileToSave.fileExtension}`,
					);
					return;
				}
				const updatedTemplateData = JSON.parse(
					JSON.stringify(latestTemplateData),
				);
				const updateFileContentInTree = (items: any[]): any[] =>
					items.map((item) => {
						if ("folderName" in item) {
							return {
								...item,
								items: updateFileContentInTree(item.items),
							};
						}
						if (
							item.filename === fileToSave.filename &&
							item.fileExtension === fileToSave.fileExtension
						) {
							return { ...item, content };
						}
						return item;
					});
				updatedTemplateData.items = updateFileContentInTree(
					updatedTemplateData.items,
				);

				// Write into the live WebContainer FS — Vite/Next HMR updates the
				// preview in place. Do not remount the iframe or respawn the server.
				if (instance) {
					await writeFileSync(filePath, content);
				}

				lastSynedContent.current.set(fileToSave.id, content);
				await saveTemplateData(updatedTemplateData);
				setTemplateData(updatedTemplateData);

				const updatedOpenFiles = openFiles.map((f) =>
					f.id === targetedFileId
						? {
								...f,
								content,
								originalContent: content,
								hasUnsavedChanges: false,
							}
						: f,
				);
				setOpenFiles(updatedOpenFiles);
				toast.success("File saved successfully");
			} catch (error) {
				console.error("Failed to save file", error);

				toast.error("Failed to save file");
			}
		},
		[
			activeFileId,
			openFiles,
			writeFileSync,
			instance,
			saveTemplateData,
			setTemplateData,
			setOpenFiles,
		],
	);

	const handleSaveFromEditor = useCallback(
		(content: string) => handleSave(undefined, content),
		[handleSave],
	);

	const handleSaveAll = async () => {
		const unsavedFiles = openFiles.filter((f) => f.hasUnsavedChanges);

		if (unsavedFiles.length === 0) {
			toast.info("No unsaved changes to save");
			return;
		}
		try {
			await Promise.all(unsavedFiles.map((file) => handleSave(file.id)));
			toast.success("All files saved successfully");
		} catch (error) {
			console.error("Failed to save files", error);
			toast.error("Failed to save files");
		}
	};

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.ctrlKey && e.key === "s") {
				e.preventDefault();
				handleSave();
			}
			if (e.ctrlKey && e.shiftKey && e.key === "S") {
				e.preventDefault();
				handleSaveAll();
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => {
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [handleSave]);

	const wrapperHandleAddFile = useCallback(
		(newFile: TemplateFile, parentPath: string) => {
			return handleAddFile(
				newFile,
				parentPath,
				writeFileSync,
				instance!,
				saveTemplateData,
			);
		},
		[handleAddFile, writeFileSync, instance, saveTemplateData],
	);

	const wrappedHandleAddFolder = useCallback(
		(newFolder: TemplateFolder, parentPath: string) => {
			return handleAddFolder(
				newFolder,
				parentPath,
				instance!,
				saveTemplateData,
			);
		},
		[handleAddFolder, instance, saveTemplateData],
	);

	const wrappedHandleDeleteFile = useCallback(
		(file: TemplateFile, parentPath: string) => {
			return handleDeleteFile(file, parentPath, saveTemplateData);
		},
		[handleDeleteFile, saveTemplateData],
	);

	const wrappedHandleDeleteFolder = useCallback(
		(folder: TemplateFolder, parentPath: string) => {
			return handleDeleteFolder(folder, parentPath, saveTemplateData);
		},
		[handleDeleteFolder, saveTemplateData],
	);

	const wrappedHandleRenameFile = useCallback(
		(
			file: TemplateFile,
			newFilename: string,
			newExtension: string,
			parentPath: string,
		) => {
			return handleRenameFile(
				file,
				newFilename,
				newExtension,
				parentPath,
				saveTemplateData,
			);
		},
		[handleRenameFile, saveTemplateData],
	);

	const wrappedHandleRenameFolder = useCallback(
		(folder: TemplateFolder, newFolderName: string, parentPath: string) => {
			return handleRenameFolder(
				folder,
				newFolderName,
				parentPath,
				saveTemplateData,
			);
		},
		[handleRenameFolder, saveTemplateData],
	);

	if (error) {
		return (
			<div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] p-4">
				<AlertCircle className="h-12 w-12 text-red-500 mb-4" />
				<h2 className="text-xl font-semibold text-red-600 mb-2">
					Something went wrong :(
				</h2>
				<p className="text-gray-600 mb-4">{error}</p>
				<Button
					onClick={() => window.location.reload()}
					variant={"destructive"}>
					Try Again
				</Button>
			</div>
		);
	}

	if (isLoading) {
		return (
			<div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] p-4">
				<div className="w-full max-w-md p-6 rounded-lg shadow-sm border">
					<h2 className="text-xl font-semibold mb-6 text-center">
						Loading Playground
					</h2>
					<div className="mb-8">
						<LoadingStep
							currentStep={1}
							step={1}
							label="Loading playground data"
						/>
						<LoadingStep
							currentStep={2}
							step={2}
							label="Setting up environment"
						/>
						<LoadingStep currentStep={3} step={3} label="Ready to code" />
					</div>
				</div>
			</div>
		);
	}

	if (!templateData) {
		<div className="flex flex-co items-center justify-center h-[calc(100vh-4rem)] p-4">
			<FolderOpen className="h-12 w-12 text-amber-500 mb-4" />
			<h2 className="text-xl font-semibold text-amber-600 mb-2">
				No template data available
			</h2>
			<Button onClick={() => window.location.reload()} variant={"outline"}>
				Reload Template
			</Button>
		</div>;
	}

	return (
		<TooltipProvider>
			<>
				<TemplateFileTree
					data={templateData!}
					onFileSelect={handleFileSelect}
					selectedFile={activeFile}
					title="File Explorer"
					onAddFile={wrapperHandleAddFile}
					onAddFolder={wrappedHandleAddFolder}
					onDeleteFile={wrappedHandleDeleteFile}
					onDeleteFolder={wrappedHandleDeleteFolder}
					onRenameFile={wrappedHandleRenameFile}
					onRenameFolder={wrappedHandleRenameFolder}
				/>

				<SidebarInset>
					<header className="flex h-16 shrink-0 items-center gap-2 border-">
						<SidebarTrigger className="ml-1" />

						<Separator orientation="vertical" className="mr-2 h-4" />

						<div className="flex flex-1 items-center gap-2">
							<div className="flex flex-col flex-1">
								<h1 className="text-sm font-medium">
									{playgroundData?.title || "Untitled Playground"}
								</h1>

								<p className="text-xs text-muted-foreground">
									{openFiles.length} file(s) open
									{hasUnsavedChanges && " * unsaved changes"}
								</p>
							</div>

							<div className="flex items-center gap-1">
								{playgroundData?.sourceType === "GITHUB" &&
									playgroundData.githubOwner &&
									playgroundData.githubRepo &&
									playgroundData.githubBranch && (
										<GithubSyncButton
											playgroundId={id}
											owner={playgroundData.githubOwner}
											repo={playgroundData.githubRepo}
											branch={playgroundData.githubBranch}
											commitSha={playgroundData.githubCommitSha}
											onSynced={loadPlayground}
										/>
									)}

								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											size="sm"
											variant="outline"
											onClick={() => handleSave()}
											disabled={!activeFile || !activeFile.hasUnsavedChanges}>
											<Save className="h-4 w-4" />
										</Button>
									</TooltipTrigger>

									<TooltipContent>Save (Ctril+S)</TooltipContent>
								</Tooltip>

								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											size="sm"
											variant="outline"
											onClick={() => handleSaveAll()}
											disabled={!hasUnsavedChanges}>
											<Save className="h-4 w-4" /> All
										</Button>
									</TooltipTrigger>

									<TooltipContent>Save All (Ctrl+Shift+S)</TooltipContent>
								</Tooltip>

								<ToggleAI
									isEnabled={aiSuggestion.isEnabled}
									onToggle={aiSuggestion.toggleEnabled}
									suggestionLoading={aiSuggestion.isLoading}
									playgroundId={id}
									contextFiles={contextFiles}
									activeFilePath={activeFilePath}
								/>

								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button size="sm" variant="outline">
											<Settings className="h-4 w-4" />
										</Button>
									</DropdownMenuTrigger>

									<DropdownMenuContent align="end">
										<DropdownMenuItem
											onClick={() => setIsPreviewVisible(!isPreviewVisible)}>
											{isPreviewVisible ? "Hide Preview" : "Show Preview"}
										</DropdownMenuItem>

										<DropdownMenuSeparator />

										<DropdownMenuItem onClick={closeAllFiles}>
											Close All Files
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							</div>
						</div>
					</header>

					<div className="h-[calc(100vh-4rem)]">
						{openFiles.length > 0 ? (
							<div className="h-full flex flex-col">
								<div className="border-b bg-muted/30">
									<Tabs
										value={activeFileId || ""}
										onValueChange={setActiveFileId}>
										<div className="flex items-center justify-between px-4 py-2">
											<TabsList className="h-8 bg-transparent p-0">
												{openFiles.map((file) => (
													<TabsTrigger
														key={file.id}
														value={file.id}
														className="relative h-8 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm group">
														<div className="flex items-center gap-2">
															<FileText className="h-3 w-3" />

															<span>
																{file.filename}.{file.fileExtension}
															</span>

															{file.hasUnsavedChanges && (
																<span className="h-2 w-2 rounded-full bg-orange-500" />
															)}

															<span
																className="ml-2 h-4 w-4 hover:bg-destructive hover:text-destructive-foreground rounded-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
																onClick={(e) => {
																	e.stopPropagation();

																	closeFile(file.id);
																}}>
																<X className="h-3 w-3" />
															</span>
														</div>
													</TabsTrigger>
												))}
											</TabsList>

											{openFiles.length > 1 && (
												<Button
													size={"sm"}
													variant={"ghost"}
													onClick={closeAllFiles}
													className="h-6 px-2 text-xs">
													Close All
												</Button>
											)}
										</div>
									</Tabs>
								</div>

								<div className="flex-1">
									{isPreviewVisible && instance ? (
										<ResizablePanelGroup
											direction="horizontal"
											className="h-full">
											<ResizablePanel
												id="editor-panel"
												defaultSize={50}
												minSize={25}
												order={1}>
												<PlaygroundEditor
													activeFile={activeFile}
													content={activeFile?.content || ""}
													onContentChange={(value) => {
														activeFileId &&
															updateFileContent(activeFileId, value);
													}}
													suggestion={aiSuggestion.suggestion}
													suggestionLoading={aiSuggestion.isLoading}
													suggestionPosition={aiSuggestion.position}
													onAcceptSuggestion={(editor, monaco) =>
														aiSuggestion.acceptSuggestion(editor, monaco)
													}
													onRejectSuggestion={(editor) =>
														aiSuggestion.rejectSuggestion(editor)
													}
													onTriggerSuggestion={(type, editor) =>
														aiSuggestion.fetchSuggestion(type, editor)
													}
													onSave={handleSaveFromEditor}
												/>
											</ResizablePanel>

											<ResizableHandle />

											<ResizablePanel
												id="preview-panel"
												defaultSize={50}
												minSize={25}
												order={2}>
												<WebContainerPreview
													templateData={templateData!}
													instance={instance}
													writeFileSync={writeFileSync}
													isLoading={containerLoading}
													error={containerError}
													serverUrl={serverUrl!}
													forceResetup={false}
												/>
											</ResizablePanel>
										</ResizablePanelGroup>
									) : (
										<PlaygroundEditor
											activeFile={activeFile}
											content={activeFile?.content || ""}
											onContentChange={(value) => {
												activeFileId && updateFileContent(activeFileId, value);
											}}
											suggestion={aiSuggestion.suggestion}
											suggestionLoading={aiSuggestion.isLoading}
											suggestionPosition={aiSuggestion.position}
											onAcceptSuggestion={(editor, monaco) =>
												aiSuggestion.acceptSuggestion(editor, monaco)
											}
											onRejectSuggestion={(editor) =>
												aiSuggestion.rejectSuggestion(editor)
											}
											onTriggerSuggestion={(type, editor) =>
												aiSuggestion.fetchSuggestion(type, editor)
											}
											onSave={handleSaveFromEditor}
										/>
									)}
								</div>
							</div>
						) : (
							<div className="flex flex-col h-full items-center justify-center text-muted-foreground gap-4">
								<FileText className="h-16 w-16 text-gray-300" />

								<div className="text-center">
									<p className="text-lg font-medium">No files open</p>

									<p className="text-sm text-gray-500">
										Select a file from the sidebar to start editing
									</p>
								</div>
							</div>
						)}
					</div>
				</SidebarInset>
			</>
		</TooltipProvider>
	);
};

export default MainPlaygroundPage;
