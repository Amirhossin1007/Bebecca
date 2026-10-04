import {
	Alert,
	AlertIcon,
	Box,
	Button,
	Flex,
	FormControl,
	FormLabel,
	HStack,
	Modal,
	ModalBody,
	ModalCloseButton,
	ModalContent,
	ModalFooter,
	ModalHeader,
	ModalOverlay,
	Popover,
	PopoverBody,
	PopoverContent,
	PopoverHeader,
	PopoverTrigger,
	Progress,
	Stack,
	Text,
	useColorModeValue,
	useToast,
} from "@chakra-ui/react";
import {
	ArchiveBoxIcon,
	ArrowPathRoundedSquareIcon,
	DocumentArrowDownIcon,
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
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [uploadProgress, setUploadProgress] = useState<number | null>(null);
	const backupActionsAvailable = isBinaryRuntime && !runtimeLoading;
	const cardHighlight = useColorModeValue(
		"inset 0 1px 0 0 rgba(0, 0, 0, 0.04)",
		"inset 0 1px 0 0 rgba(255, 255, 255, 0.08)",
	);

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
		(file: File) => importRebeccaBackup(file, setUploadProgress),
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
				setSelectedFile(null);
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

	const handleImport = () => {
		if (!selectedFile) {
			toast({ status: "warning", title: t("dashboard.backup.fileRequired") });
			return;
		}
		importMutation.mutate(selectedFile);
	};

	return (
		<>
			<Popover
				isOpen={isMenuOpen}
				onOpen={() => setMenuOpen(true)}
				onClose={() => setMenuOpen(false)}
				placement="bottom-end"
				closeOnBlur={true}
				isLazy
			>
				<PopoverTrigger>
					<Button
						size="xs"
						h="32px"
						minW={{ base: "full", sm: "115px" }}
						w={{ base: "full", sm: "auto" }}
						px={3.5}
						variant="outline"
						borderRadius="12px"
						isDisabled={!backupActionsAvailable || runtimeLoading}
						borderColor="panel.border"
						color="panel.text"
						_hover={{
							md: { bg: "panel.elevated", borderColor: "panel.borderStrong" },
						}}
						_active={{ transform: "scale(0.96)" }}
						transition="all 0.16s cubic-bezier(0.2, 0, 0, 1)"
						whiteSpace="nowrap"
					>
						<HStack spacing={1.5} align="center" justify="center" w="full">
							<Box
								as="span"
								display="inline-flex"
								alignItems="center"
								justifyContent="center"
								flexShrink={0}
							>
								<ArchiveBoxIcon width={15} height={15} />
							</Box>
							<Text
								as="span"
								fontSize="12px"
								fontWeight="600"
								lineHeight="none"
							>
								{t("dashboard.backup.tabTitle")}
							</Text>
						</HStack>
					</Button>
				</PopoverTrigger>
				<PopoverContent
					w="min(280px, calc(100vw - 24px))"
					borderRadius="20px"
					boxShadow={cardHighlight}
					bg="panel.surface"
					borderColor="panel.border"
					borderWidth="1px"
				>
					<PopoverHeader
						fontWeight="700"
						fontSize="13px"
						py={3}
						px={4}
						borderColor="panel.border"
					>
						{t("dashboard.backup.title")}
					</PopoverHeader>
					<PopoverBody p={2}>
						<Stack spacing={1}>
							<Button
								variant="ghost"
								justifyContent="flex-start"
								fontSize="13px"
								fontWeight="600"
								color="panel.text"
								borderRadius="12px"
								h="42px"
								px={2.5}
								leftIcon={
									<Flex
										data-rb-icon="true"
										alignItems="center"
										justifyContent="center"
										color="panel.textSecondary"
										flexShrink={0}
										transition="color 0.2s cubic-bezier(0.16, 1, 0.3, 1)"
									>
										<ArrowPathRoundedSquareIcon width={16} height={16} />
									</Flex>
								}
								onClick={() => openDialog("import")}
								_hover={{ md: { bg: "panel.elevated", color: "panel.text" } }}
								_active={{ transform: "scale(0.98)" }}
								transition="all 0.16s cubic-bezier(0.2, 0, 0, 1)"
							>
								{t("dashboard.backup.import")}
							</Button>
							<Button
								variant="ghost"
								justifyContent="flex-start"
								fontSize="13px"
								fontWeight="600"
								color="panel.text"
								borderRadius="12px"
								h="42px"
								px={2.5}
								leftIcon={
									<Flex
										data-rb-icon="true"
										alignItems="center"
										justifyContent="center"
										color="panel.textSecondary"
										flexShrink={0}
										transition="color 0.2s cubic-bezier(0.16, 1, 0.3, 1)"
									>
										<DocumentArrowDownIcon width={16} height={16} />
									</Flex>
								}
								onClick={() => openDialog("export")}
								_hover={{ md: { bg: "panel.elevated", color: "panel.text" } }}
								_active={{ transform: "scale(0.98)" }}
								transition="all 0.16s cubic-bezier(0.2, 0, 0, 1)"
							>
								{t("dashboard.backup.exportTitle")}
							</Button>
						</Stack>
					</PopoverBody>
				</PopoverContent>
			</Popover>

			<Modal
				isOpen={dialog === "import"}
				onClose={() => setDialog(null)}
				isCentered
				size="xl"
				closeOnOverlayClick={!importMutation.isLoading}
			>
				<ModalOverlay bg="blackAlpha.700" />
				<ModalContent
					borderWidth="1px"
					borderColor="panel.border"
					borderRadius="20px"
					boxShadow={cardHighlight}
					bg="panel.surface"
					mx={{ base: 4, sm: 0 }}
					overflow="hidden"
				>
					<ModalHeader
						px={6}
						pt={5}
						pb={4}
						borderBottomWidth="1px"
						borderColor="panel.border"
					>
						<Flex align="center" justify="space-between">
							<HStack spacing={3}>
								<Flex
									w="40px"
									h="40px"
									align="center"
									justify="center"
									borderRadius="12px"
									bg="panel.elevated"
									color="panel.text"
									border="1px solid"
									borderColor="panel.border"
									flexShrink={0}
								>
									<ArchiveBoxIcon width={20} height={20} />
								</Flex>
								<Box minW={0}>
									<Text fontSize="15px" fontWeight="700" color="panel.text">
										{t("dashboard.backup.import")}
									</Text>
									<Text
										fontSize="11px"
										fontWeight="500"
										color="panel.textMuted"
									>
										{t("dashboard.backup.importHint")}
									</Text>
								</Box>
							</HStack>
							<ModalCloseButton
								position="static"
								isDisabled={importMutation.isLoading}
							/>
						</Flex>
					</ModalHeader>
					<ModalBody px={6} py={5}>
						<Stack spacing={4}>
							<Alert status="warning" borderRadius="14px" fontSize="13px">
								<AlertIcon />
								<Text fontSize="12px">
									{t("dashboard.backup.autoDetectImportWarning")}
								</Text>
							</Alert>
							<FormControl isRequired>
								<FormLabel
									fontSize="13px"
									fontWeight="600"
									color="panel.textSecondary"
								>
									{t("dashboard.backup.file")}
								</FormLabel>
								<FileDropzone
									accept=".rbbackup,.tar.gz,.tgz,.zip,application/vnd.rebecca.backup,application/gzip,application/x-gzip,application/zip,application/x-tar,application/octet-stream"
									isDisabled={
										!backupActionsAvailable || importMutation.isLoading
									}
									selectedFile={selectedFile}
									title={t("dashboard.backup.dropTitle")}
									description={t("dashboard.backup.dropHint")}
									emptyText={t("dashboard.backup.selectFile")}
									onFileSelect={setSelectedFile}
								/>
							</FormControl>
							{importMutation.isLoading && uploadProgress !== null && (
								<Stack spacing={2} aria-live="polite">
									<Text fontSize="12px" fontWeight="600" color="panel.text">
										{uploadProgress < 100
											? t("dashboard.backup.uploadProgress", {
													percent: uploadProgress,
												})
											: t("dashboard.backup.processing")}
									</Text>
									<Progress
										value={uploadProgress}
										isIndeterminate={uploadProgress >= 100}
										colorScheme="primary"
										borderRadius="full"
										size="xs"
										h="5px"
									/>
								</Stack>
							)}
						</Stack>
					</ModalBody>
					<ModalFooter
						gap={2.5}
						px={6}
						py={4}
						borderTopWidth="1px"
						borderColor="panel.border"
						bg="panel.elevated"
					>
						<Button
							variant="ghost"
							size="sm"
							borderRadius="10px"
							color="panel.textSecondary"
							fontWeight="600"
							fontSize="12.5px"
							onClick={() => setDialog(null)}
							isDisabled={importMutation.isLoading}
							_hover={{ md: { bg: "panel.surface", color: "panel.text" } }}
						>
							{t("cancel")}
						</Button>
						<Button
							colorScheme="red"
							size="sm"
							borderRadius="10px"
							px={5}
							h="34px"
							fontWeight="600"
							fontSize="12.5px"
							leftIcon={<ArrowPathRoundedSquareIcon width={15} height={15} />}
							onClick={handleImport}
							isLoading={importMutation.isLoading}
						>
							{t("dashboard.backup.import")}
						</Button>
					</ModalFooter>
				</ModalContent>
			</Modal>

			<Modal
				isOpen={dialog === "export"}
				onClose={() => setDialog(null)}
				isCentered
				size="md"
				closeOnOverlayClick={!exportMutation.isLoading}
			>
				<ModalOverlay bg="blackAlpha.700" />
				<ModalContent
					borderWidth="1px"
					borderColor="panel.border"
					borderRadius="20px"
					boxShadow={cardHighlight}
					bg="panel.surface"
					mx={{ base: 4, sm: 0 }}
					overflow="hidden"
				>
					<ModalHeader
						px={6}
						pt={5}
						pb={4}
						borderBottomWidth="1px"
						borderColor="panel.border"
					>
						<Flex align="center" justify="space-between">
							<HStack spacing={3}>
								<Flex
									w="40px"
									h="40px"
									align="center"
									justify="center"
									borderRadius="12px"
									bg="panel.elevated"
									color="panel.text"
									border="1px solid"
									borderColor="panel.border"
									flexShrink={0}
								>
									<ArchiveBoxIcon width={20} height={20} />
								</Flex>
								<Box minW={0}>
									<Text fontSize="15px" fontWeight="700" color="panel.text">
										{t("dashboard.backup.exportTitle")}
									</Text>
									<Text
										fontSize="11px"
										fontWeight="500"
										color="panel.textMuted"
									>
										{t("dashboard.backup.exportHint")}
									</Text>
								</Box>
							</HStack>
							<ModalCloseButton
								position="static"
								isDisabled={exportMutation.isLoading}
							/>
						</Flex>
					</ModalHeader>
					<ModalBody px={6} py={5}>
						<Stack spacing={4}>
							<FormControl>
								<FormLabel
									fontSize="13px"
									fontWeight="600"
									color="panel.textSecondary"
								>
									{t("dashboard.backup.scope")}
								</FormLabel>
								<Select
									value={exportScope}
									borderRadius="10px"
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
						</Stack>
					</ModalBody>
					<ModalFooter
						gap={2.5}
						px={6}
						py={4}
						borderTopWidth="1px"
						borderColor="panel.border"
						bg="panel.elevated"
					>
						<Button
							variant="ghost"
							size="sm"
							borderRadius="10px"
							color="panel.textSecondary"
							fontWeight="600"
							fontSize="12.5px"
							onClick={() => setDialog(null)}
							isDisabled={exportMutation.isLoading}
							_hover={{ md: { bg: "panel.surface", color: "panel.text" } }}
						>
							{t("cancel")}
						</Button>
						<Button
							colorScheme="primary"
							size="sm"
							borderRadius="10px"
							px={5}
							h="34px"
							fontWeight="600"
							fontSize="12.5px"
							leftIcon={<DocumentArrowDownIcon width={15} height={15} />}
							onClick={() => exportMutation.mutate(exportScope)}
							isLoading={exportMutation.isLoading}
						>
							{t("dashboard.backup.download")}
						</Button>
					</ModalFooter>
				</ModalContent>
			</Modal>
		</>
	);
};
