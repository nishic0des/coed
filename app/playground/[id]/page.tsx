/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { Separator } from "@/components/ui/separator";

import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";

import { usePlayground } from "@/modules/playground/hooks/usePlayground";

import { TooltipProvider } from "@radix-ui/react-tooltip";

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

const MainPlaygroundPage = () => {
	const { id } = useParams<{ id: string }>();

	const { playgroundData, templateData, isLoading, error, saveTemplateData } =
		usePlayground(id);

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

	useEffect(() => {
		console.log("🔍 isPreviewVisible:", isPreviewVisible);

		console.log("🔍 instance:", instance);

		console.log("🔍 containerLoading:", containerLoading);

		console.log("🔍 containerError:", containerError);

		if (!isPreviewVisible) return;
	}, [isPreviewVisible, instance, containerLoading, containerError]);

	const handleFileSelect = (file: TemplateFile) => {
		openFile(file);
	};

	const handleSave = useCallback(
		// eslint-disable-next-line react-hooks/preserve-manual-memoization
		async (fileId?: string) => {
			const targetedFileId = fileId || activeFileId;
			if (!targetedFileId) return;

			const fileToSave = openFiles.find((f) => f.id === targetedFileId);

			if (!fileToSave) return;

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
				const updateFileContent = (items: any[]): any[] =>
					items.map((item) => {
						if ("folderName" in item) {
							return { ...item, items: updateFileContent(item.items) };
						} else if (
							item.filename === fileToSave.filename &&
							item.fileExtension === fileToSave.fileExtension
						) {
							return { ...item, content: fileToSave.content };
						}
						return item;
					});
				updatedTemplateData.items = updateFileContent(
					updatedTemplateData.items,
				);

				await writeFileSync(filePath, fileToSave.content);
				lastSynedContent.current.set(fileToSave.id, fileToSave.content);
				if (instance && instance.fs) {
					await instance.fs.writeFile(filePath, fileToSave.content);
				}

				const newTemplateData = await saveTemplateData(updatedTemplateData);
				setTemplateData(updatedTemplateData);

				const updatedOpenFiles = openFiles.map((f) =>
					f.id === targetedFileId
						? {
								...f,
								content: fileToSave.content,
								originalContent: fileToSave.content,
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
		],
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
								<Tooltip>
									<TooltipTrigger>
										<Button
											size="sm"
											variant="outline"
											onClick={() => handleSave()}
											disabled={!activeFile || activeFile.hasUnsavedChanges}>
											<Save className="h-4 w-4" />
										</Button>
									</TooltipTrigger>

									<TooltipContent>Save (Ctril+S)</TooltipContent>
								</Tooltip>

								<Tooltip>
									<TooltipTrigger>
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
									<ResizablePanelGroup
										direction="horizontal"
										className="h-full">
										<ResizablePanel defaultSize={isPreviewVisible ? 50 : 100}>
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
											/>
										</ResizablePanel>

										{isPreviewVisible && instance && (
											<>
												<ResizableHandle />

												<ResizablePanel defaultSize={50}>
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
											</>
										)}
									</ResizablePanelGroup>
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
