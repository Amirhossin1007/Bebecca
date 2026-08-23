import {
	Alert,
	AlertIcon,
	Badge,
	Box,
	Button,
	Checkbox,
	Divider,
	FormControl,
	FormHelperText,
	FormLabel,
	Heading,
	HStack,
	Input,
	Link,
	Modal,
	ModalBody,
	ModalCloseButton,
	ModalContent,
	ModalFooter,
	ModalHeader,
	ModalOverlay,
	SimpleGrid,
	Spinner,
	Stack,
	Switch,
	Text,
	useColorModeValue,
	useToast,
	VStack,
} from "@chakra-ui/react";
import {
	ArrowTopRightOnSquareIcon,
	ArrowPathIcon,
	ArrowUpTrayIcon,
	CodeBracketIcon,
	Cog6ToothIcon,
	FolderOpenIcon,
	TrashIcon,
} from "@heroicons/react/24/outline";
import { PanelSelect as Select } from "components/common/PanelSelect";
import { ConfirmDialog } from "components/dialogs/ConfirmDialog";
import { ExternalAppFilesModal } from "components/ExternalAppFilesModal";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { Link as RouterLink } from "react-router-dom";
import {
	deleteExternalApp,
	getExternalApps,
	getSubscriptionSettings,
	installMirzaBot,
	installExternalArchive,
	setExternalAppEnabled,
	updateExternalAppSettings,
	updateExternalMirzaBot,
	type ExternalAppRecord,
} from "service/settings";

type TemplateID = "archive" | "mirzabot";

const errorDetail = (error: unknown) => {
	const candidate = error as {
		data?: { detail?: string };
		response?: { _data?: { detail?: string } };
		message?: string;
	};
	return (
		candidate?.data?.detail ||
		candidate?.response?._data?.detail ||
		candidate?.message ||
		String(error)
	);
};

export const ExternalAppsPage = () => {
	const { t } = useTranslation();
	const toast = useToast();
	const queryClient = useQueryClient();
	const panelBg = useColorModeValue("panel.elevated", "panel.elevated");
	const borderColor = useColorModeValue("panel.border", "panel.border");
	const mutedColor = useColorModeValue(
		"panel.textSecondary",
		"panel.textSecondary",
	);
	const [template, setTemplate] = useState<TemplateID>("mirzabot");
	const [domain, setDomain] = useState("");
	const [name, setName] = useState("");
	const [archive, setArchive] = useState<File | null>(null);
	const [botToken, setBotToken] = useState("");
	const [adminID, setAdminID] = useState("");
	const [hasDatabaseBackup, setHasDatabaseBackup] = useState(false);
	const [databaseBackup, setDatabaseBackup] = useState<File | null>(null);
	const [deleteTarget, setDeleteTarget] = useState<ExternalAppRecord | null>(
		null,
	);
	const [updateTarget, setUpdateTarget] = useState<ExternalAppRecord | null>(
		null,
	);
	const [settingsTarget, setSettingsTarget] =
		useState<ExternalAppRecord | null>(null);
	const [indexFile, setIndexFile] = useState("");
	const [fallbackToIndex, setFallbackToIndex] = useState(false);
	const [keepDatabase, setKeepDatabase] = useState(true);
	const [managedApp, setManagedApp] = useState<ExternalAppRecord | null>(null);
	const [managerView, setManagerView] = useState<"file" | "php-config">("file");

	const appsQuery = useQuery("external-apps", getExternalApps, {
		refetchOnWindowFocus: false,
	});
	const certificatesQuery = useQuery(
		"subscription-settings",
		getSubscriptionSettings,
		{ refetchOnWindowFocus: false },
	);
	const apps = appsQuery.data?.apps ?? [];
	const usedRootDomains = useMemo(
		() => new Set(apps.filter((app) => !app.path).map((app) => app.domain)),
		[apps],
	);
	const certificateOptions = useMemo(() => {
		const seen = new Set<string>();
		return (certificatesQuery.data?.certificates ?? [])
			.filter(
				(certificate) =>
					certificate.serve_tls &&
					(certificate.status === "active" ||
						certificate.status === "expiring"),
			)
			.flatMap((certificate) => [certificate.domain, ...certificate.alt_names])
			.filter((name) => {
				const key = name.toLowerCase();
				if (
					key === window.location.hostname.toLowerCase() ||
					seen.has(key) ||
					(template === "archive" && usedRootDomains.has(key))
				)
					return false;
				seen.add(key);
				return true;
			})
			.map((name) => ({ value: name, label: name, searchLabel: name }));
	}, [certificatesQuery.data?.certificates, template, usedRootDomains]);
	const selectedTemplate = appsQuery.data?.templates.find(
		(item) => item.id === template,
	);

	const installMutation = useMutation(
		async () => {
			if (!domain) throw new Error(t("externalApps.errors.domainRequired"));
			if (template === "archive") {
				if (!archive) throw new Error(t("externalApps.errors.archiveRequired"));
				return installExternalArchive({ domain, name, archive });
			}
			if (!botToken.trim() || !adminID.trim()) {
				throw new Error(t("externalApps.errors.mirzaFieldsRequired"));
			}
			if (hasDatabaseBackup && !databaseBackup) {
				throw new Error(t("externalApps.errors.databaseBackupRequired"));
			}
			return installMirzaBot({
				domain,
				bot_token: botToken.trim(),
				admin_id: adminID.trim(),
				database_backup: hasDatabaseBackup
					? (databaseBackup ?? undefined)
					: undefined,
			});
		},
		{
			onSuccess: async () => {
				toast({
					title: t("externalApps.installSuccess"),
					status: "success",
					isClosable: true,
				});
				setDomain("");
				setName("");
				setArchive(null);
				setBotToken("");
				setAdminID("");
				setHasDatabaseBackup(false);
				setDatabaseBackup(null);
				await queryClient.invalidateQueries("external-apps");
			},
			onError: (error) => {
				toast({
					title: t("externalApps.installFailed"),
					description: errorDetail(error),
					status: "error",
					isClosable: true,
				});
			},
		},
	);

	const toggleMutation = useMutation(setExternalAppEnabled, {
		onSuccess: () => queryClient.invalidateQueries("external-apps"),
		onError: (error) => {
			toast({
				title: t("externalApps.actionFailed"),
				description: errorDetail(error),
				status: "error",
				isClosable: true,
			});
		},
	});

	const deleteMutation = useMutation(deleteExternalApp, {
		onSuccess: () => {
			toast({ title: t("externalApps.deleteSuccess"), status: "success" });
			setDeleteTarget(null);
			queryClient.invalidateQueries("external-apps");
		},
		onError: (error) => {
			toast({
				title: t("externalApps.actionFailed"),
				description: errorDetail(error),
				status: "error",
				isClosable: true,
			});
		},
	});

	const updateMutation = useMutation(updateExternalMirzaBot, {
		onSuccess: (app) => {
			toast({
				title: t("externalApps.updateSuccess", { version: app.version }),
				status: "success",
			});
			setUpdateTarget(null);
			queryClient.invalidateQueries("external-apps");
		},
		onError: (error) => {
			toast({
				title: t("externalApps.updateFailed"),
				description: errorDetail(error),
				status: "error",
				isClosable: true,
			});
		},
	});

	const settingsMutation = useMutation(updateExternalAppSettings, {
		onSuccess: () => {
			toast({ title: t("externalApps.settingsSaved"), status: "success" });
			setSettingsTarget(null);
			queryClient.invalidateQueries("external-apps");
		},
		onError: (error) => {
			toast({
				title: t("externalApps.actionFailed"),
				description: errorDetail(error),
				status: "error",
				isClosable: true,
			});
		},
	});

	const confirmDelete = (app: ExternalAppRecord) => {
		setKeepDatabase(app.has_database);
		setDeleteTarget(app);
	};
	const openManager = (app: ExternalAppRecord, view: "file" | "php-config") => {
		setManagerView(view);
		setManagedApp(app);
	};
	const openSettings = (app: ExternalAppRecord) => {
		setIndexFile(app.index_file);
		setFallbackToIndex(app.fallback_to_index);
		setSettingsTarget(app);
	};

	if (appsQuery.isLoading) {
		return (
			<VStack minH="50vh" justify="center">
				<Spinner />
			</VStack>
		);
	}

	return (
		<Stack spacing={5}>
			<ConfirmDialog
				isOpen={Boolean(updateTarget)}
				title={t("externalApps.update")}
				description={t("externalApps.updateConfirm", {
					version: updateTarget?.latest_version,
				})}
				confirmLabel={t("externalApps.update")}
				isLoading={updateMutation.isLoading}
				onClose={() => setUpdateTarget(null)}
				onConfirm={async () => {
					if (updateTarget) await updateMutation.mutateAsync(updateTarget.id);
				}}
			/>
			<ConfirmDialog
				isOpen={Boolean(deleteTarget)}
				title={t("externalApps.delete")}
				description={
					<Stack spacing={3}>
						<Text>
							{t("externalApps.deleteConfirm", {
								name: deleteTarget?.name,
							})}
						</Text>
						{deleteTarget?.has_database ? (
							<Checkbox
								isChecked={keepDatabase}
								onChange={(event) => setKeepDatabase(event.target.checked)}
							>
								{t("externalApps.keepDatabase")}
							</Checkbox>
						) : null}
					</Stack>
				}
				confirmLabel={t("externalApps.delete")}
				colorScheme="red"
				isLoading={deleteMutation.isLoading}
				onClose={() => setDeleteTarget(null)}
				onConfirm={async () => {
					if (!deleteTarget) return;
					await deleteMutation.mutateAsync({
						id: deleteTarget.id,
						keep_database: deleteTarget.has_database && keepDatabase,
					});
				}}
			/>
			<ExternalAppFilesModal
				app={managedApp}
				initialView={managerView}
				onClose={() => setManagedApp(null)}
			/>
			<Modal
				isOpen={Boolean(settingsTarget)}
				onClose={() => setSettingsTarget(null)}
				size="md"
			>
				<ModalOverlay bg="blackAlpha.500" backdropFilter="blur(8px)" />
				<ModalContent bg={panelBg}>
					<ModalHeader>{t("externalApps.settingsTitle")}</ModalHeader>
					<ModalCloseButton />
					<ModalBody>
						<Stack spacing={4}>
							<FormControl isRequired>
								<FormLabel>{t("externalApps.indexFile")}</FormLabel>
								<Input
									value={indexFile}
									onChange={(event) => setIndexFile(event.target.value)}
									placeholder="index.php"
									autoComplete="off"
								/>
								<FormHelperText>
									{t("externalApps.indexFileHint")}
								</FormHelperText>
							</FormControl>
							<Checkbox
								isChecked={fallbackToIndex}
								onChange={(event) => setFallbackToIndex(event.target.checked)}
							>
								<Stack spacing={0}>
									<Text>{t("externalApps.fallbackToIndex")}</Text>
									<Text color={mutedColor} fontSize="sm">
										{t("externalApps.fallbackToIndexHint")}
									</Text>
								</Stack>
							</Checkbox>
						</Stack>
					</ModalBody>
					<ModalFooter gap={3}>
						<Button variant="ghost" onClick={() => setSettingsTarget(null)}>
							{t("close")}
						</Button>
						<Button
							colorScheme="blue"
							isLoading={settingsMutation.isLoading}
							isDisabled={!indexFile.trim()}
							onClick={() => {
								if (!settingsTarget) return;
								settingsMutation.mutate({
									id: settingsTarget.id,
									index_file: indexFile.trim(),
									fallback_to_index: fallbackToIndex,
								});
							}}
						>
							{t("save")}
						</Button>
					</ModalFooter>
				</ModalContent>
			</Modal>
			<Box>
				<Heading size="lg">{t("externalApps.title")}</Heading>
				<Text color={mutedColor} mt={2}>
					{t("externalApps.description")}
				</Text>
			</Box>

			<Alert status="info" borderRadius="md">
				<AlertIcon />
				<Text fontSize="sm">{t("externalApps.resourceHint")}</Text>
			</Alert>

			<Box
				bg={panelBg}
				borderWidth="1px"
				borderColor={borderColor}
				borderRadius="md"
				p={{ base: 4, md: 5 }}
			>
				<Heading size="md" mb={4}>
					{t("externalApps.newApp")}
				</Heading>
				{!appsQuery.data?.supported ? (
					<Alert status="warning" mb={4} borderRadius="md">
						<AlertIcon />
						{appsQuery.data?.detail || t("externalApps.unsupported")}
					</Alert>
				) : null}
				<SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
					<FormControl>
						<FormLabel>{t("externalApps.template")}</FormLabel>
						<Select
							value={template}
							onValueChange={(value) => setTemplate(value as TemplateID)}
							options={[
								{ value: "mirzabot", label: t("externalApps.mirzaTemplate") },
								{ value: "archive", label: t("externalApps.archiveTemplate") },
							]}
						/>
						{template === "mirzabot" && selectedTemplate?.source_url ? (
							<Link
								href={selectedTemplate.source_url}
								isExternal
								display="inline-flex"
								alignItems="center"
								gap={1}
								mt={2}
								fontSize="sm"
								color="blue.300"
							>
								{t("externalApps.latestRelease")}
								<ArrowTopRightOnSquareIcon width={14} />
							</Link>
						) : null}
					</FormControl>
					<FormControl isRequired>
						<FormLabel>{t("externalApps.domainCertificate")}</FormLabel>
						<Select
							value={domain}
							onValueChange={(value) => setDomain(String(value))}
							options={certificateOptions}
							placeholder={t("externalApps.selectDomain")}
							showSearch
							emptyText={t("externalApps.noCertificates")}
						/>
						<FormHelperText>
							{t("externalApps.certificateHint")}{" "}
							<Link
								as={RouterLink}
								to="/settings#subscriptions"
								color="blue.300"
							>
								{t("externalApps.openSSLManager")}
							</Link>
						</FormHelperText>
					</FormControl>
				</SimpleGrid>

				{template === "mirzabot" ? (
					<Stack mt={4} spacing={3}>
						<SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
							<FormControl isRequired>
								<FormLabel>{t("externalApps.botToken")}</FormLabel>
								<Input
									type="password"
									value={botToken}
									onChange={(event) => setBotToken(event.target.value)}
									autoComplete="off"
								/>
							</FormControl>
							<FormControl isRequired>
								<FormLabel>{t("externalApps.telegramAdminID")}</FormLabel>
								<Input
									value={adminID}
									onChange={(event) => setAdminID(event.target.value)}
									inputMode="numeric"
								/>
							</FormControl>
						</SimpleGrid>
						<Checkbox
							isChecked={hasDatabaseBackup}
							onChange={(event) => {
								setHasDatabaseBackup(event.target.checked);
								if (!event.target.checked) setDatabaseBackup(null);
							}}
						>
							{t("externalApps.databaseBackupToggle")}
						</Checkbox>
						{hasDatabaseBackup ? (
							<FormControl isRequired>
								<FormLabel>{t("externalApps.databaseBackup")}</FormLabel>
								<Input
									type="file"
									accept=".sql,application/sql,text/sql,text/plain"
									pt={1}
									onChange={(event) =>
										setDatabaseBackup(event.target.files?.[0] ?? null)
									}
								/>
								<FormHelperText>
									{t("externalApps.databaseBackupHint")}
								</FormHelperText>
							</FormControl>
						) : null}
					</Stack>
				) : (
					<SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} mt={4}>
						<FormControl>
							<FormLabel>{t("externalApps.name")}</FormLabel>
							<Input
								value={name}
								onChange={(event) => setName(event.target.value)}
							/>
						</FormControl>
						<FormControl isRequired>
							<FormLabel>{t("externalApps.zipArchive")}</FormLabel>
							<Input
								type="file"
								accept=".zip,application/zip"
								pt={1}
								onChange={(event) =>
									setArchive(event.target.files?.[0] ?? null)
								}
							/>
							<FormHelperText>{t("externalApps.archiveHint")}</FormHelperText>
						</FormControl>
					</SimpleGrid>
				)}

				<Button
					mt={5}
					colorScheme="blue"
					leftIcon={<ArrowUpTrayIcon width={18} />}
					isLoading={installMutation.isLoading}
					isDisabled={
						!appsQuery.data?.supported ||
						selectedTemplate?.supported === false ||
						!domain
					}
					onClick={() => installMutation.mutate()}
				>
					{t("externalApps.install")}
				</Button>
				{selectedTemplate?.detail ? (
					<Text color="orange.300" fontSize="sm" mt={2}>
						{selectedTemplate.detail}
					</Text>
				) : null}
			</Box>

			<Box
				bg={panelBg}
				borderWidth="1px"
				borderColor={borderColor}
				borderRadius="md"
				p={{ base: 4, md: 5 }}
			>
				<Heading size="md" mb={4}>
					{t("externalApps.installedApps")}
				</Heading>
				{apps.length === 0 ? (
					<Text color={mutedColor}>{t("externalApps.empty")}</Text>
				) : (
					<Stack spacing={3} divider={<Divider />}>
						{apps.map((app) => (
							<Box key={app.id} py={2}>
								<Stack
									direction={{ base: "column", lg: "row" }}
									justify="space-between"
									align={{ base: "stretch", lg: "center" }}
									spacing={3}
								>
									<Box>
										<HStack spacing={2} flexWrap="wrap">
											<Text fontWeight="semibold">{app.name}</Text>
											<Badge colorScheme={app.enabled ? "green" : "gray"}>
												{app.enabled
													? t("externalApps.enabled")
													: t("externalApps.disabled")}
											</Badge>
											<Badge>
												{app.template === "mirzabot"
													? "MirzaBot"
													: app.runtime.toUpperCase()}
											</Badge>
										</HStack>
										<Text color={mutedColor} fontSize="sm" mt={1}>
											{app.public_url}
											{app.bot_username ? ` · @${app.bot_username}` : ""}
											{app.php_version ? ` · PHP ${app.php_version}` : ""}
											{app.version ? ` · ${app.version}` : ""}
										</Text>
									</Box>
									<HStack spacing={3} flexWrap="wrap">
										{app.update_available ? (
											<Button
												size="sm"
												colorScheme="blue"
												leftIcon={<ArrowPathIcon width={16} />}
												onClick={() => setUpdateTarget(app)}
											>
												{t("externalApps.update")}
											</Button>
										) : null}
										<Button
											size="sm"
											variant="outline"
											leftIcon={<FolderOpenIcon width={16} />}
											onClick={() => openManager(app, "file")}
										>
											{t("externalApps.files.button")}
										</Button>
										{app.runtime === "php" ? (
											<Button
												size="sm"
												variant="outline"
												leftIcon={<CodeBracketIcon width={16} />}
												onClick={() => openManager(app, "php-config")}
											>
												{t("externalApps.files.phpConfig")}
											</Button>
										) : null}
										<Button
											size="sm"
											variant="outline"
											leftIcon={<Cog6ToothIcon width={16} />}
											onClick={() => openSettings(app)}
										>
											{t("externalApps.settings")}
										</Button>
										<Link href={app.public_url} isExternal>
											<Button
												size="sm"
												variant="outline"
												rightIcon={<ArrowTopRightOnSquareIcon width={16} />}
											>
												{t("externalApps.open")}
											</Button>
										</Link>
										<Switch
											isChecked={app.enabled}
											isDisabled={toggleMutation.isLoading}
											onChange={(event) =>
												toggleMutation.mutate({
													id: app.id,
													enabled: event.target.checked,
												})
											}
										/>
										<Button
											size="sm"
											variant="ghost"
											colorScheme="red"
											leftIcon={<TrashIcon width={16} />}
											isLoading={deleteMutation.isLoading}
											onClick={() => confirmDelete(app)}
										>
											{t("externalApps.delete")}
										</Button>
									</HStack>
								</Stack>
							</Box>
						))}
					</Stack>
				)}
			</Box>
		</Stack>
	);
};

export default ExternalAppsPage;
