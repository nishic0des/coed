/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import React, { useEffect, useState, useRef } from "react";

import { transformToWebContainerFormat } from "../hooks/transformer";
import { CheckCircle, Loader2, XCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";

import { WebContainer } from "@webcontainer/api";
import { TemplateFolder } from "@/modules/playground/lib/path-to-json";
import TerminalComponent from "./terminal";

interface WebContainerPreviewProps {
	templateData: TemplateFolder;
	serverUrl: string;
	isLoading: boolean;
	error: string | null;
	instance: WebContainer | null;
	writeFileSync: (path: string, content: string) => Promise<void>;
	forceResetup: boolean;
	onServerReady?: (url: string) => void;
}
const WebContainerPreview = ({
	templateData,
	serverUrl,
	error,
	instance,
	isLoading,
	writeFileSync,
	forceResetup = false,
	onServerReady,
}: WebContainerPreviewProps) => {
	console.log("🎯 WebContainerPreview props:", {
		templateData: !!templateData,
		serverUrl,
		error,
		instance: !!instance,
		isLoading,
		forceResetup,
	});

	const [previewUrl, setPreviewUrl] = useState<string>("");
	const [loadingState, setLoadingState] = useState({
		transforming: false,
		mounting: false,
		installing: false,
		starting: false,
		ready: false,
	});
	const [currentStep, setCurrentStep] = useState(0);
	const totalSteps = 4;
	const [setupError, setSetupError] = useState<string | null>(null);
	const [isSetupComplete, setIsSetupComplete] = useState(false);
	const [isSetupInProgress, setIsSetupInProgress] = useState(false);

	const terminalRef = useRef<any>(null);

	// Reset setup state when forceResetup changes
	useEffect(() => {
		if (forceResetup) {
			setIsSetupComplete(false);
			setIsSetupInProgress(false);
			setPreviewUrl("");
			setCurrentStep(0);
			setLoadingState({
				transforming: false,
				mounting: false,
				installing: false,
				starting: false,
				ready: false,
			});
		}
	}, [forceResetup]);

	// Reset setup state when templateData changes significantly
	useEffect(() => {
		if (templateData && templateData.items && templateData.items.length > 0) {
			setIsSetupComplete(false);
			setIsSetupInProgress(false);
		}
	}, [templateData?.items?.length, templateData]);

	useEffect(() => {
		async function setupContainer() {
			console.log("🔧 setupContainer called:", {
				instance: !!instance,
				isSetupComplete,
				isSetupInProgress,
			});

			if (!instance || isSetupComplete || isSetupInProgress) return;

			console.log("🚀 Starting WebContainer setup...");
			try {
				setIsSetupInProgress(true);
				setSetupError(null);

				try {
					const packageJsonExists = await instance.fs.readFile(
						"package.json",
						"utf8",
					);
					console.log(
						"📦 package.json found:",
						packageJsonExists.substring(0, 100) + "...",
					);

					if (packageJsonExists) {
						// Files are already mounted, just reconnect to existing server
						if (terminalRef.current?.writeToTerminal) {
							terminalRef.current.writeToTerminal(
								"🔄 Reconnecting to existing WebContainer session...\r\n",
							);
						}

						instance.on("server-ready", (port: number, url: string) => {
							if (terminalRef.current?.writeToTerminal) {
								terminalRef.current.writeToTerminal(
									`🌐 Reconnected to server at ${url}\r\n`,
								);
							}

							setPreviewUrl(url);
							setLoadingState((prev) => ({
								...prev,
								starting: false,
								ready: true,
							}));
						});

						setCurrentStep(4);
						setLoadingState((prev) => ({ ...prev, starting: true }));
						return;
					}
				} catch (error) {}

				// Step-1 transform data
				setLoadingState((prev) => ({ ...prev, transforming: true }));
				setCurrentStep(1);
				// Write to terminal
				if (terminalRef.current?.writeToTerminal) {
					terminalRef.current.writeToTerminal(
						"🔄 Transforming template data...\r\n",
					);
				}

				// eslint-disable-next-line @typescript-eslint/ban-ts-comment
				// @ts-ignore
				const files = transformToWebContainerFormat(templateData);
				setLoadingState((prev) => ({
					...prev,
					transforming: false,
					mounting: true,
				}));
				setCurrentStep(2);

				//  Step-2 Mount Files

				if (terminalRef.current?.writeToTerminal) {
					terminalRef.current.writeToTerminal(
						"📁 Mounting files to WebContainer...\r\n",
					);
				}
				await instance.mount(files);

				if (terminalRef.current?.writeToTerminal) {
					terminalRef.current.writeToTerminal(
						"✅ Files mounted successfully\r\n",
					);
				}
				setLoadingState((prev) => ({
					...prev,
					mounting: false,
					installing: true,
				}));
				setCurrentStep(3);

				// Step-3 Install dependencies

				if (terminalRef.current?.writeToTerminal) {
					terminalRef.current.writeToTerminal(
						"📦 Installing dependencies...\r\n",
					);
				}

				const installProcess = await instance.spawn("npm", ["install"]);
				console.log("📦 npm install started");

				installProcess.output.pipeTo(
					new WritableStream({
						write(data) {
							if (terminalRef.current?.writeToTerminal) {
								terminalRef.current.writeToTerminal(data);
							}
						},
					}),
				);

				const installExitCode = await installProcess.exit;

				if (installExitCode !== 0) {
					throw new Error(
						`Failed to install dependencies. Exit code: ${installExitCode}`,
					);
				}

				if (terminalRef.current?.writeToTerminal) {
					terminalRef.current.writeToTerminal(
						"✅ Dependencies installed successfully\r\n",
					);
				}

				setLoadingState((prev) => ({
					...prev,
					installing: false,
					starting: true,
				}));
				setCurrentStep(4);

				// STEP-4 Start The Server

				if (terminalRef.current?.writeToTerminal) {
					terminalRef.current.writeToTerminal(
						"🚀 Starting development server...\r\n",
					);
				}

				const startProcess = await instance.spawn("npm", ["run", "start"]);
				console.log("🚀 npm run start started");

				instance.on("server-ready", (port: number, url: string) => {
					console.log("🌐 Server-ready event received:", { port, url });
					if (terminalRef.current?.writeToTerminal) {
						terminalRef.current.writeToTerminal(
							`🌐 Server ready at ${url}\r\n`,
						);
					}
					setPreviewUrl(url);
					setLoadingState((prev) => ({
						...prev,
						starting: false,
						ready: true,
					}));
					setIsSetupComplete(true);
					setIsSetupInProgress(false);

					// Notify parent component
					if (onServerReady) {
						console.log("📞 Calling onServerReady with:", url);
						onServerReady(url);
					}
				});

				// Handle start process output - stream to terminal
				startProcess.output.pipeTo(
					new WritableStream({
						write(data) {
							if (terminalRef.current?.writeToTerminal) {
								terminalRef.current.writeToTerminal(data);
							}
						},
					}),
				);
			} catch (err) {
				console.error("Error setting up container:", err);
				const errorMessage = err instanceof Error ? err.message : String(err);
				if (terminalRef.current?.writeToTerminal) {
					terminalRef.current.writeToTerminal(`❌ Error: ${errorMessage}\r\n`);
				}
				setSetupError(errorMessage);
				setIsSetupInProgress(false);
				setLoadingState({
					transforming: false,
					mounting: false,
					installing: false,
					starting: false,
					ready: false,
				});
			}
		}

		setupContainer();
	}, [
		instance,
		templateData,
		isSetupComplete,
		isSetupInProgress,
		onServerReady,
	]);

	useEffect(() => {
		return () => {};
	}, []);

	if (isLoading) {
		return (
			<div className="h-full flex items-center justify-center">
				<div className="text-center space-y-4 max-w-md p-6 rounded-lg bg-gray-50 dark:bg-gray-900">
					<Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
					<h3 className="text-lg font-medium">Initializing WebContainer</h3>
					<p className="text-sm text-gray-500 dark:text-gray-400">
						Setting up the environment for your project...
					</p>
				</div>
			</div>
		);
	}

	if (error || setupError) {
		return (
			<div className="h-full flex items-center justify-center">
				<div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-6 rounded-lg max-w-md">
					<div className="flex items-center gap-2 mb-3">
						<XCircle className="h-5 w-5" />
						<h3 className="font-semibold">Error</h3>
					</div>
					<p className="text-sm">{error || setupError}</p>
				</div>
			</div>
		);
	}
	const getStepIcon = (stepIndex: number) => {
		if (stepIndex < currentStep) {
			return <CheckCircle className="h-5 w-5 text-green-500" />;
		} else if (stepIndex === currentStep) {
			return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
		} else {
			return <div className="h-5 w-5 rounded-full border-2 border-gray-300" />;
		}
	};

	const getStepText = (stepIndex: number, label: string) => {
		const isActive = stepIndex === currentStep;
		const isComplete = stepIndex < currentStep;

		return (
			<span
				className={`text-sm font-medium ${
					isComplete
						? "text-green-600"
						: isActive
							? "text-blue-600"
							: "text-gray-500"
				}`}>
				{label}
			</span>
		);
	};

	console.log("🎬 WebContainerPreview render:", {
		serverUrl: !!serverUrl,
		serverUrlValue: serverUrl,
		shouldShowPreview: !!serverUrl,
	});

	return (
		<div
			className="h-full w-full flex flex-col"
			style={{ minHeight: "400px", backgroundColor: "#f0f0f0" }}>
			{!serverUrl ? (
				<div className="h-full flex flex-col">
					<div className="w-full max-w-md p-6 m-5 rounded-lg bg-white dark:bg-zinc-800 shadow-sm mx-auto">
						<Progress
							value={(currentStep / totalSteps) * 100}
							className="h-2 mb-6"
						/>

						<div className="space-y-4 mb-6">
							<div className="flex items-center gap-3">
								{getStepIcon(1)}
								{getStepText(1, "Transforming template data")}
							</div>
							<div className="flex items-center gap-3">
								{getStepIcon(2)}
								{getStepText(2, "Mounting files")}
							</div>
							<div className="flex items-center gap-3">
								{getStepIcon(3)}
								{getStepText(3, "Installing dependencies")}
							</div>
							<div className="flex items-center gap-3">
								{getStepIcon(4)}
								{getStepText(4, "Starting development server")}
							</div>
						</div>
					</div>

					{/* Terminal */}
					<div className="flex-1 p-4">
						<TerminalComponent
							ref={terminalRef}
							webContainerInstance={instance!}
							theme="dark"
							className="h-full"
						/>
					</div>
				</div>
			) : (
				<>
					<div className="flex-1 bg-red-100" style={{ minHeight: "200px" }}>
						<div className="p-2 text-center">
							<div className="text-sm font-mono bg-green-500 text-white p-2 rounded">
								🌐 PREVIEW LOADING
							</div>
							<div className="mt-2 text-xs">URL: {serverUrl}</div>
						</div>
						<iframe
							src={serverUrl}
							className="w-full h-full border-none"
							title="WebContainer Preview"
							style={{ minHeight: "300px" }}
						/>
					</div>

					<div
						className="h-64 border-t bg-blue-100"
						style={{ minHeight: "200px" }}>
						<div className="p-2 text-center text-xs">🖥️ TERMINAL</div>
						<TerminalComponent
							ref={terminalRef}
							webContainerInstance={instance!}
							theme="dark"
							className="h-full"
						/>
					</div>
				</>
			)}
		</div>
	);
};

export default WebContainerPreview;
