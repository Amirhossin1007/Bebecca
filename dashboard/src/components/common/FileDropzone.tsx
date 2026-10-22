import { createElement } from "react";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import { Upload, FileText } from "lucide-react";

import { cn } from "lib/cn";
import {
	type ChangeEvent,
	type DragEvent,
	type KeyboardEvent,
	type ReactNode,
	useEffect,
	useRef,
	useState,
} from "react";

type FileDropzoneProps = {
	accept?: string;
	description?: ReactNode;
	emptyText: ReactNode;
	disabled?: boolean;
	multiple?: boolean;
	onFileSelect?: (file: File | null) => void;
	onFilesSelect?: (files: File[]) => void;
	selectedFiles?: File[];
	selectedFile?: File | null;
	title: ReactNode;
};

const formatFileSize = (size: number) => {
	if (!Number.isFinite(size) || size <= 0) {
		return "0 B";
	}
	const units = ["B", "KB", "MB", "GB"];
	let value = size;
	let unitIndex = 0;
	while (value >= 1024 && unitIndex < units.length - 1) {
		value /= 1024;
		unitIndex += 1;
	}
	return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
};

export const FileDropzone = ({
	accept,
	description,
	emptyText,
	disabled: isDisabled,
	multiple = false,
	onFileSelect,
	onFilesSelect,
	selectedFile,
	selectedFiles,
	title,
}: FileDropzoneProps) => {
	const inputRef = useRef<HTMLInputElement | null>(null);
	const [isDragging, setIsDragging] = useState(false);
		const tone = isDragging ? "border-primary-500! bg-primary-50 dark:border-primary-300! dark:bg-whiteAlpha-100" : "border-blackAlpha-300! bg-blackAlpha-50 dark:border-whiteAlpha-300! dark:bg-whiteAlpha-50";
		const hoverTone = "hover:border-primary-500! hover:bg-primary-50 dark:hover:border-primary-300! dark:hover:bg-whiteAlpha-100";
		const iconBorder = isDragging ? "border-primary-500! dark:border-primary-300!" : "border-blackAlpha-300! dark:border-whiteAlpha-300!";
		const iconBg = "bg-white dark:bg-whiteAlpha-100";
		const mutedColor = "text-gray-500 dark:text-gray-400";

	const hasSelection = selectedFiles
		? selectedFiles.length > 0
		: Boolean(selectedFile);

	useEffect(() => {
		if (!hasSelection && inputRef.current) {
			inputRef.current.value = "";
		}
	}, [hasSelection]);

	const selectFile = (fileList: FileList | null) => {
		if (multiple) {
			const files = Array.from(fileList ?? []);
			if (inputRef.current) {
				inputRef.current.value = "";
			}
			onFilesSelect?.(files);
			return;
		}
		onFileSelect?.(fileList?.[0] ?? null);
	};

	const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
		selectFile(event.target.files);
	};

	const handleDrop = (event: DragEvent<HTMLDivElement>) => {
		event.preventDefault();
		setIsDragging(false);
		if (isDisabled) {
			return;
		}
		selectFile(event.dataTransfer.files);
	};

	const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
		event.preventDefault();
		if (!isDisabled) {
			setIsDragging(true);
		}
	};

	const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
		if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
			return;
		}
		setIsDragging(false);
	};

	const openFileDialog = () => {
		if (!isDisabled) {
			inputRef.current?.click();
		}
	};

	const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			openFileDialog();
		}
	};

	return (
		// biome-ignore lint/a11y/useSemanticElements: the drop zone holds block content; keyboard activation is handled in onKeyDown
		<div role="button" tabIndex={isDisabled ? -1 : 0} aria-disabled={isDisabled} onClick={openFileDialog} onDragLeave={handleDragLeave} onDragOver={handleDragOver} onDrop={handleDrop} onKeyDown={handleKeyDown} className={cn("border border-dashed rounded-md px-4 py-4 [transition:background-color_0.15s_ease,_border-color_0.15s_ease,_opacity_0.15s_ease]", tone, !isDisabled && hoverTone, isDisabled ? "cursor-not-allowed" : "cursor-pointer", isDisabled ? "opacity-[0.55]" : "opacity-100")}>
			<input
				ref={inputRef}
				type="file"
				accept={accept}
				multiple={multiple}
				disabled={isDisabled}
				onChange={handleInputChange}
				style={{ display: "none" }}
			/>
			<div className="flex flex-row gap-4 items-center">
				<div className={cn("border rounded-md p-2.5", iconBorder, iconBg)}>
					{createElement(hasSelection ? FileText : Upload, { className: cn("size-5", hasSelection ? "text-primary-400" : (mutedColor)) })}
				</div>
				<div className="flex flex-col items-stretch gap-1 min-w-0! flex-1">
					<p className="text-[0.875rem] font-semibold truncate">
						{selectedFile?.name || title}
					</p>
					<p className={cn("text-[0.75rem] line-clamp-2", mutedColor)}>
						{selectedFile
							? formatFileSize(selectedFile.size)
							: description || emptyText}
					</p>
				</div>
				<p className={cn("text-[0.75rem] font-semibold whitespace-nowrap", isDisabled ? (mutedColor) : "text-primary-300")}>
					{emptyText}
				</p>
			</div>
		</div>
	);
};
