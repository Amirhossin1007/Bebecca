import {
	Alert,
	AlertIcon,
	Box,
	Button,
	Flex,
	FormControl,
	FormHelperText,
	FormLabel,
	HStack,
	Modal,
	ModalBody,
	ModalCloseButton,
	ModalContent,
	ModalHeader,
	ModalOverlay,
	Popover,
	PopoverBody,
	PopoverContent,
	PopoverHeader,
	PopoverTrigger,
	Progress,
	Spinner,
	Stack,
	Text,
	useColorModeValue,
	useToast,
} from "@chakra-ui/react";
import {
	ArrowPathIcon,
	ArrowsRightLeftIcon,
	ArrowUpTrayIcon,
} from "@heroicons/react/24/outline";
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
	// biome-ignore lint/suspicious/noControlCharactersInRegex: Remove ANSI terminal control sequences from maintenance logs.
	/[\u001B\u009B][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[a-zA-Z\d]*)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g;

const cleanTerminalOutput = (logs?: string[]) =>
	(logs || [])
		.join("\n")
		.replace(ansiEscapePattern, "")
		.replace(/\r(?!\n)/g, "\n")
		// biome-ignore lint/suspicious/noControlCharactersInRegex: Remove backspace characters from maintenance logs.
		.replace(/\u0008/g, "")
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
	const outputBg = useColorModeValue("gray.50", "blackAlpha.400");
	const outputBorder = useColorModeValue("gray.200", "whiteAlpha.200");
	const [selectedChannel, setSelectedChannel] =
		useState<UpdateChannel>("current");
	const [operation, setOperation] = useState<MaintenanceOperation | null>(null);
	const [waitingForAPI, setWaitingForAPI] = useState(false);
	const [devUpdateArmed, setDevUpdateArmed] = useState(false);
	const [isUpdateMenuOpen, setUpdateMenuOpen] = useState(false);
	const [isUpdateDialogOpen, setUpdateDialogOpen] = useState(false);
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
	const fallbackVersion = channel?.toLowerCase() === "dev" ? "dev" : version;
	const currentVersion =
		panel?.tag || update?.current || fallbackVersion || "-";
	const selectedTarget =
		selectedChannel === "dev"
			? update?.latest_dev?.tag
			: selectedChannel === "latest"
				? update?.latest_release?.tag
				: update?.target;

	useEffect(() => {
		if (panel?.channel === "dev" || panel?.channel === "latest") {
			setSelectedChannel(panel.channel);
		}
	}, [panel?.channel]);

	const clearPanelReturnPolling = useCallback(() => {
		if (panelReturnPollRef.current !== null) {
			window.clearInterval(panelReturnPollRef.current);
			panelReturnPollRef.current = null;
		}
	}, []);

	const startPanelReturnPolling = useCallback(() => {
		if (panelReturnPollRef.current !== null) return;
		const startedAt = Date.now();
		panelReturnSawOfflineRef.current = false;
		setWaitingForAPI(true);
		panelReturnPollRef.current = window.setInterval(async () => {
			try {
				await fetch<MaintenanceInfo>("/maintenance/info", { timeout: 2500 });
				if (panelReturnSawOfflineRef.current || Date.now() - startedAt > 7000) {
					clearPanelReturnPolling();
					window.location.reload();
				}
			} catch {
				panelReturnSawOfflineRef.current = true;
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
				? t("settings.panel.maintenanceWaitingForAPI")
				: t("settings.panel.maintenanceQueued"),
			restarting: result.wentOffline,
		};
		setOperation(nextOperation);
		generateSuccessMessage(
			t(
				action === "update"
					? "settings.panel.updateTriggered"
					: action === "restart"
						? "settings.panel.restartTriggered"
						: "settings.panel.softReloadTriggered",
			),
			toast,
		);
		if (result.wentOffline || shouldWaitForPanelReturn(nextOperation)) {
			startPanelReturnPolling();
		}
		window.setTimeout(() => info.refetch(), 6000);
	};

	const updateMutation = useMutation(
		() => triggerAction("update", { channel: selectedChannel }),
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

	const startUpdate = () => {
		if (selectedChannel === "dev" && !devUpdateArmed) {
			setDevUpdateArmed(true);
			toast({
				status: "warning",
				title: t("settings.panel.devChannelConfirmTitle"),
				description: t("settings.panel.devChannelConfirm"),
				duration: 10_000,
				isClosable: true,
			});
			devUpdateTimerRef.current = window.setTimeout(
				() => setDevUpdateArmed(false),
				10_000,
			);
			return;
		}
		if (devUpdateTimerRef.current !== null) {
			window.clearTimeout(devUpdateTimerRef.current);
			devUpdateTimerRef.current = null;
		}
		setDevUpdateArmed(false);
		setUpdateMenuOpen(false);
		setOperation(null);
		setUpdateDialogOpen(true);
		updateMutation.mutate();
	};

	const renderUpdatePopover = () => (
		<Popover
			isOpen={isUpdateMenuOpen}
			onOpen={() => setUpdateMenuOpen(true)}
			onClose={() => setUpdateMenuOpen(false)}
			placement="bottom-end"
			closeOnBlur={!operation?.running}
		>
			<PopoverTrigger>
				<Button
					size="xs"
					h="32px"
					w="full"
					colorScheme={update?.available ? "green" : "primary"}
					variant={update?.available ? "solid" : "outline"}
					borderRadius="full"
					leftIcon={<ArrowUpTrayIcon width={14} height={14} />}
					fontSize="11px"
					fontWeight="700"
				>
					{update?.available
						? `${t("nodes.nodeUpdateAvailable", "به‌روزرسانی موجود")} ↑`
						: t("settings.panel.updateAction")}
				</Button>
			</PopoverTrigger>
			<PopoverContent
				w="min(480px, calc(100vw - 24px))"
				maxW="480px"
				borderRadius="2xl"
				boxShadow="2xl"
				bg="panel.surface"
				borderColor="panel.border"
			>
				<PopoverHeader fontWeight="bold" py={3} borderColor="panel.border">
					<Flex justify="space-between" align="center" gap={3}>
						<Text>{t("settings.panel.maintenanceTitle")}</Text>
						<Button
							size="xs"
							variant="ghost"
							borderRadius="full"
							leftIcon={<ArrowPathIcon width={14} height={14} />}
							onClick={() => info.refetch()}
							isLoading={info.isFetching}
						>
							{t("refresh")}
						</Button>
					</Flex>
				</PopoverHeader>
				<PopoverBody p={4}>
					<Stack spacing={3}>
						{info.isLoading && (
							<Flex align="center" justify="center" py={5}>
								<Spinner size="sm" />
							</Flex>
						)}
						{info.isError && (
							<Alert status="error" borderRadius="md">
								<AlertIcon />
								<Text fontSize="sm">
									{t("settings.panel.updateCheckFailed", {
										error:
											(info.error as Error)?.message ||
											t("errors.generic"),
									})}
								</Text>
							</Alert>
						)}
						<Box>
							<Text fontSize="sm" fontWeight="semibold">
								{t("settings.panel.panelVersion")}
							</Text>
							<Text fontSize="sm" color="gray.500">
								{panel?.image
									? `${panel.image} (${currentVersion})`
									: currentVersion}
							</Text>
						</Box>
						{info.isSuccess && !hostActionsAvailable && (
							<Alert status="warning" borderRadius="md">
								<AlertIcon />
								<Text fontSize="sm">
									{t("settings.panel.binaryMigrationRequired")}
								</Text>
							</Alert>
						)}
						{update?.available && (
							<Alert status="success" borderRadius="md">
								<AlertIcon />
								<Text fontSize="sm">
									{t("settings.panel.updateAvailableNotice", {
										current: update.current || currentVersion,
										target: selectedTarget || update.target || "-",
									})}
								</Text>
							</Alert>
						)}
						{update?.error && (
							<Alert status="warning" borderRadius="md">
								<AlertIcon />
								<Text fontSize="sm">
									{t("settings.panel.updateCheckFailed", {
										error: update.error,
									})}
								</Text>
							</Alert>
						)}
						{hostActionsAvailable && (
							<FormControl>
								<FormLabel fontSize="sm">
									{t("settings.panel.updateChannel")}
								</FormLabel>
								<Select
									size="sm"
									portalled={false}
									value={selectedChannel}
									onChange={(event) => {
										setSelectedChannel(
											event.target.value as UpdateChannel,
										);
										setDevUpdateArmed(false);
									}}
								>
									<option value="current">
										{t("settings.panel.updateChannelCurrent")}
									</option>
									<option value="latest">
										{t("settings.panel.updateChannelLatest")}
									</option>
									<option value="dev">
										{t("settings.panel.updateChannelDev")}
									</option>
								</Select>
								<FormHelperText>
									{selectedTarget
										? t("settings.panel.updateTargetHint", {
												version: selectedTarget,
											})
										: t("settings.panel.updateTargetUnknown")}
								</FormHelperText>
							</FormControl>
						)}
						{selectedChannel === "dev" && hostActionsAvailable && (
							<Alert status="warning" borderRadius="md">
								<AlertIcon />
								<Text fontSize="sm">
									{t("settings.panel.devChannelWarning")}
								</Text>
							</Alert>
						)}
						<Flex gap={2} flexWrap="wrap" justify="flex-end">
							<Button
								size="xs"
								h="28px"
								px={3}
								variant="outline"
								borderRadius="full"
								onClick={() => reloadMutation.mutate()}
								isLoading={reloadMutation.isLoading}
								isDisabled={!hostActionsAvailable}
							>
								{t("settings.panel.softReloadAction")}
							</Button>
							<Button
								size="xs"
								h="28px"
								px={3}
								colorScheme={
									devUpdateArmed
										? "orange"
										: update?.available
											? "green"
											: "primary"
								}
								borderRadius="full"
								onClick={startUpdate}
								isLoading={updateMutation.isLoading}
								isDisabled={!hostActionsAvailable}
							>
								{devUpdateArmed
									? t("settings.panel.confirmDevUpdateAction")
									: t("settings.panel.updateAction")}
							</Button>
						</Flex>
					</Stack>
				</PopoverBody>
			</PopoverContent>
		</Popover>
	);

	return (
		<Flex align="center" justify="flex-end" w={{ base: "full", md: "auto" }}>
			{/* Desktop Layout: Single Horizontal Row */}
			<HStack
				display={{ base: "none", md: "flex" }}
				spacing={2}
				align="center"
				justify="flex-end"
			>
				<Flex
					h="32px"
					px={3.5}
					align="center"
					justify="center"
					borderRadius="full"
					fontSize="11px"
					fontWeight="700"
					bg="panel.elevated"
					color="panel.textSecondary"
					borderWidth="1px"
					borderColor="panel.border"
				>
					{currentVersion}
				</Flex>

				{canMaintain && <Box minW="140px">{renderUpdatePopover()}</Box>}

				{canBackUp && (
					<DashboardBackupControls
						isBinaryRuntime={hostActionsAvailable}
						runtimeLoading={info.isLoading}
					/>
				)}

				{canMaintain && (
					<Button
						size="xs"
						h="32px"
						px={3.5}
						colorScheme="red"
						variant="outline"
						borderRadius="full"
						leftIcon={<ArrowsRightLeftIcon width={14} height={14} />}
						onClick={() => restartMutation.mutate()}
						isLoading={restartMutation.isLoading}
						isDisabled={info.isLoading || !hostActionsAvailable}
						fontSize="11px"
						fontWeight="700"
					>
						{t("settings.panel.restartAction")}
					</Button>
				)}
			</HStack>

			{/* Mobile Layout: 2 Perfectly Balanced Rows */}
			<Stack
				display={{ base: "flex", md: "none" }}
				spacing={2}
				w="full"
			>
				{/* Row 1: Version (25%) + Update Action (75%) */}
				<Flex gap={2} w="full" align="center">
					<Flex
						w="25%"
						h="32px"
						align="center"
						justify="center"
						borderRadius="full"
						fontSize="11px"
						fontWeight="700"
						bg="panel.elevated"
						color="panel.textSecondary"
						borderWidth="1px"
						borderColor="panel.border"
						flexShrink={0}
					>
						{currentVersion}
					</Flex>
					{canMaintain ? (
						<Box w="75%">
							{renderUpdatePopover()}
						</Box>
					) : (
						<Box w="75%" />
					)}
				</Flex>

				{/* Row 2: Backup (50%) + Restart (50%) */}
				<Flex gap={2} w="full" align="center">
					{canBackUp && (
						<Box w="50%">
							<DashboardBackupControls
								isBinaryRuntime={hostActionsAvailable}
								runtimeLoading={info.isLoading}
							/>
						</Box>
					)}
					{canMaintain && (
						<Button
							w="50%"
							h="32px"
							size="xs"
							colorScheme="red"
							variant="outline"
							borderRadius="full"
							leftIcon={<ArrowsRightLeftIcon width={14} height={14} />}
							onClick={() => restartMutation.mutate()}
							isLoading={restartMutation.isLoading}
							isDisabled={info.isLoading || !hostActionsAvailable}
							fontSize="11px"
							fontWeight="700"
						>
							{t("settings.panel.restartAction")}
						</Button>
					)}
				</Flex>
			</Stack>

			{/* Update Progress Dialog Modal */}
			<Modal
				isOpen={isUpdateDialogOpen}
				onClose={() => {
					if (operation?.error) setUpdateDialogOpen(false);
				}}
				closeOnEsc={Boolean(operation?.error)}
				closeOnOverlayClick={false}
				isCentered
				size="xl"
			>
				<ModalOverlay bg="blackAlpha.600" backdropFilter="blur(8px)" />
				<ModalContent borderRadius="2xl" overflow="hidden" bg="panel.surface" borderColor="panel.border" borderWidth="1px">
					<ModalHeader>{t("settings.panel.updateProgressTitle")}</ModalHeader>
					{operation?.error ? <ModalCloseButton /> : null}
					<ModalBody pb={6}>
						<Stack spacing={4}>
							<Alert
								status={operation?.error ? "error" : "info"}
								borderRadius="lg"
							>
								<AlertIcon />
								<Box>
									<Text fontWeight="semibold">
										{operation?.phase || t("settings.panel.maintenanceQueued")}
									</Text>
									<Text fontSize="sm">
										{operation?.error ||
											operation?.message ||
											t("settings.panel.waitingForOutput.variant2")}
									</Text>
								</Box>
							</Alert>
							<Progress
								value={
									typeof operation?.progress === "number"
										? operation.progress
										: undefined
								}
								isIndeterminate={
									typeof operation?.progress !== "number" && !operation?.error
								}
								colorScheme={operation?.error ? "red" : "green"}
								borderRadius="full"
								h="6px"
							/>
							{waitingForAPI ? (
								<Text fontSize="sm" color="panel.textMuted">
									{t("settings.panel.autoRefreshAfterRestart")}
								</Text>
							) : null}
							<Box
								as="pre"
								maxH="260px"
								overflowY="auto"
								bg={outputBg}
								border="1px solid"
								borderColor={outputBorder}
								borderRadius="lg"
								p={3}
								fontSize="xs"
								whiteSpace="pre-wrap"
							>
								{cleanTerminalOutput(operation?.logs) ||
									t("settings.panel.waitingForOutput.variant2")}
							</Box>
						</Stack>
					</ModalBody>
				</ModalContent>
			</Modal>
		</Flex>
	);
};