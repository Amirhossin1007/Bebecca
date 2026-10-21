import { useToast } from "components/shadcn/toast";
import { Badge } from "components/shadcn/badge";
import { Alert, AlertIcon } from "components/shadcn/alert";
import { Checkbox } from "components/shadcn/selection";
import { Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay } from "components/shadcn/dialog";
import { FormControl, FormHelperText, FormLabel } from "components/shadcn/field";
import { Input } from "components/shadcn/input";
import { Button } from "components/shadcn/button";
import { cn } from "lib/cn";
import {
	ArrowDownTrayIcon,
	ArrowTopRightOnSquareIcon,
	ArrowPathIcon,
	ArrowUpTrayIcon,
	CircleStackIcon,
	CodeBracketIcon,
	Cog6ToothIcon,
	FolderOpenIcon,
	NoSymbolIcon,
	PaperAirplaneIcon,
	PlayIcon,
	PlusIcon,
	SparklesIcon,
	TrashIcon,
} from "@heroicons/react/24/outline";
import { PanelSelect as Select } from "components/common/PanelSelect";
import { ConfirmDialog } from "components/dialogs/ConfirmDialog";
import {
	DataTable,
	PageLoadingSkeleton,
	ResourceListCard,
	type DataTableColumn,
	type DataTableRowAction,
} from "components/ui";
import { lazy, Suspense, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { Link as RouterLink } from "react-router-dom";
import {
	deleteExternalApp,
	exportExternalAppDatabase,
	getExternalApps,
	getSubscriptionSettings,
	installFaoxima,
	installMirzaBot,
	installExternalArchive,
	setExternalAppEnabled,
	updateExternalAppSettings,
	updateExternalMirzaBot,
	type ExternalAppRecord,
} from "service/settings";

type TemplateID = "archive" | "mirzabot" | "faoxima";
type ArchiveRuntime = "php" | "static" | "node";

const ExternalAppFilesModal = lazy(async () => ({
	default: (await import("components/ExternalAppFilesModal"))
		.ExternalAppFilesModal,
}));

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
	const panelBg = "bg-panel-elevated";
	const borderColor = "border-panel-border!";
	const mutedColor = "panel.textSecondary";
	const [template, setTemplate] = useState<TemplateID>("mirzabot");
	const [createDialogOpen, setCreateDialogOpen] = useState(false);
	const [domain, setDomain] = useState("");
	const [name, setName] = useState("");
	const [archiveRuntime, setArchiveRuntime] = useState<ArchiveRuntime>("php");
	const [archive, setArchive] = useState<File | null>(null);
	const [createDatabase, setCreateDatabase] = useState(false);
	const [database, setDatabase] = useState("");
	const [databaseUser, setDatabaseUser] = useState("");
	const [databasePassword, setDatabasePassword] = useState("");
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
		{
			refetchOnWindowFocus: false,
			enabled: appsQuery.data?.supported === true,
		},
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
			.flatMap((certificate) => [
				certificate.domain,
				...(certificate.alt_names ?? []),
			])
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
	const generateDatabaseCredentials = () => {
		const values = new Uint8Array(20);
		globalThis.crypto.getRandomValues(values);
		const password = Array.from(values, (value) =>
			value.toString(16).padStart(2, "0"),
		).join("");
		const suffix = password.slice(0, 10);
		setDatabase(`app_${suffix}`);
		setDatabaseUser(`app_${suffix}`);
		setDatabasePassword(password);
	};

	const installMutation = useMutation(
		async () => {
			if (!domain) throw new Error(t("externalApps.errors.domainRequired"));
			if (template === "archive") {
				if (!name.trim())
					throw new Error(t("externalApps.errors.nameRequired"));
				if (
					createDatabase &&
					(!database.trim() || !databaseUser.trim() || !databasePassword)
				) {
					throw new Error(t("externalApps.errors.databaseFieldsRequired"));
				}
				return installExternalArchive({
					domain,
					name: name.trim(),
					runtime: archiveRuntime,
					archive: archive ?? undefined,
					create_database: createDatabase,
					database: database.trim(),
					database_user: databaseUser.trim(),
					database_password: databasePassword,
				});
			}
			if (!botToken.trim() || !adminID.trim()) {
				throw new Error(t("externalApps.errors.botFieldsRequired"));
			}
			if (hasDatabaseBackup && !databaseBackup) {
				throw new Error(t("externalApps.errors.databaseBackupRequired"));
			}
			const install = template === "mirzabot" ? installMirzaBot : installFaoxima;
			return install({
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
				setArchiveRuntime("php");
				setArchive(null);
				if (template !== "archive" || !createDatabase) {
					setCreateDatabase(false);
					setDatabase("");
					setDatabaseUser("");
					setDatabasePassword("");
				}
				setBotToken("");
				setAdminID("");
				setHasDatabaseBackup(false);
				setDatabaseBackup(null);
				setCreateDialogOpen(false);
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

	const databaseBackupMutation = useMutation(
		(app: ExternalAppRecord) => exportExternalAppDatabase(app.id),
		{
			onSuccess: (blob, app) => {
				const url = URL.createObjectURL(blob);
				const anchor = document.createElement("a");
				const label = (app.bot_username || app.id).replace(
					/[^A-Za-z0-9_-]/g,
					"_",
				);
				anchor.href = url;
				anchor.download = `${app.template}-${label}.sql`;
				document.body.appendChild(anchor);
				anchor.click();
				anchor.remove();
				URL.revokeObjectURL(url);
				toast({
					title: t("externalApps.databaseBackupReady"),
					status: "success",
				});
			},
			onError: (error) => {
				toast({
					title: t("externalApps.databaseBackupFailed"),
					description: errorDetail(error),
					status: "error",
					isClosable: true,
				});
			},
		},
	);

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
				sortValue: (app) => app.name ?? "",
				header: t("externalApps.name"),
				isPrimary: true,
				priority: "primary",
				mobilePriority: 0,
				cell: (app) => (
					<div className="flex flex-col gap-0 min-w-0! items-start">
						<p className="font-semibold truncate">
							{app.template === "mirzabot"
								? "MirzaBot"
								: app.template === "faoxima"
									? "Faoxima"
									: app.name}
						</p>
						<p className={cn(mutedColor, "text-[0.75rem] truncate")}>
							{app.bot_username
								? `@${app.bot_username.replace(/^@/, "")}`
								: app.id}
						</p>
					</div>
				),
			},
			{
				id: "url",
				sortValue: (app) => app.domain ?? "",
				header: t("externalApps.domainCertificate"),
				priority: "high",
				mobilePriority: 1,
				mobileMetaLabel: t("externalApps.domainCertificate"),
				cell: (app) => (
					<p dir="ltr" title={app.public_url} className="truncate">
						{app.domain}
						{app.path ? `/${app.path}` : ""}
					</p>
				),
			},
			{
				id: "runtime",
				sortValue: (app) => app.runtime ?? "",
				header: t("externalApps.runtime"),
				priority: "medium",
				mobilePriority: 2,
				mobileMetaLabel: t("externalApps.runtime"),
				cell: (app) => (
					<div className="flex flex-row items-center gap-1.5 flex-wrap">
						<Badge>
							{app.template === "mirzabot"
								? "MirzaBot"
								: app.template === "faoxima"
									? "Faoxima"
								: app.runtime.toUpperCase()}
						</Badge>
						{app.php_version ? (
							<Badge colorScheme="purple">PHP {app.php_version}</Badge>
						) : null}
						{app.version ? (
							<Badge colorScheme="blue">{app.version}</Badge>
						) : null}
					</div>
				),
			},
			{
				id: "status",
				sortValue: (app) => (app.enabled ? 1 : 0),
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
				sortValue: (app) => Date.parse(app.installed_at ?? "") || 0,
				header: t("externalApps.installedAt"),
				priority: "low",
				hideBelow: "xl",
				mobileMetaLabel: t("externalApps.installedAt"),
				cell: (app) => (
					<p className="text-[0.875rem]">
						{app.installed_at
							? new Date(app.installed_at).toLocaleString()
							: "—"}
					</p>
				),
			},
		],
		[t],
	);

	const appRowActions = (
		app: ExternalAppRecord,
	): DataTableRowAction<ExternalAppRecord>[] => {
		const actions: DataTableRowAction<ExternalAppRecord>[] = [];
		const botUsername = app.bot_username?.replace(/^@/, "");
		if (app.update_available) {
			actions.push({
				id: "update",
				label: t("externalApps.update"),
				icon: <ArrowPathIcon className="w-16" />,
				onClick: () => setUpdateTarget(app),
			});
		}
		if ((app.template === "mirzabot" || app.template === "faoxima") && app.has_database) {
			actions.push({
				id: "database-backup",
				label: t("externalApps.downloadDatabaseBackup"),
				icon: <ArrowDownTrayIcon className="w-16" />,
				onClick: () => databaseBackupMutation.mutate(app),
				disabled: databaseBackupMutation.isLoading,
			});
		}
		actions.push(
			{
				id: "files",
				label: t("externalApps.files.button"),
				icon: <FolderOpenIcon className="w-16" />,
				onClick: () => openManager(app, "file"),
			},
			...(app.runtime === "php"
				? [
						{
							id: "php-settings",
							label: t("externalApps.files.phpConfig"),
							icon: <CodeBracketIcon className="w-16" />,
							onClick: () => openManager(app, "php-config"),
						},
					]
				: []),
			...(app.runtime !== "node"
				? [
						{
							id: "settings",
							label: t("externalApps.settings"),
							icon: <Cog6ToothIcon className="w-16" />,
							onClick: () => openSettings(app),
						},
					]
				: []),
			{
				id: "open",
				label: t("externalApps.open"),
				icon: <ArrowTopRightOnSquareIcon className="w-16" />,
				onClick: () =>
					window.open(app.public_url, "_blank", "noopener,noreferrer"),
			},
			...(botUsername
				? [
						{
							id: "open-bot",
							label: t("externalApps.openBot"),
							icon: <PaperAirplaneIcon className="w-16" />,
							onClick: () =>
								window.open(
									`https://t.me/${encodeURIComponent(botUsername)}`,
									"_blank",
									"noopener,noreferrer",
								),
						},
					]
				: []),
			{
				id: "toggle",
				label: app.enabled
					? t("externalApps.disable")
					: t("externalApps.enable"),
				icon: app.enabled ? (
					<NoSymbolIcon className="w-16" />
				) : (
					<PlayIcon className="w-16" />
				),
				onClick: () =>
					toggleMutation.mutate({ id: app.id, enabled: !app.enabled }),
				disabled: toggleMutation.isLoading,
			},
			{
				id: "delete",
				label: t("externalApps.delete"),
				icon: <TrashIcon className="w-16" />,
				onClick: () => confirmDelete(app),
				disabled: deleteMutation.isLoading,
				isDanger: true,
			},
		);
		return actions;
	};

	if (appsQuery.isLoading) {
		return <PageLoadingSkeleton />;
	}
	if (appsQuery.data?.supported === false) {
		return (
			<div className="flex flex-col gap-5">
				<div>
					<h2 className="font-heading font-bold text-[1.5rem] leading-[1.33] md:text-[1.875rem] md:leading-[1.2]">{t("externalApps.title")}</h2>
					<p className={cn(mutedColor, "mt-2")}>
						{t("externalApps.description")}
					</p>
				</div>
				<Alert status="warning" className="rounded-md">
					<AlertIcon />
					<p>{t("externalApps.unsupported")}</p>
				</Alert>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-5">
			<ConfirmDialog
				open={Boolean(updateTarget)}
				title={t("externalApps.update")}
				description={t("externalApps.updateConfirm", {
					version: updateTarget?.latest_version,
				})}
				confirmLabel={t("externalApps.update")}
				loading={updateMutation.isLoading}
				onClose={() => setUpdateTarget(null)}
				onConfirm={async () => {
					if (updateTarget) await updateMutation.mutateAsync(updateTarget.id);
				}}
			/>
			<ConfirmDialog
				open={Boolean(deleteTarget)}
				title={t("externalApps.delete")}
				description={
					<div className="flex flex-col gap-3">
						<p>
							{t("externalApps.deleteConfirm", {
								name: deleteTarget?.name,
							})}
						</p>
						{deleteTarget?.has_database ? (
							<Checkbox checked={keepDatabase} onChange={(event) => setKeepDatabase(event.target.checked)}>
								{t("externalApps.keepDatabase")}
							</Checkbox>
						) : null}
					</div>
				}
				confirmLabel={t("externalApps.delete")}
				colorScheme="red"
				loading={deleteMutation.isLoading}
				onClose={() => setDeleteTarget(null)}
				onConfirm={async () => {
					if (!deleteTarget) return;
					await deleteMutation.mutateAsync({
						id: deleteTarget.id,
						keep_database: deleteTarget.has_database && keepDatabase,
					});
				}}
			/>
			{managedApp && (
				<Suspense fallback={null}>
					<ExternalAppFilesModal
						app={managedApp}
						initialView={managerView}
						onClose={() => setManagedApp(null)}
					/>
				</Suspense>
			)}
			<Modal open={Boolean(settingsTarget)} onClose={() => setSettingsTarget(null)} size="xl">
				<ModalOverlay className="bg-blackAlpha-500" />
				<ModalContent className={cn(panelBg)}>
					<ModalHeader>{t("externalApps.settingsTitle")}</ModalHeader>
					<ModalCloseButton />
					<ModalBody>
						<div className="flex flex-col gap-4">
							<h2 className="font-heading font-bold text-[0.875rem] leading-[1.2]">{t("externalApps.routingSettings")}</h2>
							<FormControl required>
								<FormLabel>{t("externalApps.indexFile")}</FormLabel>
								<Input value={indexFile} onChange={(event) => setIndexFile(event.target.value)} placeholder="index.php" autoComplete="off" />
								<FormHelperText>
									{t("externalApps.indexFileHint")}
								</FormHelperText>
							</FormControl>
							<Checkbox checked={fallbackToIndex} onChange={(event) => setFallbackToIndex(event.target.checked)}>
								<div className="flex flex-col gap-0">
									<p>{t("externalApps.fallbackToIndex")}</p>
									<p className={cn(mutedColor, "text-[0.875rem]")}>
										{t("externalApps.fallbackToIndexHint")}
									</p>
								</div>
							</Checkbox>
							<FormControl>
								<FormLabel>{t("externalApps.notFoundFile")}</FormLabel>
								<Input value={notFoundFile} onChange={(event) => setNotFoundFile(event.target.value)} placeholder="404.html" autoComplete="off" />
								<FormHelperText>
									{t("externalApps.notFoundFileHint")}
								</FormHelperText>
							</FormControl>
							<h2 className="font-heading font-bold text-[0.875rem] leading-[1.2] pt-2">
								{t("externalApps.performanceSettings")}
							</h2>
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<FormControl required>
									<FormLabel>{t("externalApps.maxRequestBody")}</FormLabel>
									<Input type="number" min={1} max={32} value={maxRequestBodyMB} onChange={(event) =>
											setMaxRequestBodyMB(Number(event.target.value))
										} />
									<FormHelperText>
										{t("externalApps.maxRequestBodyHint")}
									</FormHelperText>
								</FormControl>
								<FormControl required>
									<FormLabel>{t("externalApps.staticCache")}</FormLabel>
									<Input type="number" min={0} max={31536000} value={staticCacheSeconds} onChange={(event) =>
											setStaticCacheSeconds(Number(event.target.value))
										} />
									<FormHelperText>
										{t("externalApps.staticCacheHint")}
									</FormHelperText>
								</FormControl>
							</div>
						</div>
					</ModalBody>
					<ModalFooter className="gap-3">
						<Button size="md" variant="ghost" onClick={() => setSettingsTarget(null)}>
							{t("close")}
						</Button>
						<Button size="md" colorScheme="blue" loading={settingsMutation.isLoading} disabled={
								!indexFile.trim() ||
								maxRequestBodyMB < 1 ||
								maxRequestBodyMB > 32 ||
								staticCacheSeconds < 0 ||
								staticCacheSeconds > 31536000
							} onClick={() => {
								if (!settingsTarget) return;
								settingsMutation.mutate({
									id: settingsTarget.id,
									index_file: indexFile.trim(),
									fallback_to_index: fallbackToIndex,
									max_request_body_mb: maxRequestBodyMB,
									static_cache_seconds: staticCacheSeconds,
									not_found_file: notFoundFile.trim(),
								});
							}}>
							{t("save")}
						</Button>
					</ModalFooter>
				</ModalContent>
			</Modal>
			<div>
				<h2 className="font-heading font-bold text-[1.5rem] leading-[1.33] md:text-[1.875rem] md:leading-[1.2]">{t("externalApps.title")}</h2>
				<p className={cn(mutedColor, "mt-2")}>
					{t("externalApps.description")}
				</p>
			</div>

			<Alert status="info" className="rounded-md">
				<AlertIcon />
				<p className="text-[0.875rem]">{t("externalApps.resourceHint")}</p>
			</Alert>

			<Modal open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} size="3xl" isCentered scrollBehavior="inside" closeOnOverlayClick={!installMutation.isLoading}>
				<ModalOverlay className="bg-blackAlpha-500" />
				<ModalContent className={cn("border rounded-2xl shadow-2xl overflow-hidden mx-4 sm:mx-0", panelBg, borderColor)}>
					<ModalCloseButton disabled={installMutation.isLoading} />
					<div className="p-5 md:p-6">
						<h2 className="font-heading font-bold text-[1.25rem] leading-[1.2] mb-4">
							{t("externalApps.newApp")}
						</h2>
						{!appsQuery.data?.supported ? (
							<Alert status="warning" className="mb-4 rounded-md">
								<AlertIcon />
								{appsQuery.data?.detail || t("externalApps.unsupported")}
							</Alert>
						) : null}
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<FormControl>
								<FormLabel>{t("externalApps.template")}</FormLabel>
								<Select
									value={template}
									onValueChange={(value) => setTemplate(value as TemplateID)}
									options={[
										{
											value: "mirzabot",
											label: t("externalApps.mirzaTemplate"),
										},
										{
											value: "faoxima",
											label: t("externalApps.faoximaTemplate"),
										},
										{
											value: "archive",
											label: t("externalApps.archiveTemplate"),
										},
									]}
								/>
								{(template === "mirzabot" || template === "faoxima") && selectedTemplate?.source_url ? (
									<a href={selectedTemplate.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-2 text-[0.875rem] text-blue-300">
										{t(
											template === "faoxima"
												? "externalApps.latestFaoximaRelease"
												: "externalApps.latestRelease",
										)}
										<ArrowTopRightOnSquareIcon className="w-14" />
									</a>
								) : null}
							</FormControl>
							<FormControl required>
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
									<RouterLink to="/settings#ssl" className="text-blue-300">
										{t("externalApps.openSSLManager")}
									</RouterLink>
								</FormHelperText>
							</FormControl>
						</div>

						{template !== "archive" ? (
							<div className="flex flex-col mt-4 gap-3">
								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<FormControl required>
										<FormLabel>{t("externalApps.botToken")}</FormLabel>
										<Input type="password" value={botToken} onChange={(event) => setBotToken(event.target.value)} autoComplete="off" />
									</FormControl>
									<FormControl required>
										<FormLabel>{t("externalApps.telegramAdminID")}</FormLabel>
										<Input value={adminID} onChange={(event) => setAdminID(event.target.value)} inputMode="numeric" />
									</FormControl>
								</div>
								<Checkbox checked={hasDatabaseBackup} onChange={(event) => {
										setHasDatabaseBackup(event.target.checked);
										if (!event.target.checked) setDatabaseBackup(null);
									}}>
									{t(
										template === "faoxima"
											? "externalApps.faoximaDatabaseBackupToggle"
											: "externalApps.databaseBackupToggle",
									)}
								</Checkbox>
								{hasDatabaseBackup ? (
									<FormControl required>
										<FormLabel>{t("externalApps.databaseBackup")}</FormLabel>
										<Input type="file" accept=".sql,application/sql,text/sql,text/plain" onChange={(event) =>
												setDatabaseBackup(event.target.files?.[0] ?? null)
											} className="pt-1" />
										<FormHelperText>
											{t("externalApps.databaseBackupHint")}
										</FormHelperText>
									</FormControl>
								) : null}
							</div>
						) : (
							<div className="flex flex-col mt-4 gap-4">
								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<FormControl required>
										<FormLabel>{t("externalApps.name")}</FormLabel>
										<Input value={name} maxLength={80} onChange={(event) => setName(event.target.value)} />
									</FormControl>
									<FormControl disabled={Boolean(archive)}>
										<FormLabel>{t("externalApps.runtime")}</FormLabel>
										<Select
											value={archiveRuntime}
											disabled={Boolean(archive)}
											onValueChange={(value) =>
												setArchiveRuntime(value as ArchiveRuntime)
											}
											options={[
												{ value: "php", label: "PHP" },
												{ value: "node", label: "Node.js" },
												{
													value: "static",
													label: t("externalApps.staticRuntime"),
												},
											]}
										/>
										<FormHelperText>
											{archive
												? t("externalApps.runtimeDetectedHint")
												: t("externalApps.emptyRuntimeHint")}
										</FormHelperText>
									</FormControl>
								</div>
								<FormControl>
									<FormLabel>{t("externalApps.zipArchive")}</FormLabel>
									<Input type="file" accept=".zip,application/zip" onChange={(event) =>
											setArchive(event.target.files?.[0] ?? null)
										} className="pt-1" />
									<FormHelperText>
										{t("externalApps.archiveHint")}
									</FormHelperText>
								</FormControl>
								<Checkbox checked={createDatabase} onChange={(event) => setCreateDatabase(event.target.checked)}>
									{t("externalApps.createDatabase")}
								</Checkbox>
								{createDatabase ? (
									<div className={cn("border rounded-md p-4", borderColor)}>
										<div className="flex flex-row items-center justify-between mb-4 flex-wrap gap-2">
											<div className="flex flex-row items-center gap-2">
												<CircleStackIcon className="w-18" />
												<p className="font-semibold">
													{t("externalApps.databaseSettings")}
												</p>
											</div>
											<Button size="sm" variant="outline" onClick={generateDatabaseCredentials}>{<SparklesIcon className="w-16" />}
												{t("externalApps.generateDatabaseCredentials")}
											</Button>
										</div>
										<div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
											<FormControl required>
												<FormLabel>{t("externalApps.databaseName")}</FormLabel>
												<Input value={database} maxLength={64} autoComplete="off" onChange={(event) => setDatabase(event.target.value)} />
											</FormControl>
											<FormControl required>
												<FormLabel>{t("externalApps.databaseUser")}</FormLabel>
												<Input value={databaseUser} maxLength={32} autoComplete="off" onChange={(event) =>
														setDatabaseUser(event.target.value)
													} />
											</FormControl>
											<FormControl required>
												<FormLabel>
													{t("externalApps.databasePassword")}
												</FormLabel>
												<Input type="text" value={databasePassword} maxLength={128} autoComplete="new-password" onChange={(event) =>
														setDatabasePassword(event.target.value)
													} />
											</FormControl>
										</div>
										<p className={cn(mutedColor, "text-[0.875rem] mt-3")}>
											{t("externalApps.databaseCredentialsHint")}
										</p>
									</div>
								) : null}
							</div>
						)}

						<Button size="md" colorScheme="blue" loading={installMutation.isLoading} disabled={
								!appsQuery.data?.supported ||
								selectedTemplate?.supported === false ||
								!domain ||
								(template === "archive" && !name.trim())
							} onClick={() => installMutation.mutate()} className="mt-5">{<ArrowUpTrayIcon className="w-18" />}
							{t("externalApps.install")}
						</Button>
						{selectedTemplate?.detail ? (
							<p className="text-orange-300 text-[0.875rem] mt-2">
								{selectedTemplate.detail}
							</p>
						) : null}
					</div>
				</ModalContent>
			</Modal>

			<div className="flex flex-col gap-3">
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
					actions={
						<Button size="md" colorScheme="primary" onClick={() => setCreateDialogOpen(true)}>{<PlusIcon className="w-16 h-16" />}
							{t("externalApps.create")}
						</Button>
					}
				/>
				<DataTable
					ariaLabel={t("externalApps.installedApps")}
					data={apps}
					columns={appColumns}
					getRowId={(app) => app.id}
					loading={appsQuery.isLoading}
					emptyState={<p className={mutedColor}>{t("externalApps.empty")}</p>}
					rowActions={appRowActions}
					actionsDisplay="menu"
					actionsPlacement="end"
					actionsColumnWidth="60px"
					showActionsOnHover
					mobileBreakpoint="md"
				/>
			</div>
		</div>
	);
};

export default ExternalAppsPage;
