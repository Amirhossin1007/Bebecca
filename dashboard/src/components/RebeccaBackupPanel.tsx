import { useMutation } from "@tanstack/react-query";
import { Alert } from "components/ui/alert";
import { Button } from "components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "components/ui/dialog";
import { Field, FieldLabel } from "components/ui/field";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "components/ui/popover";
import { Progress } from "components/ui/progress";
import { toast } from "components/ui/sonner";
import { cn } from "lib/cn";
import {
	Archive,
	CircleCheck,
	Database,
	Download,
	FileArchive,
	HardDrive,
	Trash2,
	TriangleAlert,
	Upload,
	X,
} from "lucide-react";
import { type FC, useState } from "react";
import { useTranslation } from "react-i18next";
import {
	exportRebeccaBackup,
	importRebeccaBackup,
	type RebeccaBackupScope,
} from "service/settings";
import { checkBackupParts, parseBackupPartName } from "utils/backupParts";
import { formatBytes } from "utils/formatByte";
import {
	generateErrorMessage,
	generateSuccessMessage,
} from "utils/toastHandler";
import { FileDropzone } from "./common/FileDropzone";

const buildBackupFilename = (scope: RebeccaBackupScope) => {
	const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
	return `rebecca-${scope}-${timestamp}.rbbackup`;
};

type BackupDialogMode = "import" | "export" | null;

export interface DashboardBackupControlsProps {
	isBinaryRuntime: boolean;
	runtimeLoading: boolean;
	className?: string;
}

export const DashboardBackupControls: FC<DashboardBackupControlsProps> = ({
	isBinaryRuntime,
	runtimeLoading,
	className,
}) => {
	const { t, i18n } = useTranslation();
	const isRTL = i18n.dir(i18n.language) === "rtl";
	const [isMenuOpen, setMenuOpen] = useState(false);
	const [dialog, setDialog] = useState<BackupDialogMode>(null);
	const [exportScope, setExportScope] = useState<RebeccaBackupScope>("database");
	const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
	const [uploadProgress, setUploadProgress] = useState<number | null>(null);

	const backupActionsAvailable = isBinaryRuntime && !runtimeLoading;

	const exportMutation = useMutation({
		mutationFn: exportRebeccaBackup,
		onSuccess: (blob, scope) => {
			const url = URL.createObjectURL(blob);
			const anchor = document.createElement("a");
			anchor.href = url;
			anchor.download = buildBackupFilename(scope);
			document.body.appendChild(anchor);
			anchor.click();
			anchor.remove();
			URL.revokeObjectURL(url);
			setDialog(null);
			generateSuccessMessage(t("dashboard.backup.exportReady"), toast);
		},
		onError: (error) => {
			generateErrorMessage(error, toast);
		},
	});

	const importMutation = useMutation({
		mutationFn: (files: File[]) => importRebeccaBackup(files, setUploadProgress),
		onMutate: () => setUploadProgress(0),
		onSuccess: (result) => {
			generateSuccessMessage(
				t("dashboard.backup.importDone", {
					tables: result.tables_restored,
					rows: result.rows_restored,
				}),
				toast,
			);
			if (result.warnings.length > 0) {
				toast.warning(t("dashboard.backup.importWarnings"), {
					description: result.warnings.join("\n"),
					duration: 8000,
				});
			}
			setSelectedFiles([]);
			setDialog(null);
		},
		onError: (error) => {
			generateErrorMessage(error, toast);
		},
		onSettled: () => setUploadProgress(null),
	});

	const openDialog = (nextDialog: Exclude<BackupDialogMode, null>) => {
		setMenuOpen(false);
		setDialog(nextDialog);
	};

	const partCheck = checkBackupParts(selectedFiles.map((file) => file.name));
	const canImport =
		partCheck.status === "single" || partCheck.status === "complete";
	const partStatusText =
		partCheck.status === "complete"
			? t("dashboard.backup.partsComplete", { total: partCheck.total })
			: partCheck.status === "incomplete"
				? t("dashboard.backup.partsMissing", {
						total: partCheck.total,
						missing: partCheck.missing.join(", "),
					})
				: partCheck.status === "invalid"
					? t("dashboard.backup.partsInvalid")
					: null;

	const displayFiles = [...selectedFiles].sort(
		(left, right) =>
			(parseBackupPartName(left.name)?.index ?? 0) -
			(parseBackupPartName(right.name)?.index ?? 0),
	);

	const addFiles = (files: File[]) => {
		setSelectedFiles((current) => {
			const next = [...current];
			for (const file of files) {
				const exists = next.some(
					(item) => item.name === file.name && item.size === file.size,
				);
				if (!exists) {
					next.push(file);
				}
			}
			return next;
		});
	};

	const handleImport = () => {
		if (partCheck.status === "empty") {
			toast.warning(t("dashboard.backup.fileRequired"));
			return;
		}
		if (canImport) {
			importMutation.mutate(selectedFiles);
		}
	};

	return (
		<>
			<Popover open={isMenuOpen} onOpenChange={setMenuOpen}>
				<PopoverTrigger asChild>
					<Button
						type="button"
						disabled={!backupActionsAvailable || runtimeLoading}
						variant="outline"
						size="xs"
						className={cn(
							"h-9 w-full rounded-[12px] border border-panel-border! bg-panel-surface px-3.5 text-panel-text shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] min-[769px]:h-8 min-[769px]:w-auto min-[769px]:hover:border-panel-border-strong! min-[769px]:hover:bg-panel-elevated min-[769px]:hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] whitespace-nowrap",
							className,
						)}
					>
						<span className="inline-flex items-center justify-center gap-2">
							<Archive className="size-3.5 shrink-0 text-panel-text-secondary" />
							<span className="text-[12px] font-semibold leading-none">
								{t("dashboard.backup.tabTitle")}
							</span>
						</span>
					</Button>
				</PopoverTrigger>
				<PopoverContent
					dir={isRTL ? "rtl" : "ltr"}
					align={isRTL ? "start" : "end"}
					sideOffset={8}
					collisionPadding={12}
					className="w-[min(280px,calc(100vw-24px))] rounded-[20px] border border-panel-border! bg-panel-surface p-1.5 text-panel-text shadow-[0_20px_48px_-12px_rgba(0,0,0,0.45)]"
				>
					<div className="border-b border-panel-border! px-3 py-2.5">
						<p className="text-[12px] font-bold tracking-[-0.01em] text-panel-text">
							{t("dashboard.backup.title")}
						</p>
					</div>
					<div className="flex flex-col gap-1 p-1.5">
						<button
							type="button"
							onClick={() => openDialog("export")}
							className="flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-start transition-[background-color,transform] duration-150 active:scale-[0.98] active:bg-panel-elevated focus-visible:outline-2 focus-visible:outline-panel-accent min-[769px]:hover:bg-panel-elevated"
						>
							<span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] border border-panel-border! bg-panel-elevated text-panel-accent">
								<Download className="size-4" />
							</span>
							<span className="min-w-0 flex-1 text-[13px] font-semibold text-panel-text">
								{t("dashboard.backup.exportTitle")}
							</span>
						</button>
						<button
							type="button"
							onClick={() => openDialog("import")}
							className="flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-start transition-[background-color,transform] duration-150 active:scale-[0.98] active:bg-panel-elevated focus-visible:outline-2 focus-visible:outline-panel-accent min-[769px]:hover:bg-panel-elevated"
						>
							<span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] border border-panel-border! bg-panel-elevated text-panel-text-secondary">
								<Upload className="size-4" />
							</span>
							<span className="min-w-0 flex-1 text-[13px] font-semibold text-panel-text">
								{t("dashboard.backup.import")}
							</span>
						</button>
					</div>
				</PopoverContent>
			</Popover>

			<Dialog
				open={dialog === "import"}
				onOpenChange={(open) => {
					if (!open && !importMutation.isPending) setDialog(null);
				}}
			>
				<DialogContent
					dir={isRTL ? "rtl" : "ltr"}
					showCloseButton={false}
					className="flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-1.5rem)] max-w-[480px] flex-col gap-0 overflow-hidden rounded-[20px] border border-panel-border! bg-panel-surface p-0 text-panel-text shadow-[0_24px_64px_-12px_rgba(0,0,0,0.48)] sm:w-full sm:max-w-[480px]"
				>
					<DialogHeader className="flex flex-row items-center justify-between gap-3 border-b border-panel-border! px-5 py-3.5 text-start">
						<div className="flex min-w-0 items-center gap-3">
							<span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] border border-panel-border! bg-panel-elevated text-panel-accent">
								<Upload className="size-4" />
							</span>
							<DialogTitle className="truncate text-[14px] font-bold tracking-[-0.01em] text-panel-text">
								{t("dashboard.backup.import")}
							</DialogTitle>
							<DialogDescription className="sr-only">
								{t("dashboard.backup.importHint")}
							</DialogDescription>
						</div>
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							disabled={importMutation.isPending}
							onClick={() => setDialog(null)}
							aria-label={t("close")}
							className="size-8 shrink-0 rounded-[10px] text-panel-text-muted transition-[background-color,color,transform] duration-150 active:scale-[0.95] min-[769px]:hover:bg-panel-elevated min-[769px]:hover:text-panel-text"
						>
							<X className="size-4" />
						</Button>
					</DialogHeader>

					<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
						<div className="flex flex-col gap-4">
							<p className="text-[13px] leading-relaxed text-panel-text-muted">
								{t("dashboard.backup.importHint")}
							</p>
							<Alert className="rounded-[14px] border border-amber-500/25 bg-amber-500/8 text-[12px]">
								<TriangleAlert
									className="size-4 text-amber-600 dark:text-amber-400"
									aria-hidden="true"
								/>
								<p className="text-[12px] leading-relaxed text-panel-text-secondary">
									{t("dashboard.backup.autoDetectImportWarning")}
								</p>
							</Alert>
							<Field className="flex flex-col gap-2">
								<FieldLabel className="text-[12px] font-semibold text-panel-text-secondary">
									{t("dashboard.backup.file")}
								</FieldLabel>
								<FileDropzone
									accept=".rbbackup,.tar.gz,.tgz,.zip,application/vnd.rebecca.backup,application/gzip,application/x-gzip,application/zip,application/x-tar,application/octet-stream"
									disabled={!backupActionsAvailable || importMutation.isPending}
									multiple
									selectedFiles={selectedFiles}
									title={t("dashboard.backup.dropTitle")}
									description={t("dashboard.backup.dropHint")}
									emptyText={t("dashboard.backup.selectFile")}
									onFilesSelect={addFiles}
								/>
							</Field>
							<p className="text-[11px] leading-relaxed text-panel-text-muted">
								{t("dashboard.backup.multiPartHint")}
							</p>

							{selectedFiles.length > 0 && (
								<div className="flex flex-col gap-2 rounded-[14px] border border-panel-border! bg-panel-elevated/60 p-3">
									<div className="flex flex-col divide-y divide-panel-border/60">
										{displayFiles.map((file) => (
											<div
												key={`${file.name}-${file.size}`}
												className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
											>
												<div className="flex min-w-0 items-center gap-2">
													<FileArchive className="size-4 shrink-0 text-panel-accent" />
													<p
														dir="ltr"
														className="truncate text-[12px] font-semibold text-panel-text [unicode-bidi:isolate]"
													>
														{file.name}
													</p>
												</div>
												<p
													dir="ltr"
													className="shrink-0 whitespace-nowrap text-[11px] font-medium text-panel-text-muted tabular-nums [unicode-bidi:isolate]"
												>
													{formatBytes(file.size, 2)}
												</p>
											</div>
										))}
									</div>
									{partStatusText && (
										<div
											className={cn(
												"mt-1 flex items-center gap-2 rounded-[10px] px-2.5 py-1.5 text-[11px] font-semibold",
												canImport
													? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
													: "bg-red-500/10 text-red-600 dark:text-red-400",
											)}
										>
											{canImport ? (
												<CircleCheck className="size-3.5 shrink-0" />
											) : (
												<TriangleAlert className="size-3.5 shrink-0" />
											)}
											<span>{partStatusText}</span>
										</div>
									)}
									<div className="flex justify-end pt-1">
										<Button
											type="button"
											onClick={() => setSelectedFiles([])}
											disabled={importMutation.isPending}
											variant="ghost"
											size="xs"
											className="h-7 rounded-[8px] px-2.5 text-[11px] text-panel-text-muted active:scale-[0.97] min-[769px]:hover:text-red-500"
										>
											<Trash2 className="size-3.5" />
											<span>{t("dashboard.backup.clearFiles")}</span>
										</Button>
									</div>
								</div>
							)}

							{importMutation.isPending && uploadProgress !== null && (
								<div
									aria-live="polite"
									className="flex flex-col gap-2 rounded-[14px] border border-panel-border! bg-panel-elevated/50 p-3"
								>
									<div className="flex items-center justify-between gap-2 text-[12px] font-semibold text-panel-text">
										<span>
											{uploadProgress < 100
												? t("dashboard.backup.uploadProgress", {
														percent: uploadProgress,
													})
												: t("dashboard.backup.processing")}
										</span>
										<span dir="ltr" className="text-panel-accent tabular-nums">
											{uploadProgress}%
										</span>
									</div>
									<Progress value={uploadProgress} className="h-1.5 rounded-full" />
								</div>
							)}
						</div>
					</div>

					<DialogFooter className="flex flex-row items-center justify-end gap-2 border-t border-panel-border! bg-panel-surface px-5 py-3.5">
						<Button
							type="button"
							onClick={() => setDialog(null)}
							disabled={importMutation.isPending}
							variant="ghost"
							size="sm"
							className="h-9 rounded-[12px] px-4 text-[12px] font-semibold text-panel-text-muted active:scale-[0.97]"
						>
							{t("cancel")}
						</Button>
						<Button
							type="button"
							onClick={handleImport}
							disabled={!canImport || importMutation.isPending}
							variant="destructive"
							size="sm"
							loading={importMutation.isPending}
							className="h-9 rounded-[12px] px-4 text-[12px] font-semibold active:scale-[0.97]"
						>
							<Upload className="size-3.5" />
							<span>{t("dashboard.backup.import")}</span>
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog
				open={dialog === "export"}
				onOpenChange={(open) => {
					if (!open && !exportMutation.isPending) setDialog(null);
				}}
			>
				<DialogContent
					dir={isRTL ? "rtl" : "ltr"}
					showCloseButton={false}
					className="flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-1.5rem)] max-w-[440px] flex-col gap-0 overflow-hidden rounded-[20px] border border-panel-border! bg-panel-surface p-0 text-panel-text shadow-[0_24px_64px_-12px_rgba(0,0,0,0.48)] sm:w-full sm:max-w-[440px]"
				>
					<DialogHeader className="flex flex-row items-center justify-between gap-3 border-b border-panel-border! px-5 py-3.5 text-start">
						<div className="flex min-w-0 items-center gap-3">
							<span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] border border-panel-border! bg-panel-elevated text-panel-accent">
								<Download className="size-4" />
							</span>
							<DialogTitle className="truncate text-[14px] font-bold tracking-[-0.01em] text-panel-text">
								{t("dashboard.backup.exportTitle")}
							</DialogTitle>
							<DialogDescription className="sr-only">
								{t("dashboard.backup.exportHint")}
							</DialogDescription>
						</div>
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							disabled={exportMutation.isPending}
							onClick={() => setDialog(null)}
							aria-label={t("close")}
							className="size-8 shrink-0 rounded-[10px] text-panel-text-muted transition-[background-color,color,transform] duration-150 active:scale-[0.95] min-[769px]:hover:bg-panel-elevated min-[769px]:hover:text-panel-text"
						>
							<X className="size-4" />
						</Button>
					</DialogHeader>

					<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
						<div className="flex flex-col gap-4">
							<p className="text-[13px] leading-relaxed text-panel-text-muted">
								{t("dashboard.backup.exportHint")}
							</p>
							<Field className="flex flex-col gap-2">
								<FieldLabel className="text-[12px] font-semibold text-panel-text-secondary">
									{t("dashboard.backup.scope")}
								</FieldLabel>
								<div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
									{(
										[
											{
												scope: "database" as const,
												label: t("dashboard.backup.databaseOnly"),
												icon: Database,
											},
											{
												scope: "full" as const,
												label: t("dashboard.backup.full"),
												icon: HardDrive,
											},
										] as const
									).map((option) => {
										const Icon = option.icon;
										const active = exportScope === option.scope;
										return (
											<button
												key={option.scope}
												type="button"
												onClick={() => setExportScope(option.scope)}
												className={cn(
													"flex items-center gap-3 rounded-[14px] border p-3.5 text-start transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-panel-accent",
													active
														? "border-panel-accent! bg-panel-accent/10 text-panel-text"
														: "border-panel-border! bg-panel-elevated/50 text-panel-text-secondary min-[769px]:hover:border-panel-border-strong! min-[769px]:hover:bg-panel-elevated",
												)}
											>
												<span
													className={cn(
														"flex size-9 shrink-0 items-center justify-center rounded-[10px] transition-colors",
														active
															? "bg-panel-accent text-white"
															: "bg-panel-surface text-panel-text-muted",
													)}
												>
													<Icon className="size-4" />
												</span>
												<span className="min-w-0 flex-1 text-[13px] font-semibold leading-snug">
													{option.label}
												</span>
											</button>
										);
									})}
								</div>
							</Field>
						</div>
					</div>

					<DialogFooter className="flex flex-row items-center justify-end gap-2 border-t border-panel-border! bg-panel-surface px-5 py-3.5">
						<Button
							type="button"
							onClick={() => setDialog(null)}
							disabled={exportMutation.isPending}
							variant="ghost"
							size="sm"
							className="h-9 rounded-[12px] px-4 text-[12px] font-semibold text-panel-text-muted active:scale-[0.97]"
						>
							{t("cancel")}
						</Button>
						<Button
							type="button"
							onClick={() => exportMutation.mutate(exportScope)}
							size="sm"
							loading={exportMutation.isPending}
							className="h-9 rounded-[12px] px-4 text-[12px] font-semibold active:scale-[0.97]"
						>
							<Download className="size-3.5" />
							<span>{t("dashboard.backup.download")}</span>
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
};
