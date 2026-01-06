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

interface RenamefolderDialogProps {
	isOpen: boolean;
	onClose: () => void;
	onRename: (foldername: string) => void;
	currentfoldername: string;
}

export default function RenameFolderDialog({
	isOpen,
	onClose,
	onRename,
	currentfoldername,
}: RenamefolderDialogProps) {
	const [foldername, setfoldername] = React.useState(currentfoldername);

	const handleSubmit = () => {
		if (foldername.trim()) {
			onRename(foldername.trim());
			onClose();
		}
	};

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Rename folder</DialogTitle>
					<DialogDescription>
						Enter the new name for the folder.
					</DialogDescription>
				</DialogHeader>
				<Label htmlFor="foldername">foldername</Label>
				<Input
					id="foldername"
					value={foldername}
					onChange={(e) => setfoldername(e.target.value)}
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
