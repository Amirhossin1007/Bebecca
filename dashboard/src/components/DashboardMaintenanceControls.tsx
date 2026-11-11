import { useMutation, useQuery } from "@tanstack/react-query";
import { AppDialog } from "components/dialogs/AppDialog";
import { Alert } from "components/ui/alert";
import { Button } from "components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
} from "components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "components/ui/field";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "components/ui/popover";
import { Progress } from "components/ui/progress";
import { toast } from "components/ui/sonner";
import { Spinner } from "components/ui/spinner";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "components/ui/tooltip";
import useGetUser from "hooks/useGetUser";
import { cn } from "lib/cn";
import {
	Check,
	CircleAlert,
	CircleCheck,
	Clipboard,
	Power,
	RefreshCw,
	RotateCcw,
	Sparkles,
	Terminal,
	TriangleAlert,
	Upload,
} from "lucide-react";
import { type FC, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { fetch } from "service/http";
import { AdminRole } from "types/Admin";
import {
	generateErrorMessage,
	generateSuccessMessage,
} from "utils/toastHandler";
import {
	type BuildCatalog,
	BuildVersionSelect,
} from "./BuildVersionSelect";
import { PanelSelect as Select } from "./common/PanelSelect";
import { DashboardBackupControls } from "./RebeccaBackupPanel";

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

const ESC_CHAR = String.fromCharCode(27);
const CSI_CHAR = String.fromCharCode(155);
const BEL_CHAR = String.fromCharCode(7);
const BS_CHAR = String.fromCharCode(8);

const ansiEscapePattern = new RegExp(
	`${ESC_CHAR}|${CSI_CHAR}|[${ESC_CHAR}${CSI_CHAR}][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[a-zA-Z\\d]*)*)?${BEL_CHAR})|(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]))`,
	"g",
);
const backspacePattern = new RegExp(BS_CHAR, "g");

const cleanTerminalOutput = (logs?: string[]) =>
	(logs || [])
		.join("\n")
		.replace(ansiEscapePattern, "")
		.replace(backspacePattern, "")
		.trimEnd();

export interface DashboardMaintenanceControlsProps {
	channel?: string;
	version: string;
}

export const DashboardMaintenanceControls: FC<DashboardMaintenanceControlsProps> = ({
	channel,
	version,
}) => {
	const { t } = useTranslation();
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

	const [selectedChannel, setSelectedChannel] =
		useState<UpdateChannel>("current");
	const [selectedVersion, setSelectedVersion] = useState("");
	const [operation, setOperation] = useState<MaintenanceOperation | null>(null);
	const [waitingForAPI, setWaitingForAPI] = useState(false);
	const [isUpdateDialogOpen, setUpdateDialogOpen] = useState(false);
	const [confirmAction, setConfirmAction] = useState<
		"restart" | "soft-reload" | "update" | null
	>(null);
	const [logsCopied, setLogsCopied] = useState(false);

	const logsContainerRef = useRef<HTMLPreElement | null>(null);
	const panelReturnPollRef = useRef<number | null>(null);
	const panelReturnSawOfflineRef = useRef(false);

	const info = useQuery<MaintenanceInfo>({
		queryKey: ["dashboard-maintenance-info"],
		queryFn: () => fetch<MaintenanceInfo>("/maintenance/info", { timeout: 8000 }),
		enabled: canMaintain || canBackUp,
		refetchOnWindowFocus: false,
		staleTime: 5 * 60 * 1000,
		retry: false,
	});

	const panel = info.data?.panel;
	const update = panel?.update;
	const installMode = panel?.mode || panel?.install_mode;
	const hostActionsAvailable = installMode === "binary";

	const builds = useQuery<BuildCatalog>({
		queryKey: ["maintenance-builds", "panel"],
		queryFn: () =>
			fetch<BuildCatalog>("/maintenance/builds?target=panel", {
				timeout: 12000,
			}),
		enabled: canMaintain && hostActionsAvailable,
		refetchOnWindowFocus: false,
		staleTime: 10 * 60 * 1000,
		retry: false,
	});

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
		const build = [
			...(builds.data?.stable ?? []),
			...(builds.data?.dev ?? []),
		].find((item) => item.version === value);
		if (build) {
			setSelectedChannel(build.channel === "dev" ? "dev" : "latest");
		}
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
				const status = (error as { response?: { status?: number } })?.response
					?.status;
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

	useEffect(() => {
		if (
			!operation?.id ||
			waitingForAPI ||
			operation.error ||
			operation.phase === "completed"
		) {
			return;
		}
		let failures = 0;
		const timer = window.setInterval(async () => {
			try {
				const status = await fetch<MaintenanceOperation>(
					"/maintenance/status",
					{ timeout: 2500 },
				);
				failures = 0;
				if (status.id && status.id !== operation.id) return;
				if (!status.id) {
					startPanelReturnPolling();
					return;
				}
				setOperation(status);
				if (shouldWaitForPanelReturn(status)) startPanelReturnPolling();
			} catch {
				failures += 1;
				if (failures >= 3) startPanelReturnPolling();
			}
		}, 1000);
		return () => window.clearInterval(timer);
	}, [
		operation?.id,
		operation?.error,
		operation?.phase,
		waitingForAPI,
		startPanelReturnPolling,
	]);

	useEffect(() => {
		if (operation?.logs && logsContainerRef.current) {
			logsContainerRef.current.scrollTop =
				logsContainerRef.current.scrollHeight;
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
		} catch (error: unknown) {
			const maybeErr = error as { response?: unknown };
			if (!maybeErr?.response) return { wentOffline: true };
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

	const updateMutation = useMutation({
		mutationFn: () =>
			triggerAction("update", {
				channel: selectedChannel,
				...(selectedVersion ? { version: selectedVersion } : {}),
			}),
		retry: false,
		onSuccess: (result) => handleSuccess("update", result),
		onError: (error) => {
			setUpdateDialogOpen(false);
			generateErrorMessage(error, toast);
		},
	});

	const restartMutation = useMutation({
		mutationFn: () => triggerAction("restart"),
		retry: false,
		onSuccess: (result) => handleSuccess("restart", result),
		onError: (error) => {
			generateErrorMessage(error, toast);
		},
	});

	const reloadMutation = useMutation({
		mutationFn: () => triggerAction("soft-reload"),
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

	const isStandardAdminOnly = !canMaintain && !canBackUp;
	if (isStandardAdminOnly) {
		return null;
	}

	const renderUpdatePopover = () => (
		<Popover>
			<PopoverTrigger asChild>
				<Button
					disabled={!canMaintain || !hostActionsAvailable || info.isLoading}
					size="xs"
					variant={update?.available ? "default" : "outline"}
					className={cn(
						"h-9 w-full min-[769px]:w-auto px-3.5 rounded-[12px] whitespace-nowrap transition-[background-color,border-color,color,transform,box-shadow] duration-200 ease-out active:scale-[0.98]",
						update?.available
							? "bg-panel-accent text-white border border-panel-accent shadow-[0_4px_14px_-2px_rgba(37,99,235,0.45)] min-[769px]:hover:bg-panel-accent-hover"
							: "border border-panel-border bg-panel-surface/80 text-panel-text shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] min-[769px]:hover:bg-panel-elevated min-[769px]:hover:border-panel-border-strong",
					)}
				>
					<span className="inline-flex items-center justify-center gap-2">
						{update?.available ? (
							<Sparkles className="size-4 shrink-0 text-white" />
						) : (
							<Upload className="size-4 shrink-0 text-panel-text-secondary" />
						)}
						<span className="text-[12px] font-semibold leading-none">
							{update?.available
								? t("dashboard.maintenance.updateAvailable")
								: t("dashboard.maintenance.updateAction")}
						</span>
					</span>
				</Button>
			</PopoverTrigger>
			<PopoverContent
				align="end"
				sideOffset={8}
				collisionPadding={12}
				onClick={(e) => e.stopPropagation()}
				className="w-[min(460px,calc(100vw-24px))] max-w-[460px] max-h-[var(--radix-popover-content-available-height)] overflow-y-auto overscroll-contain rounded-[20px] border border-panel-border bg-panel-surface p-0 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.5)]"
			>
				<div className="flex items-center justify-between gap-3 border-b border-panel-border px-4 py-3">
					<p className="text-[13px] font-bold tracking-[-0.01em] text-panel-text">
						{t("dashboard.maintenance.title")}
					</p>
					<Button
						onClick={() => info.refetch()}
						variant="ghost"
						size="xs"
						loading={info.isFetching}
						className="h-7 rounded-[10px] px-2.5 text-[11px] text-panel-text-muted min-[769px]:hover:bg-panel-elevated min-[769px]:hover:text-panel-text"
					>
						<RefreshCw className="size-3.5" />
						<span>{t("refresh")}</span>
					</Button>
				</div>

				<div className="flex flex-col gap-4 p-4">
					{info.isLoading && (
						<div className="flex items-center justify-center py-5">
							<Spinner className="text-panel-accent" />
						</div>
					)}

					{info.isError && (
						<Alert
							variant="destructive"
							className="rounded-[14px] text-[12px]"
						>
							<CircleAlert className="size-4" aria-hidden="true" />
							<p className="text-[12px] leading-relaxed">
								{t("dashboard.maintenance.updateCheckFailed", {
									error:
										(info.error as Error)?.message ||
										t("dashboard.system.genericError"),
								})}
							</p>
						</Alert>
					)}

					<div className="flex items-center justify-between gap-3 rounded-[14px] border border-panel-border bg-panel-elevated/65 px-3.5 py-3">
						<div className="flex flex-col gap-0.5 min-w-0">
							<p className="text-[11px] font-semibold text-panel-text-muted">
								{t("dashboard.maintenance.panelVersion")}
							</p>
							<p
								dir="ltr"
								className="truncate text-[13px] font-bold text-panel-text tabular-nums [unicode-bidi:isolate]"
							>
								{panel?.image
									? `${panel.image} (${currentVersion})`
									: currentVersion}
							</p>
						</div>
						{panel?.channel && (
							<span
								dir="ltr"
								className="shrink-0 rounded-full border border-panel-border bg-panel-surface px-2.5 py-0.5 text-[11px] font-semibold text-panel-text-secondary [unicode-bidi:isolate]"
							>
								{panel.channel}
							</span>
						)}
					</div>

					{info.isSuccess && !hostActionsAvailable && (
						<Alert className="rounded-[14px] text-[12px]">
							<TriangleAlert className="size-4" aria-hidden="true" />
							<p className="text-[12px] leading-relaxed">
								{t("dashboard.maintenance.binaryMigrationRequired")}
							</p>
						</Alert>
					)}

					{update?.available && (
						<Alert className="rounded-[14px] border border-emerald-500/25 bg-emerald-500/8 text-[12px]">
							<CircleCheck
								className="size-4 text-emerald-400"
								aria-hidden="true"
							/>
							<p className="text-[12px] leading-relaxed text-panel-text">
								{t("dashboard.maintenance.updateAvailableNotice", {
									current: update.current || currentVersion,
									target: selectedTarget || update.target || "-",
								})}
							</p>
						</Alert>
					)}

					{update?.error && (
						<Alert className="rounded-[14px] text-[12px]">
							<TriangleAlert className="size-4" aria-hidden="true" />
							<p className="text-[12px] leading-relaxed">
								{t("dashboard.maintenance.updateCheckFailed", {
									error: update.error,
								})}
							</p>
						</Alert>
					)}

					{hostActionsAvailable && (
						<Field className="flex flex-col gap-1.5">
							<FieldLabel className="text-[12px] font-semibold text-panel-text-secondary">
								{t("dashboard.maintenance.updateChannel")}
							</FieldLabel>
							<Select
								size="sm"
								portalled={false}
								value={selectedChannel}
								onChange={(event) => {
									setSelectedChannel(event.target.value as UpdateChannel);
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
							<FieldDescription className="text-[11px] leading-relaxed text-panel-text-muted">
								{selectedTarget
									? t("dashboard.maintenance.updateTargetHint", {
											version: selectedTarget,
										})
									: t("dashboard.maintenance.updateTargetUnknown")}
							</FieldDescription>
						</Field>
					)}

					{hostActionsAvailable && (
						<BuildVersionSelect
							catalog={builds.data}
							value={selectedVersion}
							onChange={selectBuildVersion}
						/>
					)}

					{selectedChannel === "dev" && hostActionsAvailable && (
						<Alert className="rounded-[14px] border border-amber-500/25 bg-amber-500/8 text-[12px]">
							<TriangleAlert
								className="size-4 text-amber-400"
								aria-hidden="true"
							/>
							<p className="text-[12px] leading-relaxed text-panel-text-secondary">
								{t("dashboard.maintenance.devChannelWarning")}
							</p>
						</Alert>
					)}

					<div className="flex flex-wrap items-center justify-end gap-2 border-t border-panel-border pt-3">
						<Button
							onClick={() => setConfirmAction("soft-reload")}
							disabled={!hostActionsAvailable}
							variant="outline"
							size="xs"
							loading={reloadMutation.isPending}
							className="h-8 rounded-[10px] border-panel-border px-3 text-[12px] font-semibold text-panel-text min-[769px]:hover:bg-panel-elevated"
						>
							<RotateCcw className="size-3.5" />
							<span>{t("dashboard.maintenance.softReloadAction")}</span>
						</Button>
						<Button
							onClick={() => setConfirmAction("update")}
							disabled={!hostActionsAvailable}
							size="xs"
							loading={updateMutation.isPending}
							className="h-8 rounded-[10px] px-4 text-[12px] font-semibold"
						>
							<Upload className="size-3.5" />
							<span>{t("dashboard.maintenance.updateAction")}</span>
						</Button>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);

	const renderRestartButton = (extraClassName?: string) => (
		<Button
			onClick={() => setConfirmAction("restart")}
			disabled={info.isPending || !hostActionsAvailable}
			variant="outline"
			size="xs"
			loading={restartMutation.isPending}
			className={cn(
				"h-9 px-3.5 rounded-[12px] border border-red-500/30 bg-red-500/6 text-red-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-[background-color,border-color,color,transform] duration-200 ease-out min-[769px]:hover:bg-red-500/14 min-[769px]:hover:border-red-500/50 active:scale-[0.98] whitespace-nowrap",
				extraClassName,
			)}
		>
			<span className="inline-flex items-center justify-center gap-2">
				<Power className="size-4 shrink-0" />
				<span className="text-[12px] font-semibold leading-none">
					{t("dashboard.maintenance.restartAction")}
				</span>
			</span>
		</Button>
	);

	return (
		<div className="flex w-full min-[769px]:w-auto shrink-0 items-center justify-end">
			<div className="hidden min-[769px]:flex flex-row items-center justify-end gap-2 shrink-0">
				{canMaintain && renderUpdatePopover()}
				{canBackUp && (
					<DashboardBackupControls
						isBinaryRuntime={hostActionsAvailable}
						runtimeLoading={info.isLoading}
					/>
				)}
				{canMaintain && renderRestartButton()}
			</div>

			<div className="flex min-[769px]:hidden flex-col gap-2 w-full">
				{canMaintain && <div className="w-full">{renderUpdatePopover()}</div>}
				<div className="flex w-full items-center gap-2">
					{canBackUp && (
						<div className="min-w-0 flex-1">
							<DashboardBackupControls
								isBinaryRuntime={hostActionsAvailable}
								runtimeLoading={info.isLoading}
								className="w-full"
							/>
						</div>
					)}
					{canMaintain && renderRestartButton("min-w-0 flex-1")}
				</div>
			</div>

			<AppDialog
				open={isUpdateDialogOpen}
				onClose={() => setUpdateDialogOpen(false)}
				size="lg"
				title={t("dashboard.maintenance.updateProgressTitle")}
				footer={
					<>
						<Button
							onClick={() => setUpdateDialogOpen(false)}
							variant="ghost"
							size="sm"
							className="rounded-[12px]"
						>
							{t("close")}
						</Button>
						{(operation?.error || operation?.phase === "completed") && (
							<Button
								onClick={() => window.location.reload()}
								size="sm"
								className="rounded-[12px]"
							>
								{t("refresh")}
							</Button>
						)}
					</>
				}
			>
				<div className="flex flex-col gap-4">
					<div className="flex items-center justify-between gap-3 rounded-[14px] border border-panel-border bg-panel-elevated/55 px-3.5 py-2.5 text-[13px]">
						<p
							dir="ltr"
							className="font-semibold text-panel-text-secondary tabular-nums [unicode-bidi:isolate]"
						>
							{selectedTarget
								? `${currentVersion} → ${selectedTarget}`
								: currentVersion}
						</p>
						{typeof operation?.progress === "number" && (
							<p
								dir="ltr"
								className="font-bold text-panel-accent tabular-nums [unicode-bidi:isolate]"
							>
								{Math.round(operation.progress)}%
							</p>
						)}
					</div>

					<div className="flex flex-col gap-2.5">
						<div className="flex items-center gap-2">
							{operation?.error ? (
								<CircleAlert
									className="size-4 text-destructive"
									aria-hidden="true"
								/>
							) : operation?.phase === "completed" ? (
								<CircleCheck
									className="size-4 text-emerald-400"
									aria-hidden="true"
								/>
							) : (
								<Spinner className="text-panel-accent" />
							)}
							<p className="text-[13px] font-bold text-panel-text">
								{operation?.phase
									? t(
											`dashboard.maintenance.phase.${operation.phase}`,
											operation.phase,
										)
									: t("dashboard.maintenance.phase.queued")}
							</p>
						</div>
						<Progress
							value={
								typeof operation?.progress === "number"
									? operation.progress
									: undefined
							}
							className="h-1.5 rounded-full"
						/>
						<p className="text-[12px] leading-relaxed text-panel-text-secondary">
							{operation?.error
								? operation.error
								: operation?.message
									? t(
											`dashboard.maintenance.message.${operation.message.replace(/[^a-zA-Z]/g, "")}`,
											operation.message,
										)
									: t("dashboard.maintenance.message.preparingUpdate")}
						</p>
						{waitingForAPI && !operation?.error && (
							<p className="text-[12px] text-panel-text-muted">
								{t("dashboard.maintenance.autoRefreshAfterRestart")}
							</p>
						)}
					</div>

					<div className="flex flex-col gap-2">
						<div className="flex items-center justify-between gap-2">
							<div className="flex items-center gap-2 text-[12px] font-bold text-panel-text">
								<Terminal className="size-3.5 text-panel-text-muted" />
								<span>{t("dashboard.maintenance.liveLogs")}</span>
							</div>
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										aria-label={t("dashboard.maintenance.copyLogs")}
										onClick={() => {
											const logs = cleanTerminalOutput(operation?.logs);
											if (!logs) return;
											navigator.clipboard.writeText(logs);
											setLogsCopied(true);
											window.setTimeout(() => setLogsCopied(false), 2000);
										}}
										variant="ghost"
										size="xs"
										className="h-7 rounded-[8px] px-2"
									>
										{logsCopied ? (
											<Check className="size-3.5 text-emerald-400" />
										) : (
											<Clipboard className="size-3.5" />
										)}
									</Button>
								</TooltipTrigger>
								<TooltipContent>
									{logsCopied
										? t("dashboard.maintenance.logsCopied")
										: t("dashboard.maintenance.copyLogs")}
								</TooltipContent>
							</Tooltip>
						</div>
						<pre
							ref={logsContainerRef}
							dir="ltr"
							className="max-h-[260px] min-h-[130px] overflow-auto rounded-[14px] border border-panel-border bg-panel-elevated p-3.5 font-mono text-[12px] leading-[1.65] whitespace-pre-wrap break-all text-panel-text"
						>
							{cleanTerminalOutput(operation?.logs) ||
								t("dashboard.maintenance.waitingForOutput")}
						</pre>
					</div>
				</div>
			</AppDialog>

			<Dialog
				open={confirmAction !== null}
				onOpenChange={(open) => {
					if (!open) setConfirmAction(null);
				}}
			>
				<DialogContent className="mx-4 sm:mx-0 max-w-[440px] rounded-[20px] border border-panel-border bg-panel-surface p-0 shadow-[0_28px_70px_-12px_rgba(0,0,0,0.55)] overflow-hidden">
					<DialogHeader className="border-b border-panel-border px-5 py-4 text-[15px] font-bold text-panel-text">
						<div className="flex items-center gap-2.5">
							<span
								className={cn(
									"flex size-8 items-center justify-center rounded-[10px]",
									confirmAction === "restart"
										? "bg-red-500/12 text-red-400"
										: "bg-panel-elevated text-panel-accent",
								)}
							>
								{confirmAction === "restart" ? (
									<Power className="size-4" />
								) : confirmAction === "soft-reload" ? (
									<RotateCcw className="size-4" />
								) : (
									<Upload className="size-4" />
								)}
							</span>
							<span>
								{confirmAction === "restart"
									? t("dashboard.maintenance.restartConfirmTitle")
									: confirmAction === "soft-reload"
										? t("dashboard.maintenance.softReloadConfirmTitle")
										: t("dashboard.maintenance.updateConfirmTitle")}
							</span>
						</div>
					</DialogHeader>

					<div className="flex flex-col gap-3 px-5 py-4">
						<p className="text-[13px] leading-relaxed text-panel-text-secondary">
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
							<Alert className="rounded-[14px] border border-amber-500/25 bg-amber-500/8 text-[12px]">
								<TriangleAlert
									className="size-4 text-amber-400"
									aria-hidden="true"
								/>
								<p className="text-[12px] leading-relaxed text-panel-text-secondary">
									{t("dashboard.maintenance.versionSwitchWarning")}
								</p>
							</Alert>
						)}
					</div>

					<DialogFooter className="gap-2 border-t border-panel-border bg-panel-surface px-5 py-3.5">
						<Button
							onClick={() => setConfirmAction(null)}
							variant="ghost"
							size="sm"
							className="rounded-[12px] text-panel-text-muted"
						>
							{t("cancel")}
						</Button>
						<Button
							onClick={() => {
								const act = confirmAction;
								setConfirmAction(null);
								if (act === "restart") restartMutation.mutate();
								if (act === "soft-reload") reloadMutation.mutate();
								if (act === "update") executeUpdate();
							}}
							size="sm"
							variant={confirmAction === "restart" ? "destructive" : "default"}
							loading={
								restartMutation.isPending ||
								reloadMutation.isPending ||
								updateMutation.isPending
							}
							className="rounded-[12px] px-5"
						>
							{t("confirm")}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
};
