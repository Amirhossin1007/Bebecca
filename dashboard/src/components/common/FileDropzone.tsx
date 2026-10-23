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
		const tone = isDragging
			? "border-panel-accent! bg-panel-elevated"
			: "border-panel-border! bg-panel-surface";
		const hoverTone = "md:hover:border-panel-border-strong! md:hover:bg-panel-elevated";
		const iconBorder = isDragging ? "border-panel-accent!" : "border-panel-border!";
		const iconBg = isDragging ? "bg-panel-surface" : "bg-panel-elevated";
		const mutedColor = "text-panel-text-muted";

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
		<div role="button" tabIndex={isDisabled ? -1 : 0} aria-disabled={isDisabled} onClick={openFileDialog} onDragLeave={handleDragLeave} onDragOver={handleDragOver} onDrop={handleDrop} onKeyDown={handleKeyDown} className={cn("border border-dashed rounded-[20px] px-4 sm:px-5 py-5 transition-[background-color,border-color] duration-200 active:scale-[0.995]", tone, !isDisabled && hoverTone, isDisabled ? "cursor-not-allowed opacity-[0.55]" : "cursor-pointer opacity-100")}>
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
				<div className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl border p-2.5 transition-colors", iconBorder, iconBg)}>
					{createElement(hasSelection ? FileText : Upload, { className: cn("size-5", hasSelection ? "text-panel-accent" : "text-panel-text-secondary") })}
				</div>
				<div className="flex flex-col items-stretch gap-1 min-w-0! flex-1">
					<p className="text-[13px] font-bold text-panel-text truncate">
						{selectedFile?.name || title}
					</p>
					<p className={cn("text-[12px] line-clamp-2", mutedColor)}>
						{selectedFile
							? formatFileSize(selectedFile.size)
							: description || emptyText}
					</p>
				</div>
				<button
					type="button"
					tabIndex={-1}
					className="hidden sm:inline-flex h-[30px] shrink-0 items-center justify-center rounded-[10px] border border-panel-border bg-panel-elevated px-3 text-[12px] font-semibold text-panel-text transition-all md:hover:border-panel-border-strong md:hover:bg-panel-surface active:scale-95"
				>
					{emptyText}
				</button>
			</div>
		</div>
	);
};
