/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useCallback } from "react";

interface AISuggestionState {
	suggestion: string | null;
	isLoading: boolean;
	position: { line: number; column: number } | null;
	decoration: string[];
	isEnabled: boolean;
}

interface UseAISuggestionsReturn extends AISuggestionState {
	toggleEnabled: () => void;
	fetchSuggestion: (type: string, editor: any) => Promise<void>;
	acceptSuggestion: (editor: any, monaco: any) => void;
	rejectSuggestion: (editor: any) => void;
	clearSuggestion: (editor: any) => void;
}

export const useAISuggestions = (): UseAISuggestionsReturn => {
	const [state, setState] = useState<AISuggestionState>({
		suggestion: null,
		isLoading: false,
		position: null,
		decoration: [],
		isEnabled: true,
	});

	const toggleEnabled = useCallback(() => {
		setState((prev) => ({ ...prev, isEnabled: !prev.isEnabled }));
	}, []);

	const fetchSuggestion = useCallback(async (type: string, editor: any) => {
		setState((currentState) => {
			if (!currentState.isEnabled) {
				return currentState;
			}
			if (!editor) {
				return currentState;
			}

			const model = editor.getModel();
			const cursorPosition = editor.getPosition();
			if (!model || !cursorPosition) {
				return currentState;
			}

			const newState = { ...currentState, isLoading: true };

			(async () => {
				try {
					const payload = {
						fileContent: model.getValue(),
						cursorLine: cursorPosition.line - 1,
						cursorColumn: cursorPosition.column - 1,
						suggestionType: type,
					};

					const res = await fetch("/api/code-suggestion", {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
						},
						body: JSON.stringify(payload),
					});
					const data = await res.json();
					if (!res.ok) {
						throw new Error(data.message || "Failed to fetch suggestion");
					}
					if (data.suggestion) {
						const suggestionText = data.suggestion.trim();
						setState((prev) => ({
							...prev,
							suggestion: suggestionText,
							position: {
								line: cursorPosition.lineNumber,
								column: cursorPosition.column,
							},
							isLoading: false,
						}));
					} else {
						setState((prev) => ({
							...prev,
							isLoading: false,
						}));
					}
				} catch (error) {
					console.error("No suggestion recieved from AI: ", error);

					setState((prev) => ({
						...prev,
						isLoading: false,
					}));
				}
			})();

			return newState;
		});
	}, []);

	const acceptSuggestion = useCallback(() => {
		(editor: any, monaco: any) => {
			setState((currentState) => {
				if (
					!currentState.suggestion ||
					!currentState.position ||
					!editor ||
					!monaco
				) {
					return currentState;
				}
				const { line, column } = currentState.position;

				const sanitizedSuggestion = currentState.suggestion.replace(
					/^\d+:s*/gm,
					"",
				);

				editor.executeEdits("", [
					{
						range: new monaco.Range(line, column, line, column),
						text: sanitizedSuggestion,
						forceMoveMarkers: true,
					},
				]);

				if (editor && currentState.decoration.length > 0) {
					editor.deltaDecorations(currentState.decoration, []);
				}

				return {
					...currentState,
					suggestion: null,
					positon: null,
					decoration: [],
				};
			});
		};
	}, []);

	const rejectSuggestion = useCallback((editor: any) => {
		setState((currentState) => {
			if (editor && currentState.decoration.length > 0) {
				editor.deltaDecorations(currentState.decoration, []);
			}

			return {
				...currentState,
				suggestion: null,
				positon: null,
				decoration: [],
			};
		});
	}, []);

	const clearSuggestion = useCallback((editor: any) => {
		setState((currentState) => {
			if (editor && currentState.decoration.length > 0) {
				editor.deltaDecorations(currentState.decoration, []);
			}

			return {
				...currentState,
				suggestion: null,
				positon: null,
				decoration: [],
			};
		});
	}, []);

	return {
		...state,
		toggleEnabled,
		fetchSuggestion,
		acceptSuggestion,
		rejectSuggestion,
		clearSuggestion,
	};
};
