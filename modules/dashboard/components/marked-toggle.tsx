import React from "react";
import { Button } from "@/components/ui/button";
import { StarIcon, StarOffIcon } from "lucide-react";
import { useState, useEffect, forwardRef } from "react";
import { toast } from "sonner";
import { toggleStarMarked } from "../actions";

interface MarkedButtonToggleProps
	extends React.ComponentPropsWithoutRef<typeof Button> {
	markedForRevision?: boolean;
	id: string;
	onMarkAsFavourite?: (id: string) => Promise<void>;
}

const MarkedToggleButton = forwardRef<
	HTMLButtonElement,
	MarkedButtonToggleProps
>(
	(
		{
			markedForRevision,
			id,
			onClick,
			className,
			children,
			onMarkAsFavourite,
			...props
		},
		ref
	) => {
		const [isMarked, setIsMarked] = useState(markedForRevision ?? false);

		useEffect(() => {
			setIsMarked(!!markedForRevision);
		}, [markedForRevision]);

		const handleToggle = async (event: React.MouseEvent<HTMLButtonElement>) => {
			onClick?.(event);

			const newMarkedState = !isMarked;
			const previousState = isMarked;
			setIsMarked(newMarkedState);
			try {
				const res = await toggleStarMarked(id, newMarkedState);
				if (!res.success) {
					throw new Error(`Failed to toggle star mark: ${res.error}`);
				}
				if (onMarkAsFavourite) {
					await onMarkAsFavourite(id);
				}
				toast.success(
					newMarkedState
						? "Added to favorites successfully"
						: "Removed from favorites successfully"
				);
			} catch (error) {
				console.error("Failed to toggle mark for revision: ", error);
				// Revert to previous state on error
				setIsMarked(previousState);
				toast.error("Failed to update favorite status");
			}
		};
		return (
			<Button
				ref={ref}
				variant="ghost"
				className={`flex items-center justify-start w-full px-2 py-1.5 text-sm rounded-md cursor-pointer ${className}`}
				onClick={handleToggle}
				{...props}>
				{isMarked ? (
					<StarIcon size={16} className="text-red-500 mr-2" />
				) : (
					<StarOffIcon size={16} className="text-gray-500 mr-2" />
				)}
				{children || (isMarked ? "Remove favourite" : "Mark as favourite")}
			</Button>
		);
	}
);

MarkedToggleButton.displayName = "MarkedToggleButton";
export default MarkedToggleButton;
