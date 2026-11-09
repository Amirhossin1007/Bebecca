import { Button } from "components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "components/ui/popover";
import { Dialog, DialogContent, DialogFooter, DialogHeader } from "components/ui/dialog";
import { Alert } from "components/ui/alert";
import { Field, FieldLabel } from "components/ui/field";
import { Progress } from "components/ui/progress";
import { toast } from "components/ui/sonner";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import { Archive, Download, Upload } from "lucide-react";

import { cn } from "lib/cn";
import { PanelSelect as Select } from "components/common/PanelSelect";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
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

type BackupDialog = "import" | "export" | null;

export const DashboardBackupControls = ({
	isBinaryRuntime,
	runtimeLoading,
}: {
	isBinaryRuntime: boolean;
	runtimeLoading: boolean;
}) => {
	const { t } = useTranslation();
	
	const [isMenuOpen, setMenuOpen] = useState(false);
	const [dialog, setDialog] = useState<BackupDialog>(null);
	const [exportScope, setExportScope] =
		useState<RebeccaBackupScope>("database");
	const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
	const [uploadProgress, setUploadProgress] = useState<number | null>(null);
	const backupActionsAvailable = isBinaryRuntime && !runtimeLoading;

	const exportMutation = useMutation({ mutationFn: exportRebeccaBackup, onSuccess: (blob, scope) => {
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
		}, });

	const importMutation = useMutation({ mutationFn: (files: File[]) => importRebeccaBackup(files, setUploadProgress), onMutate: () => setUploadProgress(0),
			onSuccess: (result) => {
				generateSuccessMessage(
					t("dashboard.backup.importDone", {
						tables: result.tables_restored,
						rows: result.rows_restored,
					}),
					toast,
				);
				if (result.warnings.length) {
					toast.warning(t("dashboard.backup.importWarnings"), { description: result.warnings.join("\n"), duration: 8000 });
				}
				setSelectedFiles([]);
				setDialog(null);
			},
			onError: (error) => {
				generateErrorMessage(error, toast);
			},
			onSettled: () => setUploadProgress(null), });

	const openDialog = (nextDialog: Exclude<BackupDialog, null>) => {
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
				if (
					!next.some(
						(item) => item.name === file.name && item.size === file.size,
					)
				) {
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
					<Button disabled={!backupActionsAvailable || runtimeLoading} variant="outline" size="xs" className="h-[32px] w-full sm:w-auto px-3.5 rounded-full border-panel-border! text-panel-text hover:bg-panel-elevated hover:border-panel-border-strong! [transition:border-color_0.25s_ease,_background-color_0.25s_ease] whitespace-nowrap">
						<div className="flex flex-row gap-1.5 items-center justify-center w-full">
							<span className="inline-flex items-center justify-center shrink-0">
								<Archive className="w-[15px] h-[15px]" />
							</span>
							<span className="text-[12px] font-semibold leading-none">
								{t("dashboard.backup.tabTitle")}
							</span>
						</div>
					</Button>
				</PopoverTrigger>
				<PopoverContent className="w-[min(280px,_calc(100vw_-_24px))] rounded-2xl shadow-[0_24px_60px_rgba(0,0,0,0.5)] bg-panel-surface border-panel-border! border">
					<div className={cn("p-3 font-semibold", "font-bold text-[13px] py-3 px-4 border-panel-border!")}>
						{t("dashboard.backup.title")}
					</div>
					<div className={cn("p-3", "p-2")}>
						<div className="flex flex-col gap-1">
							<Button onClick={() => openDialog("import")} variant="ghost" className="justify-start text-[13px] rounded-xl h-[36px] hover:bg-panel-elevated [transition:background-color_0.2s_ease]">{<Upload className="w-[16px] h-[16px]" />}
								{t("dashboard.backup.import")}
							</Button>
							<Button onClick={() => openDialog("export")} variant="ghost" className="justify-start text-[13px] rounded-xl h-[36px] hover:bg-panel-elevated [transition:background-color_0.2s_ease]">{<Download className="w-[16px] h-[16px]" />}
								{t("dashboard.backup.exportTitle")}
							</Button>
						</div>
					</div>
				</PopoverContent>
			</Popover>

			<Dialog open={dialog === "import"} onOpenChange={(open) => { if (!open) (() => setDialog(null))(); }}>
				
				<DialogContent className="border border-panel-border! rounded-2xl shadow-[0_32px_80px_rgba(0,0,0,0.5)] bg-panel-surface mx-4 sm:mx-0">
					<DialogHeader className="text-[1rem] font-bold text-panel-text">{t("dashboard.backup.import")}</DialogHeader>
					
					<div className={cn("px-5 py-4 overflow-y-auto", "py-4")}>
						<div className="flex flex-col gap-4">
							<p className="text-[13px] text-panel-text-muted">
								{t("dashboard.backup.importHint")}
							</p>
							<Alert className="rounded-xl text-[13px]">
								<TriangleAlert className="size-4" aria-hidden="true" />
								<p className="text-[12px]">
									{t("dashboard.backup.autoDetectImportWarning")}
								</p>
							</Alert>
							<Field>
								<FieldLabel className="text-[13px] font-semibold text-panel-text-secondary">{t("dashboard.backup.file")}</FieldLabel>
								<FileDropzone
									accept=".rbbackup,.tar.gz,.tgz,.zip,application/vnd.rebecca.backup,application/gzip,application/x-gzip,application/zip,application/x-tar,application/octet-stream"
									disabled={
										!backupActionsAvailable || importMutation.isPending
									}
									multiple
								selectedFiles={selectedFiles}
									title={t("dashboard.backup.dropTitle")}
									description={t("dashboard.backup.dropHint")}
									emptyText={t("dashboard.backup.selectFile")}
									onFilesSelect={addFiles}
								/>
							</Field>
							<p className="text-[12px] text-panel-text-muted">
								{t("dashboard.backup.multiPartHint")}
							</p>
							{selectedFiles.length > 0 && (
								<div className="flex flex-col gap-2">
									{displayFiles.map((file) => (
										<div key={`${file.name}-${file.size}`} className="flex flex-row items-center justify-between gap-3">
											<p className="text-[12px] truncate">
												{file.name}
											</p>
											<p className="text-[12px] text-panel-text-muted whitespace-nowrap">
												{formatBytes(file.size, 2)}
											</p>
										</div>
									))}
									{partStatusText && (
										<p className={cn("text-[12px]", canImport ? "text-panel-text-muted" : "text-red-300")}>
											{partStatusText}
										</p>
									)}
									<Button onClick={() => setSelectedFiles([])} variant="ghost" size="xs" className="self-start">
										{t("dashboard.backup.clearFiles")}
									</Button>
								</div>
							)}
							{importMutation.isPending && uploadProgress !== null && (
								<div aria-live="polite" className="flex flex-col gap-2">
									<p className="text-[12px] font-semibold">
										{uploadProgress < 100
											? t("dashboard.backup.uploadProgress", {
													percent: uploadProgress,
												})
											: t("dashboard.backup.processing")}
									</p>
									<Progress value={uploadProgress} className="rounded-full h-[4px]" />
								</div>
							)}
						</div>
					</div>
					<DialogFooter className="gap-2 border-t border-panel-border!">
						<Button onClick={() => setDialog(null)} disabled={importMutation.isPending} variant="ghost" size="sm" className="rounded-full">
							{t("cancel")}
						</Button>
						<Button onClick={handleImport} disabled={!canImport} variant="destructive" size="sm" loading={importMutation.isPending} className="rounded-full px-5">{<Upload className="w-[15px] h-[15px]" />}
							{t("dashboard.backup.import")}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={dialog === "export"} onOpenChange={(open) => { if (!open) (() => setDialog(null))(); }}>
				
				<DialogContent className="border border-panel-border! rounded-2xl shadow-[0_32px_80px_rgba(0,0,0,0.5)] bg-panel-surface mx-4 sm:mx-0">
					<DialogHeader className="text-[1rem] font-bold text-panel-text">{t("dashboard.backup.exportTitle")}</DialogHeader>
					
					<div className={cn("px-5 py-4 overflow-y-auto", "py-4")}>
						<div className="flex flex-col gap-4">
							<p className="text-[13px] text-panel-text-muted">
								{t("dashboard.backup.exportHint")}
							</p>
							<Field>
								<FieldLabel className="text-[13px] font-semibold text-panel-text-secondary">{t("dashboard.backup.scope")}</FieldLabel>
								<Select
									value={exportScope}
									showSearch={false}
									onChange={(event) =>
										setExportScope(event.target.value as RebeccaBackupScope)
									}
								>
									<option value="database">
										{t("dashboard.backup.databaseOnly")}
									</option>
									<option value="full">{t("dashboard.backup.full")}</option>
								</Select>
							</Field>
						</div>
					</div>
					<DialogFooter className="gap-2 border-t border-panel-border!">
						<Button onClick={() => setDialog(null)} disabled={exportMutation.isPending} variant="ghost" size="sm" className="rounded-full">
							{t("cancel")}
						</Button>
						<Button onClick={() => exportMutation.mutate(exportScope)} size="sm" loading={exportMutation.isPending} className="rounded-full px-5">{<Download className="w-[15px] h-[15px]" />}
							{t("dashboard.backup.download")}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
};
