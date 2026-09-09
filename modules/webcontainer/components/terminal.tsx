/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, {
	useEffect,
	useRef,
	useState,
	useCallback,
	forwardRef,
	useImperativeHandle,
} from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { WebLinksAddon } from "xterm-addon-web-links";
import { SearchAddon } from "xterm-addon-search";
import "xterm/css/xterm.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Copy, Trash2, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { WebContainer } from "@webcontainer/api";

function stripEmojis(text: string): string {
	return text
		.replace(/\p{Extended_Pictographic}/gu, "")
		.replace(/\uFE0F/g, "")
		.replace(/\u200D/g, "");
}

interface TerminalProps {
	webcontainerUrl?: string;
	className?: string;
	theme?: "dark" | "light";
	webContainerInstance?: WebContainer;
}

// Define the methods that will be exposed through the ref
export interface TerminalRef {
	writeToTerminal: (data: string) => void;
	clearTerminal: () => void;
	focusTerminal: () => void;
}

const TerminalComponent = forwardRef<TerminalRef, TerminalProps>(
	(
		{ webcontainerUrl, className, theme = "dark", webContainerInstance },
		ref,
	) => {
		const terminalRef = useRef<HTMLDivElement>(null);
		const term = useRef<Terminal | null>(null);
		const fitAddon = useRef<FitAddon | null>(null);
		const searchAddon = useRef<SearchAddon | null>(null);
		const [isConnected, setIsConnected] = useState(false);
		const [searchTerm, setSearchTerm] = useState("");
		const [showSearch, setShowSearch] = useState(false);

		// Command line state
		const currentLine = useRef<string>("");
		const cursorPosition = useRef<number>(0);
		const commandHistory = useRef<string[]>([]);
		const historyIndex = useRef<number>(-1);
		const currentProcess = useRef<any>(null);
		const shellProcess = useRef<any>(null);

		const terminalThemes = {
			dark: {
				background: "#1e1e1e",
				foreground: "#cccccc",
				cursor: "#aeafad",
				cursorAccent: "#000000",
				selection: "#264f78",
				selectionBackground: "#264f78",
				black: "#000000",
				red: "#cd3131",
				green: "#0dbc79",
				yellow: "#e5e510",
				blue: "#2472c8",
				magenta: "#bc3fbc",
				cyan: "#11a8cd",
				white: "#e5e5e5",
				brightBlack: "#666666",
				brightRed: "#f14c4c",
				brightGreen: "#23d18b",
				brightYellow: "#f5f543",
				brightBlue: "#3b8eea",
				brightMagenta: "#d670d6",
				brightCyan: "#29b8db",
				brightWhite: "#e5e5e5",
			},
			light: {
				background: "#ffffff",
				foreground: "#333333",
				cursor: "#333333",
				cursorAccent: "#ffffff",
				selection: "#add6ff",
				selectionBackground: "#add6ff",
				black: "#000000",
				red: "#cd3131",
				green: "#00bc00",
				yellow: "#949800",
				blue: "#0451a5",
				magenta: "#bc05bc",
				cyan: "#0598bc",
				white: "#555555",
				brightBlack: "#666666",
				brightRed: "#cd3131",
				brightGreen: "#14ce14",
				brightYellow: "#b5ba00",
				brightBlue: "#0451a5",
				brightMagenta: "#bc05bc",
				brightCyan: "#0598bc",
				brightWhite: "#a5a5a5",
			},
		};

		const writePrompt = useCallback(() => {
			if (term.current) {
				term.current.write("\r\n$ ");
				currentLine.current = "";
				cursorPosition.current = 0;
			}
		}, []);

		// Expose methods through ref
		useImperativeHandle(ref, () => ({
			writeToTerminal: (data: string) => {
				if (term.current) {
					term.current.write(stripEmojis(data));
				}
			},
			clearTerminal: () => {
				// clearTerminal();
			},
			focusTerminal: () => {
				if (term.current) {
					term.current.focus();
				}
			},
		}));

		const executeCommand = useCallback(
			async (command: string) => {
				if (!webContainerInstance || !term.current) return;

				// Add to history
				if (
					command.trim() &&
					commandHistory.current[commandHistory.current.length - 1] !== command
				) {
					commandHistory.current.push(command);
				}
				historyIndex.current = -1;

				try {
					// Handle built-in commands
					if (command.trim() === "clear") {
						term.current.clear();
						writePrompt();
						return;
					}

					if (command.trim() === "history") {
						commandHistory.current.forEach((cmd, index) => {
							term.current!.writeln(`  ${index + 1}  ${cmd}`);
						});
						writePrompt();
						return;
					}

					if (command.trim() === "") {
						writePrompt();
						return;
					}

					// Parse command
					const parts = command.trim().split(" ");
					const cmd = parts[0];
					const args = parts.slice(1);

					// Execute in WebContainer
					term.current.writeln("");
					const process = await webContainerInstance.spawn(cmd, args, {
						terminal: {
							cols: term.current.cols,
							rows: term.current.rows,
						},
					});

					currentProcess.current = process;

					// Handle process output
					process.output.pipeTo(
						new WritableStream({
							write(data) {
								if (term.current) {
									term.current.write(stripEmojis(data));
								}
							},
						}),
					);

					// Wait for process to complete
					const exitCode = await process.exit;
					currentProcess.current = null;

					// Show new prompt
					writePrompt();
				} catch (error) {
					if (term.current) {
						term.current.writeln(
							`\r\nbash: ${command.split(" ")[0]}: command not found`,
						);
						writePrompt();
					}
					currentProcess.current = null;
				}
			},
			[webContainerInstance, writePrompt],
		);

		const handleTerminalInput = useCallback(
			(data: string) => {
				if (!term.current) return;

				// Handle special characters
				switch (data) {
					case "\r": // Enter
						executeCommand(currentLine.current);
						break;

					case "\u007F": // Backspace
						if (cursorPosition.current > 0) {
							currentLine.current =
								currentLine.current.slice(0, cursorPosition.current - 1) +
								currentLine.current.slice(cursorPosition.current);
							cursorPosition.current--;

							// Update terminal display
							term.current.write("\b \b");
						}
						break;

					case "\u0003": // Ctrl+C
						if (currentProcess.current) {
							currentProcess.current.kill();
							currentProcess.current = null;
						}
						term.current.writeln("^C");
						writePrompt();
						break;

					case "\u001b[A": // Up arrow
						if (commandHistory.current.length > 0) {
							if (historyIndex.current === -1) {
								historyIndex.current = commandHistory.current.length - 1;
							} else if (historyIndex.current > 0) {
								historyIndex.current--;
							}

							// Clear current line and write history command
							const historyCommand =
								commandHistory.current[historyIndex.current];
							term.current.write(
								"\r$ " + " ".repeat(currentLine.current.length) + "\r$ ",
							);
							term.current.write(historyCommand);
							currentLine.current = historyCommand;
							cursorPosition.current = historyCommand.length;
						}
						break;

					case "\u001b[B": // Down arrow
						if (historyIndex.current !== -1) {
							if (historyIndex.current < commandHistory.current.length - 1) {
								historyIndex.current++;
								const historyCommand =
									commandHistory.current[historyIndex.current];
								term.current.write(
									"\r$ " + " ".repeat(currentLine.current.length) + "\r$ ",
								);
								term.current.write(historyCommand);
								currentLine.current = historyCommand;
								cursorPosition.current = historyCommand.length;
							} else {
								historyIndex.current = -1;
								term.current.write(
									"\r$ " + " ".repeat(currentLine.current.length) + "\r$ ",
								);
								currentLine.current = "";
								cursorPosition.current = 0;
							}
						}
						break;

					default:
						// Regular character input
						if (data >= " " || data === "\t") {
							currentLine.current =
								currentLine.current.slice(0, cursorPosition.current) +
								data +
								currentLine.current.slice(cursorPosition.current);
							cursorPosition.current++;
							term.current.write(data);
						}
						break;
				}
			},
			[executeCommand, writePrompt],
		);

		const initializeTerminal = useCallback(() => {
			if (!terminalRef.current || term.current) return;

			const terminal = new Terminal({
				cursorBlink: true,
				cursorStyle: "block",
				fontFamily:
					'Menlo, Monaco, Consolas, "Courier New", "Liberation Mono", monospace',
				fontSize: 13,
				lineHeight: 1.2,
				letterSpacing: 0,
				theme: terminalThemes[theme],
				allowTransparency: false,
				convertEol: true,
				scrollback: 5000,
				tabStopWidth: 8,
				disableStdin: false,
			});

			// Add addons
			const fitAddonInstance = new FitAddon();
			const webLinksAddon = new WebLinksAddon();
			const searchAddonInstance = new SearchAddon();

			terminal.loadAddon(fitAddonInstance);
			terminal.loadAddon(webLinksAddon);
			terminal.loadAddon(searchAddonInstance);

			terminal.open(terminalRef.current);

			fitAddon.current = fitAddonInstance;
			searchAddon.current = searchAddonInstance;
			term.current = terminal;

			// Handle terminal input
			terminal.onData(handleTerminalInput);

			// Initial fit with delay to ensure container is ready
			setTimeout(() => {
				if (terminalRef.current && fitAddonInstance) {
					try {
						// Ensure the element has dimensions before fitting
						const rect = terminalRef.current.getBoundingClientRect();
						if (rect.width > 0 && rect.height > 0) {
							fitAddonInstance.fit();
						} else {
							console.warn("Terminal element has no dimensions, retrying...");
							// Retry after another delay
							setTimeout(() => {
								if (fitAddonInstance && terminalRef.current) {
									const retryRect = terminalRef.current.getBoundingClientRect();
									if (retryRect.width > 0 && retryRect.height > 0) {
										fitAddonInstance.fit();
									} else {
										console.warn(
											"Terminal still has no dimensions, using default size",
										);
										// Set default size as fallback
										terminal.resize(80, 24);
									}
								}
							}, 300);
						}
					} catch (error) {
						console.warn("Terminal fit failed:", error);
						// Set default size as fallback
						terminal.resize(80, 24);
					}
				}
			}, 200);

			return terminal;
		}, [theme, handleTerminalInput]);

		const connectToWebContainer = useCallback(async () => {
			if (!webContainerInstance || !term.current) return;

			try {
				setIsConnected(true);
			} catch (error) {
				setIsConnected(false);
				term.current.writeln(
					"\x1b[31merror: failed to connect to webcontainer\x1b[0m",
				);
				console.error("WebContainer connection error:", error);
			}
		}, [webContainerInstance]);

		const clearTerminal = useCallback(() => {
			if (term.current) {
				term.current.clear();
				term.current.write("$ ");
				currentLine.current = "";
				cursorPosition.current = 0;
			}
		}, []);

		const copyTerminalContent = useCallback(async () => {
			if (term.current) {
				const content = term.current.getSelection();
				if (content) {
					try {
						await navigator.clipboard.writeText(content);
					} catch (error) {
						console.error("Failed to copy to clipboard:", error);
					}
				}
			}
		}, []);

		const downloadTerminalLog = useCallback(() => {
			if (term.current) {
				const buffer = term.current.buffer.active;
				let content = "";

				for (let i = 0; i < buffer.length; i++) {
					const line = buffer.getLine(i);
					if (line) {
						content += line.translateToString(true) + "\n";
					}
				}

				const blob = new Blob([content], { type: "text/plain" });
				const url = URL.createObjectURL(blob);
				const a = document.createElement("a");
				a.href = url;
				a.download = `terminal-log-${new Date().toISOString().slice(0, 19)}.txt`;
				a.click();
				URL.revokeObjectURL(url);
			}
		}, []);

		const searchInTerminal = useCallback((term: string) => {
			if (searchAddon.current && term) {
				searchAddon.current.findNext(term);
			}
		}, []);

		useEffect(() => {
			initializeTerminal();

			// Handle resize
			const resizeObserver = new ResizeObserver(() => {
				if (fitAddon.current) {
					setTimeout(() => {
						fitAddon.current?.fit();
					}, 100);
				}
			});

			if (terminalRef.current) {
				resizeObserver.observe(terminalRef.current);
			}

			return () => {
				resizeObserver.disconnect();
				if (currentProcess.current) {
					currentProcess.current.kill();
				}
				if (shellProcess.current) {
					shellProcess.current.kill();
				}
				if (term.current) {
					term.current.dispose();
					term.current = null;
				}
			};
		}, [initializeTerminal]);

		useEffect(() => {
			if (webContainerInstance && term.current && !isConnected) {
				// eslint-disable-next-line react-hooks/set-state-in-effect
				connectToWebContainer();
			}
		}, [webContainerInstance, connectToWebContainer, isConnected]);

		return (
			<div
				className={cn("flex flex-col h-full overflow-hidden", className)}
				style={{ background: terminalThemes[theme].background }}>
				<div
					className={cn(
						"flex items-center justify-between h-8 px-2 shrink-0 border-b",
						theme === "dark"
							? "bg-[#252526] border-[#3c3c3c] text-[#cccccc]"
							: "bg-[#f3f3f3] border-[#e5e5e5] text-[#333333]",
					)}>
					<div className="flex items-center h-full">
						<span
							className={cn(
								"flex items-center h-full px-3 text-xs tracking-wide uppercase",
								theme === "dark"
									? "border-b-2 border-[#007acc] text-[#cccccc]"
									: "border-b-2 border-[#005fb8] text-[#333333]",
							)}>
							Terminal
						</span>
					</div>

					<div className="flex items-center gap-0.5">
						{showSearch && (
							<Input
								placeholder="Find"
								value={searchTerm}
								onChange={(e) => {
									setSearchTerm(e.target.value);
									searchInTerminal(e.target.value);
								}}
								className="h-6 w-36 text-xs bg-transparent border-[#3c3c3c]"
							/>
						)}

						<Button
							variant="ghost"
							size="sm"
							onClick={() => setShowSearch(!showSearch)}
							className="h-6 w-6 p-0 text-current opacity-70 hover:opacity-100"
							title="Find">
							<Search className="h-3.5 w-3.5" />
						</Button>

						<Button
							variant="ghost"
							size="sm"
							onClick={copyTerminalContent}
							className="h-6 w-6 p-0 text-current opacity-70 hover:opacity-100"
							title="Copy">
							<Copy className="h-3.5 w-3.5" />
						</Button>

						<Button
							variant="ghost"
							size="sm"
							onClick={downloadTerminalLog}
							className="h-6 w-6 p-0 text-current opacity-70 hover:opacity-100"
							title="Download log">
							<Download className="h-3.5 w-3.5" />
						</Button>

						<Button
							variant="ghost"
							size="sm"
							onClick={clearTerminal}
							className="h-6 w-6 p-0 text-current opacity-70 hover:opacity-100"
							title="Clear">
							<Trash2 className="h-3.5 w-3.5" />
						</Button>
					</div>
				</div>

				<div className="flex-1 relative min-h-0">
					<div
						ref={terminalRef}
						className="absolute inset-0 px-2 py-1"
						style={{
							background: terminalThemes[theme].background,
						}}
					/>
				</div>
			</div>
		);
	},
);

TerminalComponent.displayName = "TerminalComponent";

export default TerminalComponent;
