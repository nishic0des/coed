"use client";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import React from "react";

interface RenameFileDialogProps {
	isOpen: boolean;
	onClose: () => void;
	onRename: (filename: string, extension: string) => void;
	currentFilename: string;
	currentFileExtension: string;
}

export default function RenameFileDialog({
	isOpen,
	onClose,
	onRename,
	currentFilename,
	currentFileExtension,
}: RenameFileDialogProps) {
	const [filename, setFilename] = React.useState(currentFilename);
	const [fileExtension, setFileExtension] =
		React.useState(currentFileExtension);

	const handleSubmit = () => {
		if (filename.trim()) {
			onRename(filename.trim(), fileExtension.trim() || currentFileExtension);
			onClose();
		}
	};

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Rename File</DialogTitle>
					<DialogDescription>
						Enter the new name for the file.
					</DialogDescription>
				</DialogHeader>
				<Label htmlFor="filename">Filename</Label>
				<Input
					id="filename"
					value={filename}
					onChange={(e) => setFilename(e.target.value)}
				/>
				<Label htmlFor="fileExtension">File Extension</Label>
				<Input
					id="fileExtension"
					value={fileExtension}
					onChange={(e) => setFileExtension(e.target.value)}
				/>
				<DialogFooter>
					<Button variant="outline" onClick={onClose}>
						Cancel
					</Button>
					<Button onClick={handleSubmit}>Rename</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
