import { useToast } from "components/shadcn/toast";
import { Popover, PopoverBody, PopoverContent, PopoverHeader, PopoverTrigger } from "components/shadcn/popover";
import { Button } from "components/shadcn/button";
import { Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay } from "components/shadcn/dialog";
import { Alert, AlertIcon } from "components/shadcn/alert";
import { FormControl, FormLabel } from "components/shadcn/field";
import { Progress } from "components/shadcn/feedback";
import { cn } from "lib/cn";
import {
	ArchiveBoxIcon,
	ArrowDownTrayIcon,
	ArrowUpTrayIcon,
} from "@heroicons/react/24/outline";
import { PanelSelect as Select } from "components/common/PanelSelect";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation } from "react-query";
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
	const toast = useToast();
	const [isMenuOpen, setMenuOpen] = useState(false);
	const [dialog, setDialog] = useState<BackupDialog>(null);
	const [exportScope, setExportScope] =
		useState<RebeccaBackupScope>("database");
	const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
	const [uploadProgress, setUploadProgress] = useState<number | null>(null);
	const backupActionsAvailable = isBinaryRuntime && !runtimeLoading;

	const exportMutation = useMutation(exportRebeccaBackup, {
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

	const importMutation = useMutation(
		(files: File[]) => importRebeccaBackup(files, setUploadProgress),
		{
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
					toast({
						status: "warning",
						title: t("dashboard.backup.importWarnings"),
						description: result.warnings.join("\n"),
						duration: 8000,
						isClosable: true,
					});
				}
				setSelectedFiles([]);
				setDialog(null);
			},
			onError: (error) => {
				generateErrorMessage(error, toast);
			},
			onSettled: () => setUploadProgress(null),
		},
	);

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
			toast({ status: "warning", title: t("dashboard.backup.fileRequired") });
			return;
		}
		if (canImport) {
			importMutation.mutate(selectedFiles);
		}
	};

	return (
		<>
			<Popover open={isMenuOpen} onOpen={() => setMenuOpen(true)} onClose={() => setMenuOpen(false)} placement="bottom-end" closeOnBlur={true} isLazy>
				<PopoverTrigger>
					<Button size="xs" variant="outline" disabled={!backupActionsAvailable || runtimeLoading} className="h-[32px] w-full sm:w-auto px-3.5 rounded-full border-panel-border! text-panel-text hover:bg-panel-elevated hover:border-panel-border-strong! [transition:border-color_0.25s_ease,_background-color_0.25s_ease] whitespace-nowrap">
						<div className="flex flex-row gap-1.5 items-center justify-center w-full">
							<span className="inline-flex items-center justify-center shrink-0">
								<ArchiveBoxIcon className="w-15 h-15" />
							</span>
							<span className="text-[12px] font-semibold leading-none">
								{t("dashboard.backup.tabTitle")}
							</span>
						</div>
					</Button>
				</PopoverTrigger>
				<PopoverContent className="w-[min(280px,_calc(100vw_-_24px))] rounded-2xl shadow-[0_24px_60px_rgba(0,0,0,0.5)] bg-panel-surface border-panel-border! border">
					<PopoverHeader className="font-bold text-[13px] py-3 px-4 border-panel-border!">
						{t("dashboard.backup.title")}
					</PopoverHeader>
					<PopoverBody className="p-2">
						<div className="flex flex-col gap-1">
							<Button size="md" variant="ghost" onClick={() => openDialog("import")} className="justify-start text-[13px] rounded-xl h-[36px] hover:bg-panel-elevated [transition:background-color_0.2s_ease]">{<ArrowUpTrayIcon className="w-16 h-16" />}
								{t("dashboard.backup.import")}
							</Button>
							<Button size="md" variant="ghost" onClick={() => openDialog("export")} className="justify-start text-[13px] rounded-xl h-[36px] hover:bg-panel-elevated [transition:background-color_0.2s_ease]">{<ArrowDownTrayIcon className="w-16 h-16" />}
								{t("dashboard.backup.exportTitle")}
							</Button>
						</div>
					</PopoverBody>
				</PopoverContent>
			</Popover>

			<Modal open={dialog === "import"} onClose={() => setDialog(null)} isCentered size="xl" closeOnOverlayClick={!importMutation.isLoading}>
				<ModalOverlay className="bg-blackAlpha-700 [backdrop-filter:blur(8px)]" />
				<ModalContent className="border border-panel-border! rounded-2xl shadow-[0_32px_80px_rgba(0,0,0,0.5)] bg-panel-surface mx-4 sm:mx-0">
					<ModalHeader className="text-[1rem] font-bold text-panel-text">{t("dashboard.backup.import")}</ModalHeader>
					<ModalCloseButton disabled={importMutation.isLoading} />
					<ModalBody className="py-4">
						<div className="flex flex-col gap-4">
							<p className="text-[13px] text-panel-text-muted">
								{t("dashboard.backup.importHint")}
							</p>
							<Alert status="warning" className="rounded-xl text-[13px]">
								<AlertIcon />
								<p className="text-[12px]">
									{t("dashboard.backup.autoDetectImportWarning")}
								</p>
							</Alert>
							<FormControl required>
								<FormLabel className="text-[13px] font-semibold text-panel-text-secondary">{t("dashboard.backup.file")}</FormLabel>
								<FileDropzone
									accept=".rbbackup,.tar.gz,.tgz,.zip,application/vnd.rebecca.backup,application/gzip,application/x-gzip,application/zip,application/x-tar,application/octet-stream"
									disabled={
										!backupActionsAvailable || importMutation.isLoading
									}
									multiple
								selectedFiles={selectedFiles}
									title={t("dashboard.backup.dropTitle")}
									description={t("dashboard.backup.dropHint")}
									emptyText={t("dashboard.backup.selectFile")}
									onFilesSelect={addFiles}
								/>
							</FormControl>
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
									<Button size="xs" variant="ghost" onClick={() => setSelectedFiles([])} className="self-start">
										{t("dashboard.backup.clearFiles")}
									</Button>
								</div>
							)}
							{importMutation.isLoading && uploadProgress !== null && (
								<div aria-live="polite" className="flex flex-col gap-2">
									<p className="text-[12px] font-semibold">
										{uploadProgress < 100
											? t("dashboard.backup.uploadProgress", {
													percent: uploadProgress,
												})
											: t("dashboard.backup.processing")}
									</p>
									<Progress value={uploadProgress} isIndeterminate={uploadProgress >= 100} colorScheme="primary" size="xs" className="rounded-full h-[4px]" />
								</div>
							)}
						</div>
					</ModalBody>
					<ModalFooter className="gap-2 border-t border-panel-border!">
						<Button variant="ghost" size="sm" onClick={() => setDialog(null)} disabled={importMutation.isLoading} className="rounded-full">
							{t("cancel")}
						</Button>
						<Button colorScheme="red" size="sm" onClick={handleImport} disabled={!canImport} loading={importMutation.isLoading} className="rounded-full px-5">{<ArrowUpTrayIcon className="w-15 h-15" />}
							{t("dashboard.backup.import")}
						</Button>
					</ModalFooter>
				</ModalContent>
			</Modal>

			<Modal open={dialog === "export"} onClose={() => setDialog(null)} isCentered size="md" closeOnOverlayClick={!exportMutation.isLoading}>
				<ModalOverlay className="bg-blackAlpha-700 [backdrop-filter:blur(8px)]" />
				<ModalContent className="border border-panel-border! rounded-2xl shadow-[0_32px_80px_rgba(0,0,0,0.5)] bg-panel-surface mx-4 sm:mx-0">
					<ModalHeader className="text-[1rem] font-bold text-panel-text">{t("dashboard.backup.exportTitle")}</ModalHeader>
					<ModalCloseButton disabled={exportMutation.isLoading} />
					<ModalBody className="py-4">
						<div className="flex flex-col gap-4">
							<p className="text-[13px] text-panel-text-muted">
								{t("dashboard.backup.exportHint")}
							</p>
							<FormControl>
								<FormLabel className="text-[13px] font-semibold text-panel-text-secondary">{t("dashboard.backup.scope")}</FormLabel>
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
							</FormControl>
						</div>
					</ModalBody>
					<ModalFooter className="gap-2 border-t border-panel-border!">
						<Button variant="ghost" size="sm" onClick={() => setDialog(null)} disabled={exportMutation.isLoading} className="rounded-full">
							{t("cancel")}
						</Button>
						<Button colorScheme="primary" size="sm" onClick={() => exportMutation.mutate(exportScope)} loading={exportMutation.isLoading} className="rounded-full px-5">{<ArrowDownTrayIcon className="w-15 h-15" />}
							{t("dashboard.backup.download")}
						</Button>
					</ModalFooter>
				</ModalContent>
			</Modal>
		</>
	);
};
