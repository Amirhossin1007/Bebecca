import { Alert, AlertDescription } from "components/ui/alert";
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
import { PanelSelect as Select } from "components/common/PanelSelect";
import { useMutation } from "@tanstack/react-query";
import { Archive, Download, RefreshCw, TriangleAlert, Upload } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
	exportRebeccaBackup,
	importRebeccaBackup,
	type RebeccaBackupScope,
} from "service/settings";
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
	isBinaryRuntime: _isBinaryRuntime = true,
	runtimeLoading = false,
	width,
}: {
	isBinaryRuntime?: boolean;
	runtimeLoading?: boolean;
	width?: string;
}) => {
	const { t } = useTranslation();
	const [isMenuOpen, setMenuOpen] = useState(false);
	const [dialog, setDialog] = useState<BackupDialog>(null);
	const [exportScope, setExportScope] =
		useState<RebeccaBackupScope>("database");
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [uploadProgress, setUploadProgress] = useState<number | null>(null);
	const backupActionsAvailable = !runtimeLoading;

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
		mutationFn: (file: File) => importRebeccaBackup(file, setUploadProgress),
		onMutate: () => setUploadProgress(0),
		onSuccess: (result) => {
			generateSuccessMessage(
				t("dashboard.backup.importDone", {
					tables: result.tables_restored,
					rows: result.rows_restored,
				}),
				toast,
			);
			if (result.warnings.length) {
				toast.warning(t("dashboard.backup.importWarnings"), {
					description: result.warnings.join("\n"),
					duration: 8000,
				});
			}
			setSelectedFile(null);
			setDialog(null);
		},
		onError: (error) => {
			generateErrorMessage(error, toast);
		},
		onSettled: () => setUploadProgress(null),
	});

	const openDialog = (nextDialog: Exclude<BackupDialog, null>) => {
		setMenuOpen(false);
		setDialog(nextDialog);
	};

	const handleImport = () => {
		if (!selectedFile) {
			toast.warning(t("dashboard.backup.fileRequired"));
			return;
		}
		importMutation.mutate(selectedFile);
	};

	return (
		<>
			<Popover open={isMenuOpen} onOpenChange={setMenuOpen}>
				<PopoverTrigger asChild>
					<Button
						variant="outline"
						size="sm"
						disabled={runtimeLoading}
						className="h-8 min-w-full sm:min-w-0 sm:w-auto px-3.5 md:px-2.5 lg:px-3 rounded-[12px] border-panel-border! bg-transparent text-panel-text hover:bg-panel-elevated! active:scale-95 transition-all text-xs font-semibold whitespace-nowrap"
						style={width ? { width } : undefined}
					>
						<span className="flex items-center justify-center gap-1.5 w-full">
							<Archive className="size-3.5 shrink-0" />
							<span className="leading-none">
								{t("dashboard.backup.tabTitle")}
							</span>
						</span>
					</Button>
				</PopoverTrigger>
				<PopoverContent
					align="end"
					className="w-[min(280px,calc(100vw-24px))] p-2 rounded-[20px] bg-panel-surface border-panel-border! shadow-xl"
				>
					<div className="font-bold text-[13px] py-2 px-3 text-panel-text border-b border-panel-border! mb-1">
						{t("dashboard.backup.title")}
					</div>
					<div className="flex flex-col gap-1">
						<Button
							variant="ghost"
							className="justify-start text-[13px] font-semibold text-panel-text rounded-[12px] h-[42px] px-2.5 hover:bg-panel-elevated! active:scale-[0.98] transition-all"
							onClick={() => openDialog("import")}
						>
							<RefreshCw className="me-2 size-4 text-panel-text-secondary shrink-0" />
							<span>{t("dashboard.backup.import")}</span>
						</Button>
						<Button
							variant="ghost"
							className="justify-start text-[13px] font-semibold text-panel-text rounded-[12px] h-[42px] px-2.5 hover:bg-panel-elevated! active:scale-[0.98] transition-all"
							onClick={() => openDialog("export")}
						>
							<Download className="me-2 size-4 text-panel-text-secondary shrink-0" />
							<span>{t("dashboard.backup.exportTitle")}</span>
						</Button>
					</div>
				</PopoverContent>
			</Popover>

			<Dialog
				open={dialog === "import"}
				onOpenChange={(open) => {
					if (!open && !importMutation.isPending) {
						setDialog(null);
					}
				}}
			>
				<DialogContent className="max-w-xl rounded-[20px] border-panel-border! bg-panel-surface p-0 overflow-hidden shadow-2xl">
					<DialogHeader className="px-6 pt-5 pb-4 border-b border-panel-border!">
						<div className="flex items-center gap-3">
							<div className="flex size-10 items-center justify-center rounded-[12px] bg-panel-elevated text-panel-text border border-panel-border! shrink-0">
								<Archive className="size-5" />
							</div>
							<div className="min-w-0 text-start">
								<DialogTitle className="text-[15px] font-bold text-panel-text">
									{t("dashboard.backup.import")}
								</DialogTitle>
								<DialogDescription className="text-[11px] font-medium text-panel-text-secondary mt-0.5">
									{t("dashboard.backup.importHint")}
								</DialogDescription>
							</div>
						</div>
					</DialogHeader>

					<div className="px-6 py-5 flex flex-col gap-4">
						<Alert className="rounded-[14px] text-[13px] border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400">
							<TriangleAlert className="size-4 shrink-0 text-amber-500" />
							<AlertDescription className="text-xs ms-2">
								{t("dashboard.backup.autoDetectImportWarning")}
							</AlertDescription>
						</Alert>

						<Field>
							<FieldLabel className="text-[13px] font-semibold text-panel-text-secondary mb-2">
								{t("dashboard.backup.file")}
							</FieldLabel>
							<FileDropzone
								accept=".rbbackup,.tar.gz,.tgz,.zip,application/vnd.rebecca.backup,application/gzip,application/x-gzip,application/zip,application/x-tar,application/octet-stream"
								disabled={
									!backupActionsAvailable || importMutation.isPending
								}
								selectedFile={selectedFile}
								title={t("dashboard.backup.dropTitle")}
								description={t("dashboard.backup.dropHint")}
								emptyText={t("dashboard.backup.selectFile")}
								onFileSelect={setSelectedFile}
							/>
						</Field>

						{importMutation.isPending && uploadProgress !== null && (
							<div className="flex flex-col gap-2" aria-live="polite">
								<p className="text-xs font-semibold text-panel-text">
									{uploadProgress < 100
										? t("dashboard.backup.uploadProgress", {
												percent: uploadProgress,
											})
										: t("dashboard.backup.processing")}
								</p>
								<Progress
									value={uploadProgress}
									className="h-1.5 rounded-full"
								/>
							</div>
						)}
					</div>

					<DialogFooter className="gap-2.5 px-6 py-4 border-t border-panel-border! bg-panel-elevated">
						<Button
							variant="ghost"
							size="sm"
							className="rounded-[10px] text-panel-text-secondary font-semibold text-xs hover:bg-panel-surface! hover:text-panel-text!"
							onClick={() => setDialog(null)}
							disabled={importMutation.isPending}
						>
							{t("cancel")}
						</Button>
						<Button
							size="sm"
							variant="destructive"
							className="rounded-[10px] px-5 h-[34px] font-semibold text-xs gap-1.5"
							onClick={handleImport}
							disabled={importMutation.isPending}
						>
							<RefreshCw className="size-3.5" />
							<span>{t("dashboard.backup.import")}</span>
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog
				open={dialog === "export"}
				onOpenChange={(open) => {
					if (!open && !exportMutation.isPending) {
						setDialog(null);
					}
				}}
			>
				<DialogContent className="max-w-md rounded-[20px] border-panel-border! bg-panel-surface p-0 overflow-hidden shadow-2xl">
					<DialogHeader className="px-6 pt-5 pb-4 border-b border-panel-border!">
						<div className="flex items-center gap-3">
							<div className="flex size-10 items-center justify-center rounded-[12px] bg-panel-elevated text-panel-text border border-panel-border! shrink-0">
								<Archive className="size-5" />
							</div>
							<div className="min-w-0 text-start">
								<DialogTitle className="text-[15px] font-bold text-panel-text">
									{t("dashboard.backup.exportTitle")}
								</DialogTitle>
								<DialogDescription className="text-[11px] font-medium text-panel-text-secondary mt-0.5">
									{t("dashboard.backup.exportHint")}
								</DialogDescription>
							</div>
						</div>
					</DialogHeader>

					<div className="px-6 py-5 flex flex-col gap-4">
						<Field>
							<FieldLabel className="text-[13px] font-semibold text-panel-text-secondary mb-2">
								{t("dashboard.backup.scope")}
							</FieldLabel>
							<Select
								value={exportScope}
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

					<DialogFooter className="gap-2.5 px-6 py-4 border-t border-panel-border! bg-panel-elevated">
						<Button
							variant="ghost"
							size="sm"
							className="rounded-[10px] text-panel-text-secondary font-semibold text-xs hover:bg-panel-surface! hover:text-panel-text!"
							onClick={() => setDialog(null)}
							disabled={exportMutation.isPending}
						>
							{t("cancel")}
						</Button>
						<Button
							size="sm"
							className="rounded-[10px] px-5 h-[34px] font-semibold text-xs gap-1.5 bg-panel-accent text-white hover:bg-panel-accent/90"
							onClick={() => exportMutation.mutate(exportScope)}
							disabled={exportMutation.isPending}
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

export const RebeccaBackupPanel = DashboardBackupControls;
export default DashboardBackupControls;
