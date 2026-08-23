import {
	Alert,
	AlertIcon,
	Box,
	Button,
	Code,
	Flex,
	Modal,
	ModalBody,
	ModalCloseButton,
	ModalContent,
	ModalHeader,
	ModalOverlay,
	Spinner,
	Text,
	useColorMode,
	useColorModeValue,
	useToast,
} from "@chakra-ui/react";
import {
	ArrowLeftIcon,
	CodeBracketIcon,
	DocumentPlusIcon,
	FolderOpenIcon,
} from "@heroicons/react/24/outline";
import { FileManager, type FileManagerFile } from "@cubone/react-file-manager";
import "@cubone/react-file-manager/dist/style.css";
import "ace-builds/src-noconflict/ace";
import AceEditor from "react-ace";
import "ace-builds/src-noconflict/ext-language_tools";
import "ace-builds/src-noconflict/mode-css";
import "ace-builds/src-noconflict/mode-golang";
import "ace-builds/src-noconflict/mode-html";
import "ace-builds/src-noconflict/mode-ini";
import "ace-builds/src-noconflict/mode-java";
import "ace-builds/src-noconflict/mode-javascript";
import "ace-builds/src-noconflict/mode-json";
import "ace-builds/src-noconflict/mode-markdown";
import "ace-builds/src-noconflict/mode-php";
import "ace-builds/src-noconflict/mode-python";
import "ace-builds/src-noconflict/mode-rust";
import "ace-builds/src-noconflict/mode-sh";
import "ace-builds/src-noconflict/mode-sql";
import "ace-builds/src-noconflict/mode-text";
import "ace-builds/src-noconflict/mode-typescript";
import "ace-builds/src-noconflict/mode-xml";
import "ace-builds/src-noconflict/mode-yaml";
import "ace-builds/src-noconflict/theme-github";
import "ace-builds/src-noconflict/theme-monokai";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "react-query";
import {
	createExternalAppFolder,
	deleteExternalAppFiles,
	getExternalAppPHPConfig,
	getExternalAppFile,
	getExternalAppFiles,
	moveExternalAppFile,
	externalAppFileDownloadURL,
	externalAppFileUploadURL,
	saveExternalAppPHPConfig,
	saveExternalAppFile,
	type ExternalAppRecord,
} from "service/settings";
import "./ExternalAppFilesModal.css";

type EditorKind = "file" | "php-config";

interface EditorDocument {
	kind: EditorKind;
	path: string;
	content: string;
}

interface Props {
	app: ExternalAppRecord | null;
	initialView?: EditorKind;
	onClose: () => void;
}

const joinPath = (parent: string, name: string) =>
	`${parent === "/" || !parent ? "" : parent}/${name}`.replace(/\/+/g, "/");

const parentPath = (value: string) => {
	const parts = value.split("/").filter(Boolean);
	parts.pop();
	return parts.length ? `/${parts.join("/")}` : "/";
};

export const editorModeForPath = (value: string) => {
	const extension = value.split(".").pop()?.toLowerCase() || "";
	return (
		{
			php: "php",
			phtml: "php",
			html: "html",
			htm: "html",
			css: "css",
			js: "javascript",
			jsx: "javascript",
			mjs: "javascript",
			ts: "typescript",
			tsx: "typescript",
			json: "json",
			yaml: "yaml",
			yml: "yaml",
			sh: "sh",
			bash: "sh",
			py: "python",
			sql: "sql",
			xml: "xml",
			md: "markdown",
			go: "golang",
			java: "java",
			rs: "rust",
			conf: "ini",
			ini: "ini",
		}[extension] || "text"
	);
};

export const ExternalAppFilesModal = ({
	app,
	initialView = "file",
	onClose,
}: Props) => {
	const { t, i18n } = useTranslation();
	const { colorMode } = useColorMode();
	const modalBg = useColorModeValue("white", "gray.900");
	const toast = useToast();
	const [folder, setFolder] = useState("/");
	const [document, setDocument] = useState<EditorDocument | null>(null);
	const [draft, setDraft] = useState("");
	const [loadingDocument, setLoadingDocument] = useState(false);
	const domain = app?.domain || "";
	const appID = app?.id || "";
	const isPHPConfigView = initialView === "php-config";
	const filesQuery = useQuery(
		["external-app-files", appID],
		() => getExternalAppFiles(appID),
		{
			enabled: Boolean(appID) && !isPHPConfigView,
			refetchOnWindowFocus: false,
		},
	);
	const isDirty = document !== null && draft !== document.content;

	const showError = useCallback(
		(error: unknown) => {
			const candidate = error as {
				data?: { detail?: string };
				response?: { _data?: { detail?: string } };
				message?: string;
			};
			toast({
				title: t("externalApps.files.actionFailed"),
				description:
					candidate?.data?.detail ||
					candidate?.response?._data?.detail ||
					candidate?.message ||
					String(error),
				status: "error",
				isClosable: true,
			});
		},
		[t, toast],
	);

	const refreshFiles = useCallback(async () => {
		await filesQuery.refetch();
	}, [filesQuery.refetch]);

	const fileMutation = useMutation(
		(action: () => Promise<unknown>) => action(),
		{ onSettled: refreshFiles, onError: showError },
	);

	const openFile = useCallback(
		async (path: string, discardConfirmed = false) => {
			if (!app) return;
			if (
				isDirty &&
				!discardConfirmed &&
				!window.confirm(t("externalApps.files.discardConfirm"))
			)
				return;
			setLoadingDocument(true);
			try {
				const result = await getExternalAppFile(app.id, path);
				setDocument({
					kind: "file",
					path: result.path,
					content: result.content,
				});
				setDraft(result.content);
			} catch (error) {
				showError(error);
			} finally {
				setLoadingDocument(false);
			}
		},
		[app, isDirty, showError, t],
	);

	useEffect(() => {
		let cancelled = false;
		setFolder("/");
		setDocument(null);
		setDraft("");
		setLoadingDocument(false);
		if (!appID || app?.runtime !== "php" || initialView !== "php-config") {
			return;
		}
		setLoadingDocument(true);
		getExternalAppPHPConfig(appID)
			.then((result) => {
				if (cancelled) return;
				setDocument({
					kind: "php-config",
					path: result.path,
					content: result.content,
				});
				setDraft(result.content);
			})
			.catch((error) => {
				if (!cancelled) showError(error);
			})
			.finally(() => {
				if (!cancelled) setLoadingDocument(false);
			});
		return () => {
			cancelled = true;
		};
	}, [app?.runtime, appID, initialView, showError]);

	const saveMutation = useMutation(
		async () => {
			if (!app || !document) return;
			if (document.kind === "php-config") {
				await saveExternalAppPHPConfig({ domain: app.id, content: draft });
			} else {
				await saveExternalAppFile({
					domain: app.id,
					path: document.path,
					content: draft,
				});
			}
		},
		{
			onSuccess: async () => {
				setDocument((current) =>
					current ? { ...current, content: draft } : current,
				);
				if (document?.kind === "file") await refreshFiles();
				toast({ title: t("externalApps.files.saved"), status: "success" });
			},
			onError: showError,
		},
	);

	const close = () => {
		if (isDirty && !window.confirm(t("externalApps.files.discardConfirm")))
			return;
		onClose();
	};
	const closeDocument = () => {
		if (isDirty && !window.confirm(t("externalApps.files.discardConfirm")))
			return;
		setDocument(null);
		setDraft("");
	};

	const createFile = () => {
		if (!app) return;
		if (isDirty && !window.confirm(t("externalApps.files.discardConfirm")))
			return;
		const name = window.prompt(t("externalApps.files.newFilePrompt"))?.trim();
		if (!name) return;
		const path = joinPath(folder, name);
		fileMutation.mutate(async () => {
			await saveExternalAppFile({ domain: app.id, path, content: "" });
			await openFile(path, true);
		});
	};

	const downloadFiles = (files: FileManagerFile[]) => {
		if (!app) return;
		const file = files.find((item) => !item.isDirectory);
		if (!file || files.length !== 1) {
			showError(new Error(t("externalApps.files.downloadOne")));
			return;
		}
		const anchor = window.document.createElement("a");
		anchor.href = externalAppFileDownloadURL(app.id, file.path);
		anchor.download = file.name;
		anchor.click();
	};

	return (
		<Modal isOpen={Boolean(app)} onClose={close} size="full">
			<ModalOverlay />
			<ModalContent bg={modalBg} h="100dvh" maxH="100dvh">
				<ModalHeader px={{ base: 3, md: 6 }} py={{ base: 3, md: 4 }}>
					<Flex align="center" gap={3} pe={10} minW={0}>
						{isPHPConfigView ? (
							<CodeBracketIcon width={22} />
						) : (
							<FolderOpenIcon width={22} />
						)}
						<Text noOfLines={1} minW={0}>
							{t(
								isPHPConfigView
									? "externalApps.files.phpConfigTitle"
									: "externalApps.files.title",
								{ domain },
							)}
						</Text>
						{document ? (
							<Code
								fontSize="xs"
								maxW="45%"
								noOfLines={1}
								display={{ base: "none", md: "block" }}
							>
								{document.path}
							</Code>
						) : null}
					</Flex>
				</ModalHeader>
				<ModalCloseButton />
				<ModalBody
					display="flex"
					minH={0}
					overflow="hidden"
					px={{ base: 2, md: 4 }}
					pb={{ base: 2, md: 4 }}
				>
					<Flex gap={4} flex="1" minH={0} minW={0} w="full">
						{!isPHPConfigView ? (
							<Box
								flex="1"
								minW={0}
								minH={0}
								display={{ base: document ? "none" : "flex", lg: "flex" }}
								flexDirection="column"
							>
								<Flex mb={2} flex="0 0 auto">
									<Button
										size="sm"
										leftIcon={<DocumentPlusIcon width={16} />}
										onClick={createFile}
									>
										{t("externalApps.files.newFile")}
									</Button>
								</Flex>
								<Box flex="1" minH={0} minW={0}>
									<FileManager
										files={filesQuery.data?.files ?? []}
										className={`external-app-files${
											colorMode === "dark" ? " external-app-files--dark" : ""
										}`}
										collapsibleNav
										enableFilePreview={false}
										fileUploadConfig={{
											url: externalAppFileUploadURL(appID),
											method: "POST",
											withCredentials: true,
										}}
										height="100%"
										isLoading={filesQuery.isLoading || fileMutation.isLoading}
										language={
											i18n.language.startsWith("fa") ? "fa-IR" : "en-US"
										}
										layout="list"
										maxFileSize={32 << 20}
										onCreateFolder={(name, parent) =>
											fileMutation.mutate(() =>
												createExternalAppFolder({
													domain: appID,
													path: joinPath(parent?.path || "/", name),
												}),
											)
										}
										onDelete={(files) =>
											fileMutation.mutate(() =>
												deleteExternalAppFiles({
													domain: appID,
													paths: files.map((file) => file.path),
												}),
											)
										}
										onDownload={downloadFiles}
										onError={(error) => showError(new Error(error.message))}
										onFileOpen={(file) => {
											if (!file.isDirectory) void openFile(file.path);
										}}
										onFileUploaded={() => void refreshFiles()}
										onFileUploading={(_file, parent) => ({
											parent: parent?.path || "/",
										})}
										onFolderChange={(path) => setFolder(path || "/")}
										onPaste={(files, destination, operation) => {
											if (operation !== "move") return;
											fileMutation.mutate(async () => {
												for (const file of files) {
													await moveExternalAppFile({
														domain: appID,
														path: file.path,
														new_path: joinPath(
															destination.path || "/",
															file.name,
														),
													});
												}
											});
										}}
										onRefresh={() => void refreshFiles()}
										onRename={(file, newName) =>
											fileMutation.mutate(() =>
												moveExternalAppFile({
													domain: appID,
													path: file.path,
													new_path: joinPath(parentPath(file.path), newName),
												}),
											)
										}
										permissions={{ copy: false }}
										primaryColor="#4299e1"
									/>
								</Box>
							</Box>
						) : null}
						<Box
							flex="1"
							minW={0}
							minH={0}
							display={
								isPHPConfigView
									? "flex"
									: { base: document ? "flex" : "none", lg: "flex" }
							}
							flexDirection="column"
						>
							{document?.kind === "php-config" ? (
								<Alert status="warning" mb={2} borderRadius="md" py={2}>
									<AlertIcon />
									<Text fontSize="sm">
										{t("externalApps.files.phpConfigHint")}
									</Text>
								</Alert>
							) : null}
							<Flex
								justify="space-between"
								align="center"
								gap={2}
								mb={2}
								minH="32px"
							>
								{!isPHPConfigView ? (
									<Button
										display={{ base: "inline-flex", lg: "none" }}
										size="sm"
										leftIcon={<ArrowLeftIcon width={16} />}
										onClick={closeDocument}
									>
										{t("externalApps.files.backToFiles")}
									</Button>
								) : null}
								<Text
									flex="1"
									minW={0}
									fontSize="sm"
									color="panel.textSecondary"
									noOfLines={1}
								>
									{document?.path || t("externalApps.files.openHint")}
								</Text>
								<Button
									size="sm"
									colorScheme="blue"
									isDisabled={!document || !isDirty}
									isLoading={saveMutation.isLoading}
									onClick={() => saveMutation.mutate()}
								>
									{t("externalApps.files.save")}
								</Button>
							</Flex>
							<Box flex="1" minH={0} position="relative">
								{loadingDocument ? (
									<Flex
										position="absolute"
										inset={0}
										align="center"
										justify="center"
										zIndex={1}
										bg="blackAlpha.400"
									>
										<Spinner />
									</Flex>
								) : null}
								{document ? (
									<AceEditor
										name={
											isPHPConfigView
												? "external-app-php-editor"
												: "external-app-editor"
										}
										mode={
											document.kind === "php-config"
												? "ini"
												: editorModeForPath(document.path)
										}
										theme={colorMode === "dark" ? "monokai" : "github"}
										value={draft}
										onChange={setDraft}
										width="100%"
										height="100%"
										fontSize={14}
										setOptions={{
											enableBasicAutocompletion: true,
											enableLiveAutocompletion: true,
											showPrintMargin: false,
											useWorker: false,
										}}
									/>
								) : (
									<Flex h="full" align="center" justify="center" px={6}>
										<Text color="panel.textSecondary" textAlign="center">
											{t("externalApps.files.openHint")}
										</Text>
									</Flex>
								)}
							</Box>
						</Box>
					</Flex>
				</ModalBody>
			</ModalContent>
		</Modal>
	);
};
