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

interface NewFileDialogProps {
	isOpen: boolean;
	onClose: () => void;
	onCreateFile: (filename: string, extension: string) => void;
}

export default function NewFileDialog({
	isOpen,
	onClose,
	onCreateFile,
}: NewFileDialogProps) {
	const [filename, setFilename] = React.useState("");
	const [extension, setExtension] = React.useState("js");

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (filename.trim()) {
			onCreateFile(filename.trim(), extension.trim() || "js");
			setFilename("");
			setExtension("js");
		}
	};

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Create New File</DialogTitle>
					<DialogDescription>
						Enter the name and extension for the new file.
					</DialogDescription>
				</DialogHeader>
				<Label htmlFor="filename">Filename</Label>
				<Input
					id="filename"
					value={filename}
					onChange={(e) => setFilename(e.target.value)}
				/>
				<Label htmlFor="extension">Extension</Label>
				<Input
					id="extension"
					value={extension}
					onChange={(e) => setExtension(e.target.value)}
				/>
				<DialogFooter>
					<Button variant="outline" onClick={onClose}>
						Cancel
					</Button>
					<Button onClick={handleSubmit}>Create</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
