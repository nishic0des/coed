"use client";

import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { usePlayground } from "@/modules/playground/hooks/usePlayground";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { useParams } from "next/navigation";
import React, { useEffect, useState } from "react";
import { TemplateFileTree } from "@/modules/playground/components/playground-explorer";
import { TemplateFile } from "@/modules/playground/lib/path-to-json";
import { useFileExplorer } from "@/modules/playground/hooks/useFileExplorer";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Bot, FileText, Save, Settings, X } from "lucide-react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList } from "@/components/ui/tabs";
import { TabsTrigger } from "@radix-ui/react-tabs";
import { ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import PlaygroundEditor from "@/modules/playground/components/playground-editor";

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
	} = useFileExplorer();

	useEffect(() => {
		setPlaygroudId(id);
	}, [id, setPlaygroudId]);

	useEffect(() => {
		setTemplateData(templateData);
	}, [templateData, setTemplateData, openFiles.length]);

	const activeFile = openFiles.find((f) => f.id === activeFileId);
	const hasUnsavedChanges = openFiles.some((file) => file.hasUnsavedChanges);

	const handleFileSelect = (file: TemplateFile) => {
		openFile(file);
	};
	const [isPreviewVisible, setIsPreviewVisible] = useState(false);

	return (
		<TooltipProvider>
			<>
				<TemplateFileTree
					data={templateData!}
					onFileSelect={handleFileSelect}
					selectedFile={activeFile}
					title="File Explorer"
					onAddFile={() => {}}
					onAddFolder={() => {}}
					onDeleteFile={() => {}}
					onDeleteFolder={() => {}}
					onRenameFile={() => {}}
					onRenameFolder={() => {}}
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
											onClick={() => {}}
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
											onClick={() => {}}
											disabled={!hasUnsavedChanges}>
											<Save className="h-4 w-4" /> All
										</Button>
									</TooltipTrigger>
									<TooltipContent>Save All (Ctrl+Shift+S)</TooltipContent>
								</Tooltip>
								<Button variant={"default"} size={"icon"}>
									<Bot className="size-4" />
								</Button>

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
												onContentChange={() => {}}
											/>
										</ResizablePanel>
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
