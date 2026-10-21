import { useToast } from "components/shadcn/toast";
import { Popover, PopoverBody, PopoverContent, PopoverHeader, PopoverTrigger } from "components/shadcn/popover";
import { Button, IconButton } from "components/shadcn/button";
import { Progress, Spinner } from "components/shadcn/feedback";
import { Alert, AlertIcon } from "components/shadcn/alert";
import { FormControl, FormHelperText, FormLabel } from "components/shadcn/field";
import { Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay } from "components/shadcn/dialog";
import { Tooltip } from "components/shadcn/tooltip";
import { cn } from "lib/cn";
import {
	ArrowPathIcon,
	ArrowsRightLeftIcon,
	ArrowUpTrayIcon,
	CheckIcon,
	ClipboardIcon,
	CommandLineIcon,
} from "@heroicons/react/24/outline";
import { motion } from "framer-motion";
import useGetUser from "hooks/useGetUser";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "react-query";
import { fetch } from "service/http";
import { AdminRole } from "types/Admin";
import {
	generateErrorMessage,
	generateSuccessMessage,
} from "utils/toastHandler";
import { getAPIWebSocketURL } from "utils/websocket";
import { DashboardBackupControls } from "./RebeccaBackupPanel";
import {
	BuildVersionSelect,
	type BuildCatalog,
} from "./BuildVersionSelect";
import { PanelSelect as Select } from "./common/PanelSelect";

type UpdateChannel = "current" | "latest" | "dev";
type MaintenanceAction = "update" | "restart" | "soft-reload";

type MaintenanceOperation = {
	id?: string;
	action?: string;
	phase?: string;
	message?: string;
	progress?: number | null;
	running?: boolean;
	restarting?: boolean;
	needs_reload?: boolean;
	error?: string;
	logs?: string[];
};

type MaintenanceInfo = {
	panel?: {
		image?: string;
		tag?: string | null;
		mode?: string;
		install_mode?: string;
		channel?: string;
		update?: {
			current?: string | null;
			available?: boolean;
			target?: string | null;
			latest_release?: { tag?: string | null } | null;
			latest_dev?: { tag?: string | null } | null;
			error?: string | null;
		} | null;
	} | null;
};

const shouldWaitForPanelReturn = (operation?: MaintenanceOperation | null) =>
	Boolean(
		operation?.restarting ||
			operation?.needs_reload ||
			operation?.phase === "restarting",
	);

const ansiEscapePattern =
	// biome-ignore lint/suspicious/noControlCharactersInRegex: Strip ANSI escape codes from raw terminal logs
	/\u001B|\u009B|[\u001B\u009B][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[a-zA-Z\d]*)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g;

const cleanTerminalOutput = (logs?: string[]) =>
	(logs || [])
		.join("\n")
		.replace(ansiEscapePattern, "")
		// biome-ignore lint/suspicious/noControlCharactersInRegex: Strip backspace characters from terminal logs
		.replace(/\x08/g, "")
		.trimEnd();

export const DashboardMaintenanceControls = ({
	channel,
	version,
}: {
	channel?: string;
	version: string;
}) => {
	const { t } = useTranslation();
	const toast = useToast();
	const { userData, getUserIsSuccess } = useGetUser();
	const canMaintain =
		getUserIsSuccess &&
		(userData.role === AdminRole.FullAccess ||
			(userData.role === AdminRole.Sudo &&
				Boolean(userData.permissions?.sudo.maintenance)));
	const canBackUp =
		getUserIsSuccess &&
		(userData.role === AdminRole.FullAccess ||
			(userData.role === AdminRole.Sudo &&
				Boolean(userData.permissions?.sudo.backups)));
	const outputBg = "bg-gray-50 dark:bg-blackAlpha-400";
	const outputBorder = "border-gray-200! dark:border-whiteAlpha-200!";
	const [selectedChannel, setSelectedChannel] =
		useState<UpdateChannel>("current");
	const [selectedVersion, setSelectedVersion] = useState("");
	const [operation, setOperation] = useState<MaintenanceOperation | null>(null);
	const [waitingForAPI, setWaitingForAPI] = useState(false);
	const [isUpdateDialogOpen, setUpdateDialogOpen] = useState(false);
	const [confirmAction, setConfirmAction] = useState<"restart" | "soft-reload" | "update" | null>(null);
	const [logsCopied, setLogsCopied] = useState(false);
	const logsContainerRef = useRef<HTMLPreElement | null>(null);
	const panelReturnPollRef = useRef<number | null>(null);
	const panelReturnSawOfflineRef = useRef(false);
	const devUpdateTimerRef = useRef<number | null>(null);

	const info = useQuery<MaintenanceInfo>(
		["dashboard-maintenance-info"],
		() => fetch<MaintenanceInfo>("/maintenance/info", { timeout: 8000 }),
		{
			enabled: canMaintain || canBackUp,
			refetchOnWindowFocus: false,
			staleTime: 5 * 60 * 1000,
			retry: false,
		},
	);
	const panel = info.data?.panel;
	const update = panel?.update;
	const installMode = panel?.mode || panel?.install_mode;
	const hostActionsAvailable = installMode === "binary";
	const builds = useQuery<BuildCatalog>(
		["maintenance-builds", "panel"],
		() => fetch<BuildCatalog>("/maintenance/builds?target=panel", { timeout: 12000 }),
		{
			enabled: canMaintain && hostActionsAvailable,
			refetchOnWindowFocus: false,
			staleTime: 10 * 60 * 1000,
			retry: false,
		},
	);
	const fallbackVersion = channel?.toLowerCase() === "dev" ? "dev" : version;
	const currentVersion =
		panel?.tag || update?.current || fallbackVersion || "-";
	const selectedTarget =
		selectedVersion ||
		(selectedChannel === "dev"
			? update?.latest_dev?.tag
			: selectedChannel === "latest"
				? update?.latest_release?.tag
				: update?.target);

	useEffect(() => {
		if (panel?.channel === "dev" || panel?.channel === "latest") {
			setSelectedChannel(panel.channel);
		}
	}, [panel?.channel]);

	const selectBuildVersion = (value: string) => {
		setSelectedVersion(value);
		if (!value) return;
		const build = [...(builds.data?.stable ?? []), ...(builds.data?.dev ?? [])].find(
			(item) => item.version === value,
		);
		if (build) setSelectedChannel(build.channel === "dev" ? "dev" : "latest");
	};

	const clearPanelReturnPolling = useCallback(() => {
		if (panelReturnPollRef.current !== null) {
			window.clearInterval(panelReturnPollRef.current);
			panelReturnPollRef.current = null;
		}
	}, []);

	const startPanelReturnPolling = useCallback(() => {
		if (panelReturnPollRef.current !== null) return;
		const startedAt = Date.now();
		let readyChecks = 0;
		panelReturnSawOfflineRef.current = false;
		setWaitingForAPI(true);
		panelReturnPollRef.current = window.setInterval(async () => {
			let up = true;
			try {
				await fetch("/auth/session", { timeout: 2500 });
			} catch (error) {
				const status = (error as { response?: { status?: number } })?.response?.status;
				up = status === 401 || status === 403;
			}
			if (!up) {
				panelReturnSawOfflineRef.current = true;
				readyChecks = 0;
				return;
			}
			const elapsed = Date.now() - startedAt;
			if (!panelReturnSawOfflineRef.current && elapsed < 30000) return;
			readyChecks += 1;
			if (readyChecks >= 2 || elapsed > 180000) {
				clearPanelReturnPolling();
				window.location.reload();
			}
		}, 2000);
	}, [clearPanelReturnPolling]);

	useEffect(() => () => clearPanelReturnPolling(), [clearPanelReturnPolling]);
	useEffect(
		() => () => {
			if (devUpdateTimerRef.current !== null) {
				window.clearTimeout(devUpdateTimerRef.current);
			}
		},
		[],
	);

	useEffect(() => {
		if (!operation?.id || waitingForAPI) return;
		const url = getAPIWebSocketURL("/maintenance/status", { id: operation.id });
		if (!url) return;
		const socket = new WebSocket(url);
		socket.onmessage = (event) => {
			try {
				const status = JSON.parse(event.data) as MaintenanceOperation;
				if (status.id !== operation.id) return;
				setOperation(status);
				if (shouldWaitForPanelReturn(status)) startPanelReturnPolling();
				if (
					status.action === "update" &&
					!status.running &&
					!status.error &&
					!shouldWaitForPanelReturn(status)
				) {
					window.location.reload();
				}
			} catch {}
		};
		return () => socket.close();
	}, [operation?.id, startPanelReturnPolling, waitingForAPI]);

	useEffect(() => {
		if (operation?.logs && logsContainerRef.current) {
			logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
		}
	}, [operation?.logs]);

	const triggerAction = async (
		action: MaintenanceAction,
		body?: Record<string, unknown>,
	) => {
		try {
			const result = await fetch<{ operation?: MaintenanceOperation }>(
				`/maintenance/${action}`,
				{ method: "POST", body, timeout: 3000 },
			);
			return { wentOffline: false, operation: result.operation };
		} catch (error: any) {
			if (!error?.response) return { wentOffline: true };
			throw error;
		}
	};

	const handleSuccess = (
		action: MaintenanceAction,
		result: { wentOffline: boolean; operation?: MaintenanceOperation },
	) => {
		const nextOperation = result.operation || {
			action,
			phase: result.wentOffline ? "restarting" : "queued",
			message: result.wentOffline
				? t("dashboard.maintenance.waitingForAPI")
				: t("dashboard.maintenance.queued"),
			restarting: result.wentOffline,
		};
		setOperation(nextOperation);
		generateSuccessMessage(
			t(
				action === "update"
					? "dashboard.maintenance.updateTriggered"
					: action === "restart"
						? "dashboard.maintenance.restartTriggered"
						: "dashboard.maintenance.softReloadTriggered",
			),
			toast,
		);
		if (result.wentOffline || shouldWaitForPanelReturn(nextOperation)) {
			startPanelReturnPolling();
		}
		window.setTimeout(() => info.refetch(), 6000);
	};

	const updateMutation = useMutation(
		() =>
			triggerAction("update", {
				channel: selectedChannel,
				...(selectedVersion ? { version: selectedVersion } : {}),
			}),
		{
			retry: false,
			onSuccess: (result) => handleSuccess("update", result),
			onError: (error) => {
				setUpdateDialogOpen(false);
				generateErrorMessage(error, toast);
			},
		},
	);
	const restartMutation = useMutation(() => triggerAction("restart"), {
		retry: false,
		onSuccess: (result) => handleSuccess("restart", result),
		onError: (error) => {
			generateErrorMessage(error, toast);
		},
	});
	const reloadMutation = useMutation(() => triggerAction("soft-reload"), {
		retry: false,
		onSuccess: (result) => handleSuccess("soft-reload", result),
		onError: (error) => {
			generateErrorMessage(error, toast);
		},
	});

	const executeUpdate = () => {
		setOperation(null);
		setUpdateDialogOpen(true);
		updateMutation.mutate();
	};

	const startUpdate = () => {
		setConfirmAction("update");
	};

	const renderUpdatePopover = () => (
		<Popover placement="bottom-end" closeOnBlur={true} closeOnEsc={true} isLazy>
			<PopoverTrigger>
				<Button size="xs" colorScheme={update?.available ? "primary" : "gray"} variant={update?.available ? "solid" : "outline"} isDisabled={!canMaintain || !hostActionsAvailable || info.isLoading} className={cn("h-[32px] w-full sm:w-auto px-3.5 border-panel-border! rounded-full whitespace-nowrap", update?.available ? "bg-[var(--rb-panel-accent)]" : "bg-transparent", update?.available ? "text-white" : "text-panel-text")}>
					<div className="flex flex-row gap-1.5 items-center justify-center w-full">
						<span className="inline-flex items-center justify-center shrink-0">
							<ArrowUpTrayIcon className="w-15 h-15" />
						</span>
						<span className="text-[12px] font-semibold leading-none">
							{update?.available
								? t("dashboard.maintenance.updateAvailable")
								: t("dashboard.maintenance.updateAction")}
						</span>
					</div>
				</Button>
			</PopoverTrigger>
			<PopoverContent onClick={(e) => e.stopPropagation()} className="w-[min(480px,_calc(100vw_-_24px))] max-w-[480px] rounded-2xl shadow-[0_24px_60px_rgba(0,0,0,0.5)] bg-panel-surface border-panel-border! border p-1">
				<PopoverHeader className="font-bold text-[13px] py-3 px-4 border-panel-border!">
					<div className="flex justify-between items-center gap-3">
						<p className="text-[13px] font-bold text-panel-text">{t("dashboard.maintenance.title")}</p>
						<Button size="xs" variant="ghost" leftIcon={<ArrowPathIcon className="w-13 h-13" />} onClick={() => info.refetch()} isLoading={info.isFetching} className="rounded-full text-panel-text-muted hover:text-panel-text hover:bg-panel-elevated">
							{t("refresh")}
						</Button>
					</div>
				</PopoverHeader>
				<PopoverBody className="p-4">
					<div className="flex flex-col gap-4">
						{info.isLoading && (
							<div className="flex items-center justify-center py-5">
								<Spinner size="sm" className="text-panel-accent" />
							</div>
						)}
						{info.isError && (
							<Alert status="error" className="rounded-xl text-[13px]">
								<AlertIcon />
								<p className="text-[12px]">
									{t("dashboard.maintenance.updateCheckFailed", {
										error:
											(info.error as Error)?.message ||
											t("dashboard.system.genericError"),
									})}
								</p>
							</Alert>
						)}
						<div className="p-3.5 rounded-xl bg-panel-elevated border border-panel-border!">
							<p className="text-[11px] font-semibold text-panel-text-muted mb-1">
								{t("dashboard.maintenance.panelVersion")}
							</p>
							<p dir="ltr" className="text-[13px] font-bold text-panel-text [unicode-bidi:isolate]">
								{panel?.image
									? `${panel.image} (${currentVersion})`
									: currentVersion}
							</p>
						</div>
						{info.isSuccess && !hostActionsAvailable && (
							<Alert status="warning" className="rounded-xl text-[13px]">
								<AlertIcon />
								<p className="text-[12px]">
									{t("dashboard.maintenance.binaryMigrationRequired")}
								</p>
							</Alert>
						)}
						{update?.available && (
							<Alert status="success" className="rounded-xl text-[13px]">
								<AlertIcon />
								<p className="text-[12px]">
									{t("dashboard.maintenance.updateAvailableNotice", {
										current: update.current || currentVersion,
										target: selectedTarget || update.target || "-",
									})}
								</p>
							</Alert>
						)}
						{update?.error && (
							<Alert status="warning" className="rounded-xl text-[13px]">
								<AlertIcon />
								<p className="text-[12px]">
									{t("dashboard.maintenance.updateCheckFailed", {
										error: update.error,
									})}
								</p>
							</Alert>
						)}
						{hostActionsAvailable && (
							<FormControl>
								<FormLabel className="text-[12px] font-semibold text-panel-text-secondary">
									{t("dashboard.maintenance.updateChannel")}
								</FormLabel>
								<Select
									size="sm"
									portalled={false}
									value={selectedChannel}
									onChange={(event) => {
										setSelectedChannel(
											event.target.value as UpdateChannel,
										);
										setSelectedVersion("");
									}}
								>
									<option value="current">
										{t("dashboard.maintenance.updateChannelCurrent")}
									</option>
									<option value="latest">
										{t("dashboard.maintenance.updateChannelLatest")}
									</option>
									<option value="dev">
										{t("dashboard.maintenance.updateChannelDev")}
									</option>
								</Select>
								<FormHelperText className="text-[11px] text-panel-text-muted">
									{selectedTarget
										? t("dashboard.maintenance.updateTargetHint", {
												version: selectedTarget,
											})
										: t("dashboard.maintenance.updateTargetUnknown")}
								</FormHelperText>
								</FormControl>
							)}
							{hostActionsAvailable && (
								<BuildVersionSelect
									catalog={builds.data}
									value={selectedVersion}
									onChange={selectBuildVersion}
								/>
							)}
						{selectedChannel === "dev" && hostActionsAvailable && (
							<Alert status="warning" className="rounded-xl text-[12px]">
								<AlertIcon />
								<p className="text-[12px]">
									{t("dashboard.maintenance.devChannelWarning")}
								</p>
							</Alert>
						)}
						<div className="flex gap-2 flex-wrap justify-end pt-2 border-t border-panel-border!">
							<Button size="xs" variant="outline" onClick={() => setConfirmAction("soft-reload")} isLoading={reloadMutation.isLoading} isDisabled={!hostActionsAvailable} className="h-[30px] px-3.5 rounded-full border-panel-border! text-panel-text hover:bg-panel-elevated hover:border-panel-border-strong! text-[12px] font-semibold">
								{t("dashboard.maintenance.softReloadAction")}
							</Button>
							<Button size="xs" colorScheme={update?.available ? "primary" : "gray"} onClick={startUpdate} isLoading={updateMutation.isLoading} isDisabled={!hostActionsAvailable} className="h-[30px] px-4 rounded-full text-[12px] font-semibold">
								{t("dashboard.maintenance.updateAction")}
							</Button>
						</div>
					</div>
				</PopoverBody>
			</PopoverContent>
		</Popover>
	);

	const isStandardAdminOnly = !canMaintain && !canBackUp;

	return (
		<div className="flex items-center justify-center sm:justify-end w-full sm:w-auto shrink-0">
			<div className="flex-row hidden sm:flex gap-2 items-center justify-end flex-nowrap shrink-0">
				{canMaintain && renderUpdatePopover()}

				{canBackUp && (
					<DashboardBackupControls
						isBinaryRuntime={hostActionsAvailable}
						runtimeLoading={info.isLoading}
					/>
				)}

				{canMaintain && (
					<Button size="xs" colorScheme="red" variant="outline" onClick={() => setConfirmAction("restart")} isLoading={restartMutation.isLoading} isDisabled={info.isLoading || !hostActionsAvailable} className="h-[32px] px-3.5 border-panel-border! text-red-400 hover:bg-[rgba(239,_68,_68,_0.1)] hover:border-red-400! rounded-full whitespace-nowrap">
						<div className="flex flex-row gap-1.5 items-center justify-center">
							<span className="inline-flex items-center justify-center shrink-0">
								<ArrowsRightLeftIcon className="w-15 h-15" />
							</span>
							<span className="text-[12px] font-semibold leading-none">
								{t("dashboard.maintenance.restartAction")}
							</span>
						</div>
					</Button>
				)}
			</div>

			{!isStandardAdminOnly && (
				<div className="flex-col flex sm:hidden gap-2 w-full">
					<div className="w-full">
						{renderUpdatePopover()}
					</div>

					<div className="flex gap-2 w-full items-center">
						<Button size="xs" colorScheme="red" variant="outline" onClick={() => setConfirmAction("restart")} isLoading={restartMutation.isLoading} isDisabled={info.isLoading || !hostActionsAvailable} className="flex-[1_1_50%] h-[32px] px-3 border-panel-border! text-red-400 hover:bg-[rgba(239,_68,_68,_0.1)] hover:border-red-400! rounded-full whitespace-nowrap">
							<div className="flex flex-row gap-1.5 items-center justify-center w-full">
								<span className="inline-flex items-center justify-center shrink-0">
									<ArrowsRightLeftIcon className="w-15 h-15" />
								</span>
								<span className="text-[12px] font-semibold leading-none">
									{t("dashboard.maintenance.restartAction")}
								</span>
							</div>
						</Button>

						{canBackUp && (
							<div className={"[&_>_button]:w-full [&_>_button]:h-[32px]! [&_>_button]:rounded-full! [&_>_button]:text-[12px]! [&_>_button]:font-semibold! [&_>_button]:border-panel-border! [&_>_button]:text-panel-text! [&_>_button]:whitespace-nowrap! flex-[1_1_50%] min-w-0!"}>
								<DashboardBackupControls
									isBinaryRuntime={hostActionsAvailable}
									runtimeLoading={info.isLoading}
								/>
							</div>
						)}
					</div>
				</div>
			)}

			<Modal isOpen={isUpdateDialogOpen} onClose={() => {
					if (operation?.error) setUpdateDialogOpen(false);
				}} closeOnEsc={Boolean(operation?.error)} closeOnOverlayClick={false} isCentered size="xl">
				<ModalOverlay className="bg-blackAlpha-700 [backdrop-filter:blur(16px)]" />
				<ModalContent className="rounded-[24px] overflow-hidden bg-panel-surface border-panel-border! border shadow-[0_24px_60px_-12px_rgba(0,_0,_0,_0.45),_inset_0_1px_1px_0_rgba(255,_255,_255,_0.08)] mx-4">
					<ModalHeader className="px-6 pt-6 pb-4 border-b border-panel-border!">
						<div className="flex items-center justify-between">
							<div className="flex flex-row items-center gap-3">
								<div className="flex w-[36px] h-[36px] items-center justify-center rounded-[12px] bg-panel-elevated text-[var(--rb-panel-accent)] border border-panel-border!">
									{operation?.error ? (
										<ArrowPathIcon className="w-18" />
									) : operation?.phase === "completed" ? (
										<CheckIcon className="w-18" />
									) : (
										<motion.div
											animate={{ rotate: 360 }}
											transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
											style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
										>
											<ArrowPathIcon className="w-18" />
										</motion.div>
									)}
								</div>
								<div>
									<p className="text-[15px] font-bold text-panel-text">
										{t("dashboard.maintenance.updateProgressTitle")}
									</p>
									<div className="flex flex-row items-center gap-2 mt-0.5">
										<p className="text-[11px] text-panel-text-muted font-medium">
											{currentVersion}
										</p>
										{selectedTarget && (
											<>
												<p className="text-[11px] text-panel-text-muted">
													{document.documentElement.dir === "rtl" ? "←" : "→"}
												</p>
												<p dir="ltr" className="text-[11px] text-[var(--rb-panel-accent)] font-bold [unicode-bidi:isolate]">
													{selectedTarget}
												</p>
											</>
										)}
									</div>
								</div>
							</div>
							{operation?.error && <ModalCloseButton className="static" />}
						</div>
					</ModalHeader>

					<ModalBody className="px-6 py-5">
						<div className="flex flex-col gap-4">
							<div className="p-4 rounded-[16px] bg-panel-elevated border border-panel-border! [transition:all_0.3s_ease]">
								<div className="flex items-center justify-between mb-2">
									<div className="flex flex-row items-center gap-2.5">
										<div className={cn("flex w-[8px] h-[8px] rounded-full", operation?.error ? "bg-red-500" : (operation?.phase === "completed" ? "bg-green-500" : "bg-[var(--rb-panel-accent)]"), operation?.error ? "shadow-[0_0_10px_rgba(239,_68,_68,_0.6)]" : (operation?.phase === "completed" ? "shadow-[0_0_10px_rgba(34,_197,_94,_0.6)]" : "shadow-[0_0_10px_var(--rb-panel-accent)]"))} />
										<p className="text-[13px] font-bold text-panel-text">
											{operation?.phase
												? t(`dashboard.maintenance.phase.${operation.phase}`, operation.phase)
												: t("dashboard.maintenance.phase.queued")}
										</p>
									</div>
									{typeof operation?.progress === "number" && (
										<p dir="ltr" className="text-[12px] font-bold text-[var(--rb-panel-accent)] [font-variant-numeric:tabular-nums]">
											{Math.round(operation.progress)}%
										</p>
									)}
								</div>

								<p className="text-[12px] text-panel-text-secondary font-medium mb-3">
									{operation?.error
										? operation.error
										: operation?.message
											? t(`dashboard.maintenance.message.${operation.message.replace(/[^a-zA-Z]/g, "")}`, operation.message)
											: t("dashboard.maintenance.message.preparingUpdate")}
								</p>

								<Progress value={typeof operation?.progress === "number" ? operation.progress : undefined} isIndeterminate={typeof operation?.progress !== "number" && !operation?.error && operation?.phase !== "completed"} className={cn("[&_>_div]:[transition:width_0.4s_ease]", operation?.error ? "[&_>_div]:bg-[var(--color-red-500)]" : (operation?.phase === "completed" ? "[&_>_div]:bg-[var(--color-green-500)]" : "[&_>_div]:bg-[var(--rb-panel-accent)]"), "rounded-full h-[6px] bg-panel-surface")} />
							</div>

							{waitingForAPI && (
								<p className="text-[12px] text-panel-text-muted text-center">
									{t("dashboard.maintenance.autoRefreshAfterRestart")}
								</p>
							)}

							<div className={cn("rounded-[16px] border overflow-hidden", outputBg, outputBorder)}>
								<div className={cn("flex items-center justify-between px-3.5 py-2 border-b bg-panel-elevated", outputBorder)}>
									<div className="flex items-center gap-2">
										<CommandLineIcon className="w-14 h-14 text-[var(--rb-panel-accent)]" />
										<p className="text-[11px] font-semibold text-panel-text-secondary leading-[1]">
											{t("dashboard.maintenance.liveLogs")}
										</p>
									</div>
									<Tooltip label={logsCopied ? t("dashboard.maintenance.logsCopied") : t("dashboard.maintenance.copyLogs")} openDelay={300} closeOnClick={false} closeOnMouseDown className="text-[10px]">
										<IconButton aria-label={t("dashboard.maintenance.copyLogs")} tabIndex={-1} icon={logsCopied ? <CheckIcon className="w-13" /> : <ClipboardIcon className="w-13" />} size="xs" variant="ghost" onClick={() => {
												const logs = cleanTerminalOutput(operation?.logs);
												if (logs) {
													navigator.clipboard.writeText(logs);
													setLogsCopied(true);
													setTimeout(() => setLogsCopied(false), 2000);
												}
											}} className={cn("h-[22px] w-[22px] min-w-[22px]! rounded-[6px] hover:text-panel-text", logsCopied ? "text-green-500" : "text-panel-text-muted")} />
									</Tooltip>
								</div>

								<pre ref={logsContainerRef} dir="ltr" className={"[&::-webkit-scrollbar]:w-[6px] [&::-webkit-scrollbar-thumb]:bg-[rgba(255,_255,_255,_0.12)] [&::-webkit-scrollbar-thumb]:rounded-[3px] max-h-[220px] overflow-y-auto p-3.5 text-[11px] [font-family:'JetBrains_Mono',_'Fira_Code',_Menlo,_Monaco,_Consolas,_monospace] leading-[1.6] text-panel-text text-left whitespace-pre-wrap break-all"}>
									{cleanTerminalOutput(operation?.logs) || t("dashboard.maintenance.waitingForOutput")}
								</pre>
							</div>
						</div>
					</ModalBody>
				</ModalContent>
			</Modal>

			<Modal isOpen={confirmAction !== null} onClose={() => setConfirmAction(null)} isCentered size="md">
				<ModalOverlay className="bg-blackAlpha-600 [backdrop-filter:blur(6px)]" />
				<ModalContent className="bg-panel-surface border-panel-border! border rounded-2xl shadow-[0_24px_60px_rgba(0,0,0,0.4)] mx-4">
					<ModalHeader className="text-[1rem] font-bold text-panel-text pb-2">
						{confirmAction === "restart"
							? t("dashboard.maintenance.restartConfirmTitle")
							: confirmAction === "soft-reload"
								? t("dashboard.maintenance.softReloadConfirmTitle")
								: t("dashboard.maintenance.updateConfirmTitle")}
					</ModalHeader>
					<ModalCloseButton />
							<ModalBody className="py-3">
								<div className="flex flex-col gap-3">
									<p className="text-[13px] text-panel-text-secondary leading-[1.625]">
									{confirmAction === "restart"
								? t("dashboard.maintenance.restartConfirmDescription")
								: confirmAction === "soft-reload"
									? t("dashboard.maintenance.softReloadConfirmDescription")
									: selectedChannel === "dev"
										? t("dashboard.maintenance.updateDevConfirmDescription")
										: t("dashboard.maintenance.updateConfirmDescription", {
												target: selectedTarget || update?.target || "-",
											})}
									</p>
									{confirmAction === "update" && selectedVersion && (
										<Alert status="warning" className="rounded-xl text-[12px]">
											<AlertIcon />
											<p>{t("dashboard.maintenance.versionSwitchWarning")}</p>
										</Alert>
									)}
								</div>
					</ModalBody>
					<ModalFooter className="gap-2 pt-3">
						<Button variant="ghost" size="sm" onClick={() => setConfirmAction(null)} className="rounded-full text-panel-text-muted">
							{t("cancel")}
						</Button>
						<Button colorScheme={confirmAction === "restart" ? "red" : selectedChannel === "dev" && confirmAction === "update" ? "orange" : "primary"} size="sm" isLoading={restartMutation.isLoading || reloadMutation.isLoading || updateMutation.isLoading} onClick={() => {
								const act = confirmAction;
								setConfirmAction(null);
								if (act === "restart") restartMutation.mutate();
								if (act === "soft-reload") reloadMutation.mutate();
								if (act === "update") executeUpdate();
							}} className="rounded-full px-5">
							{t("confirm")}
						</Button>
					</ModalFooter>
				</ModalContent>
			</Modal>
		</div>
	);
};
