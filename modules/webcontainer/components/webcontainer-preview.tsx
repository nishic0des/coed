/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import React, { useEffect, useState, useRef } from "react";

import { transformToWebContainerFormat } from "../hooks/transformer";
import { CheckCircle, Loader2, XCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";

import { WebContainer } from "@webcontainer/api";
import { TemplateFolder } from "@/modules/playground/lib/path-to-json";
import TerminalComponent from "./terminal";
import {
	getCachedPreviewUrl,
	getDevProcess,
	isWebContainerSetupComplete,
	setCachedPreviewUrl,
	setDevProcess,
	setWebContainerSetupComplete,
} from "../lib/webcontainer-singleton";

interface WebContainerPreviewProps {
	templateData: TemplateFolder;
	serverUrl: string;
	isLoading: boolean;
	error: string | null;
	instance: WebContainer | null;
	writeFileSync: (path: string, content: string) => Promise<void>;
	forceResetup?: boolean;
	onServerReady?: (url: string) => void;
}

const WebContainerPreview = ({
	templateData,
	error,
	instance,
	isLoading,
	forceResetup = false,
	onServerReady,
}: WebContainerPreviewProps) => {
	const cachedUrl = getCachedPreviewUrl();
	const [previewUrl, setPreviewUrl] = useState<string>(cachedUrl ?? "");
	const [loadingState, setLoadingState] = useState({
		transforming: false,
		mounting: false,
		installing: false,
		starting: false,
		ready: Boolean(cachedUrl),
	});
	const [currentStep, setCurrentStep] = useState(cachedUrl ? 4 : 0);
	const totalSteps = 4;
	const [setupError, setSetupError] = useState<string | null>(null);
	const [isSetupComplete, setIsSetupComplete] = useState(
		isWebContainerSetupComplete() || Boolean(cachedUrl),
	);
	const [isSetupInProgress, setIsSetupInProgress] = useState(false);

	const terminalRef = useRef<any>(null);
	const setupInitiatedRef = useRef(isWebContainerSetupComplete());
	const templateDataRef = useRef(templateData);
	const onServerReadyRef = useRef(onServerReady);

	useEffect(() => {
		templateDataRef.current = templateData;
	}, [templateData]);

	useEffect(() => {
		onServerReadyRef.current = onServerReady;
	}, [onServerReady]);

	useEffect(() => {
		if (forceResetup) {
			setIsSetupComplete(false);
			setIsSetupInProgress(false);
			setPreviewUrl("");
			setCachedPreviewUrl(null);
			setWebContainerSetupComplete(false);
			setCurrentStep(0);
			setLoadingState({
				transforming: false,
				mounting: false,
				installing: false,
				starting: false,
				ready: false,
			});
			setupInitiatedRef.current = false;
		}
	}, [forceResetup]);

	useEffect(() => {
		async function setupContainer() {
			if (
				!instance ||
				isSetupComplete ||
				isSetupInProgress ||
				setupInitiatedRef.current
			) {
				return;
			}

			setupInitiatedRef.current = true;

			try {
				setIsSetupInProgress(true);
				setSetupError(null);

				// Already mounted from a previous session — reuse without reinstalling
				try {
					await instance.fs.readFile("package.json", "utf8");
					const existingUrl = getCachedPreviewUrl();
					if (existingUrl && getDevProcess()) {
						setPreviewUrl(existingUrl);
						setLoadingState((prev) => ({
							...prev,
							starting: false,
							ready: true,
						}));
						setCurrentStep(4);
						setIsSetupComplete(true);
						setWebContainerSetupComplete(true);
						setIsSetupInProgress(false);
						onServerReadyRef.current?.(existingUrl);
						return;
					}
				} catch {
					// package.json not mounted yet — continue with full setup
				}

				setLoadingState((prev) => ({ ...prev, transforming: true }));
				setCurrentStep(1);
				terminalRef.current?.writeToTerminal?.(
					"🔄 Transforming template data...\r\n",
				);

				// eslint-disable-next-line @typescript-eslint/ban-ts-comment
				// @ts-ignore
				const files = transformToWebContainerFormat(templateDataRef.current);
				setLoadingState((prev) => ({
					...prev,
					transforming: false,
					mounting: true,
				}));
				setCurrentStep(2);

				terminalRef.current?.writeToTerminal?.(
					"📁 Mounting files to WebContainer...\r\n",
				);
				await instance.mount(files);
				terminalRef.current?.writeToTerminal?.(
					"✅ Files mounted successfully\r\n",
				);

				setLoadingState((prev) => ({
					...prev,
					mounting: false,
					installing: true,
				}));
				setCurrentStep(3);

				terminalRef.current?.writeToTerminal?.(
					"📦 Installing dependencies...\r\n",
				);
				const installProcess = await instance.spawn("npm", ["install"]);
				installProcess.output.pipeTo(
					new WritableStream({
						write(data) {
							terminalRef.current?.writeToTerminal?.(data);
						},
					}),
				);

				const installExitCode = await installProcess.exit;
				if (installExitCode !== 0) {
					throw new Error(
						`Failed to install dependencies. Exit code: ${installExitCode}`,
					);
				}

				terminalRef.current?.writeToTerminal?.(
					"✅ Dependencies installed successfully\r\n",
				);

				setLoadingState((prev) => ({
					...prev,
					installing: false,
					starting: true,
				}));
				setCurrentStep(4);

				terminalRef.current?.writeToTerminal?.(
					"🚀 Starting development server...\r\n",
				);

				// Never spawn a second server — that kills the port and flashes errors
				if (!getDevProcess()) {
					const pkgRaw = await instance.fs.readFile("package.json", "utf8");
					const pkg = JSON.parse(pkgRaw) as {
						scripts?: Record<string, string>;
					};
					const script = ["dev", "start", "serve"].find(
						(name) => pkg.scripts?.[name],
					);
					if (!script) {
						throw new Error(
							"No startable script found (expected dev, start, or serve)",
						);
					}

					const startProcess = await instance.spawn("npm", ["run", script]);
					setDevProcess(startProcess);

					startProcess.exit.then(() => {
						// Clear so a future intentional reset can start again
						if (getDevProcess() === startProcess) {
							setDevProcess(null);
						}
					});

					startProcess.output.pipeTo(
						new WritableStream({
							write(data) {
								terminalRef.current?.writeToTerminal?.(data);
							},
						}),
					);
				}

				instance.on("server-ready", (_port: number, url: string) => {
					terminalRef.current?.writeToTerminal?.(
						`🌐 Server ready at ${url}\r\n`,
					);
					setPreviewUrl(url);
					setCachedPreviewUrl(url);
					setLoadingState((prev) => ({
						...prev,
						starting: false,
						ready: true,
					}));
					setIsSetupComplete(true);
					setWebContainerSetupComplete(true);
					setIsSetupInProgress(false);
					onServerReadyRef.current?.(url);
				});
			} catch (err) {
				console.error("Error setting up container:", err);
				const errorMessage = err instanceof Error ? err.message : String(err);
				terminalRef.current?.writeToTerminal?.(`❌ Error: ${errorMessage}\r\n`);
				setSetupError(errorMessage);
				setIsSetupInProgress(false);
				setupInitiatedRef.current = false;
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
		// Intentionally omit templateData — file saves must not re-run setup
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [instance, isSetupComplete, isSetupInProgress]);

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
		}
		if (stepIndex === currentStep) {
			return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
		}
		return <div className="h-5 w-5 rounded-full border-2 border-gray-300" />;
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

	return (
		<div
			className="h-full w-full flex flex-col"
			style={{ minHeight: "400px", backgroundColor: "#f0f0f0" }}>
			<div className="flex-1 flex flex-col min-h-0">
				{!previewUrl ? (
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
				) : (
					<div className="flex-1 bg-gray-900" style={{ minHeight: "200px" }}>
						<iframe
							src={previewUrl}
							className="w-full h-full border-none"
							title="WebContainer Preview"
							style={{ minHeight: "300px" }}
						/>
					</div>
				)}
			</div>

			{/* Keep a single terminal mounted so cleanup never kills sibling processes */}
			<div
				className="h-64 border-t bg-zinc-950 shrink-0"
				style={{ minHeight: "200px" }}>
				<div className="p-2 text-center text-xs text-zinc-400">TERMINAL</div>
				<TerminalComponent
					ref={terminalRef}
					webContainerInstance={instance!}
					theme="dark"
					className="h-full"
				/>
			</div>
		</div>
	);
};

export default WebContainerPreview;
