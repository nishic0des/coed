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

interface NewFolderDialogProps {
	isOpen: boolean;
	onClose: () => void;
	onCreateFolder: (folderName: string) => void;
}

export default function NewFolderDialog({
	isOpen,
	onClose,
	onCreateFolder,
}: NewFolderDialogProps) {
	const [folderName, setFoldername] = React.useState("");

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (folderName.trim()) {
			onCreateFolder(folderName.trim());
			setFoldername("");
		}
	};

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Create New Folder</DialogTitle>
					<DialogDescription>
						Enter the name for the new folder.
					</DialogDescription>
				</DialogHeader>
				<Label htmlFor="folderName">Folder Name</Label>
				<Input
					id="folderName"
					value={folderName}
					onChange={(e) => setFoldername(e.target.value)}
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
