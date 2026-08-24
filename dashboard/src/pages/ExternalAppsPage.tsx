import {
	Alert,
	AlertIcon,
	Badge,
	Box,
	Button,
	Checkbox,
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
import {
	DataTable,
	ResourceListCard,
	type DataTableColumn,
	type DataTableRowAction,
} from "components/ui";
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
	const [maxRequestBodyMB, setMaxRequestBodyMB] = useState(32);
	const [staticCacheSeconds, setStaticCacheSeconds] = useState(3600);
	const [notFoundFile, setNotFoundFile] = useState("");
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
		setMaxRequestBodyMB(app.max_request_body_mb || 32);
		setStaticCacheSeconds(app.static_cache_seconds ?? 3600);
		setNotFoundFile(app.not_found_file || "");
		setSettingsTarget(app);
	};

	const appColumns = useMemo<DataTableColumn<ExternalAppRecord>[]>(
		() => [
			{
				id: "name",
				header: t("externalApps.name"),
				isPrimary: true,
				priority: "primary",
				mobilePriority: 0,
				cell: (app) => (
					<Stack spacing={0} minW={0} align="start">
						<Text fontWeight="semibold" noOfLines={1}>
							{app.name}
						</Text>
						<Text color={mutedColor} fontSize="xs" noOfLines={1}>
							{app.bot_username ? `@${app.bot_username}` : app.id}
						</Text>
					</Stack>
				),
			},
			{
				id: "url",
				header: t("externalApps.domainCertificate"),
				priority: "high",
				mobilePriority: 1,
				mobileMetaLabel: t("externalApps.domainCertificate"),
				cell: (app) => (
					<Text dir="ltr" noOfLines={1} title={app.public_url}>
						{app.domain}
						{app.path ? `/${app.path}` : ""}
					</Text>
				),
			},
			{
				id: "runtime",
				header: t("externalApps.runtime"),
				priority: "medium",
				mobilePriority: 2,
				mobileMetaLabel: t("externalApps.runtime"),
				cell: (app) => (
					<HStack spacing={1.5} flexWrap="wrap">
						<Badge>
							{app.template === "mirzabot"
								? "MirzaBot"
								: app.runtime.toUpperCase()}
						</Badge>
						{app.php_version ? (
							<Badge colorScheme="purple">PHP {app.php_version}</Badge>
						) : null}
						{app.version ? (
							<Badge colorScheme="blue">{app.version}</Badge>
						) : null}
					</HStack>
				),
			},
			{
				id: "status",
				header: t("status"),
				priority: "high",
				mobilePriority: 3,
				mobileMetaLabel: t("status"),
				cell: (app) => (
					<Badge colorScheme={app.enabled ? "green" : "gray"}>
						{app.enabled
							? t("externalApps.enabled")
							: t("externalApps.disabled")}
					</Badge>
				),
			},
			{
				id: "installed_at",
				header: t("externalApps.installedAt"),
				priority: "low",
				hideBelow: "xl",
				mobileMetaLabel: t("externalApps.installedAt"),
				cell: (app) => (
					<Text fontSize="sm">
						{app.installed_at
							? new Date(app.installed_at).toLocaleString()
							: "—"}
					</Text>
				),
			},
		],
		[mutedColor, t],
	);

	const appRowActions = (
		app: ExternalAppRecord,
	): DataTableRowAction<ExternalAppRecord>[] => {
		const actions: DataTableRowAction<ExternalAppRecord>[] = [];
		if (app.update_available) {
			actions.push({
				id: "update",
				label: t("externalApps.update"),
				icon: <ArrowPathIcon width={16} />,
				onClick: () => setUpdateTarget(app),
			});
		}
		actions.push(
			{
				id: "files",
				label: t("externalApps.files.button"),
				icon: <FolderOpenIcon width={16} />,
				onClick: () => openManager(app, "file"),
			},
			...(app.runtime === "php"
				? [
						{
							id: "php-settings",
							label: t("externalApps.files.phpConfig"),
							icon: <CodeBracketIcon width={16} />,
							onClick: () => openManager(app, "php-config"),
						},
					]
				: []),
			{
				id: "settings",
				label: t("externalApps.settings"),
				icon: <Cog6ToothIcon width={16} />,
				onClick: () => openSettings(app),
			},
			{
				id: "open",
				label: t("externalApps.open"),
				icon: <ArrowTopRightOnSquareIcon width={16} />,
				onClick: () =>
					window.open(app.public_url, "_blank", "noopener,noreferrer"),
			},
			{
				id: "toggle",
				label: app.enabled
					? t("externalApps.disable")
					: t("externalApps.enable"),
				onClick: () =>
					toggleMutation.mutate({ id: app.id, enabled: !app.enabled }),
				isDisabled: toggleMutation.isLoading,
			},
			{
				id: "delete",
				label: t("externalApps.delete"),
				icon: <TrashIcon width={16} />,
				onClick: () => confirmDelete(app),
				isDisabled: deleteMutation.isLoading,
				isDanger: true,
			},
		);
		return actions;
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
				size="xl"
			>
				<ModalOverlay bg="blackAlpha.500" backdropFilter="blur(8px)" />
				<ModalContent bg={panelBg}>
					<ModalHeader>{t("externalApps.settingsTitle")}</ModalHeader>
					<ModalCloseButton />
					<ModalBody>
						<Stack spacing={4}>
							<Heading size="xs">{t("externalApps.routingSettings")}</Heading>
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
							<FormControl>
								<FormLabel>{t("externalApps.notFoundFile")}</FormLabel>
								<Input
									value={notFoundFile}
									onChange={(event) => setNotFoundFile(event.target.value)}
									placeholder="404.html"
									autoComplete="off"
								/>
								<FormHelperText>
									{t("externalApps.notFoundFileHint")}
								</FormHelperText>
							</FormControl>
							<Heading size="xs" pt={2}>
								{t("externalApps.performanceSettings")}
							</Heading>
							<SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
								<FormControl isRequired>
									<FormLabel>{t("externalApps.maxRequestBody")}</FormLabel>
									<Input
										type="number"
										min={1}
										max={32}
										value={maxRequestBodyMB}
										onChange={(event) =>
											setMaxRequestBodyMB(Number(event.target.value))
										}
									/>
									<FormHelperText>
										{t("externalApps.maxRequestBodyHint")}
									</FormHelperText>
								</FormControl>
								<FormControl isRequired>
									<FormLabel>{t("externalApps.staticCache")}</FormLabel>
									<Input
										type="number"
										min={0}
										max={31536000}
										value={staticCacheSeconds}
										onChange={(event) =>
											setStaticCacheSeconds(Number(event.target.value))
										}
									/>
									<FormHelperText>
										{t("externalApps.staticCacheHint")}
									</FormHelperText>
								</FormControl>
							</SimpleGrid>
						</Stack>
					</ModalBody>
					<ModalFooter gap={3}>
						<Button variant="ghost" onClick={() => setSettingsTarget(null)}>
							{t("close")}
						</Button>
						<Button
							colorScheme="blue"
							isLoading={settingsMutation.isLoading}
							isDisabled={
								!indexFile.trim() ||
								maxRequestBodyMB < 1 ||
								maxRequestBodyMB > 32 ||
								staticCacheSeconds < 0 ||
								staticCacheSeconds > 31536000
							}
							onClick={() => {
								if (!settingsTarget) return;
								settingsMutation.mutate({
									id: settingsTarget.id,
									index_file: indexFile.trim(),
									fallback_to_index: fallbackToIndex,
									max_request_body_mb: maxRequestBodyMB,
									static_cache_seconds: staticCacheSeconds,
									not_found_file: notFoundFile.trim(),
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
							<Link as={RouterLink} to="/settings#ssl" color="blue.300">
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

			<Stack spacing={3}>
				<ResourceListCard
					title={t("externalApps.installedApps")}
					summaryItems={[
						{ label: t("total"), value: apps.length },
						{
							label: t("externalApps.enabled"),
							value: apps.filter((app) => app.enabled).length,
							colorScheme: "green",
						},
						{
							label: t("externalApps.disabled"),
							value: apps.filter((app) => !app.enabled).length,
						},
					]}
				/>
				<DataTable
					ariaLabel={t("externalApps.installedApps")}
					data={apps}
					columns={appColumns}
					getRowId={(app) => app.id}
					isLoading={appsQuery.isLoading}
					emptyState={<Text color={mutedColor}>{t("externalApps.empty")}</Text>}
					rowActions={appRowActions}
					actionsDisplay="menu"
					actionsPlacement="end"
					actionsColumnWidth="60px"
					showActionsOnHover
					mobileBreakpoint="md"
				/>
			</Stack>
		</Stack>
	);
};

export default ExternalAppsPage;
