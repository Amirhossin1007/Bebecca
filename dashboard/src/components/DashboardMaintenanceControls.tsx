import {
	Alert,
	AlertIcon,
	Box,
	Button,
	Flex,
	FormControl,
	FormHelperText,
	FormLabel,
	Grid,
	Popover,
	PopoverBody,
	PopoverContent,
	PopoverHeader,
	PopoverTrigger,
	Progress,
	Spinner,
	Stack,
	Tag,
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
import { generateErrorMessage, generateSuccessMessage } from "utils/toastHandler";
import { getAPIWebSocketURL } from "utils/websocket";
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
	const outputBg = useColorModeValue("gray.50", "blackAlpha.400");
	const outputBorder = useColorModeValue("gray.200", "whiteAlpha.200");
	const [selectedChannel, setSelectedChannel] =
		useState<UpdateChannel>("current");
	const [operation, setOperation] = useState<MaintenanceOperation | null>(null);
	const [waitingForAPI, setWaitingForAPI] = useState(false);
	const panelReturnPollRef = useRef<number | null>(null);
	const panelReturnSawOfflineRef = useRef(false);

	const info = useQuery<MaintenanceInfo>(
		["dashboard-maintenance-info"],
		() => fetch<MaintenanceInfo>("/maintenance/info", { timeout: 8000 }),
		{
			enabled: canMaintain,
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
	const currentVersion = panel?.tag || update?.current || fallbackVersion || "-";
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
				if (
					panelReturnSawOfflineRef.current ||
					Date.now() - startedAt > 7000
				) {
					clearPanelReturnPolling();
					window.location.reload();
				}
			} catch {
				panelReturnSawOfflineRef.current = true;
			}
		}, 2000);
	}, [clearPanelReturnPolling]);

	useEffect(() => () => clearPanelReturnPolling(), [clearPanelReturnPolling]);

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
		if (
			selectedChannel === "dev" &&
			!window.confirm(t("settings.panel.devChannelConfirm"))
		) {
			return;
		}
		updateMutation.mutate();
	};

	return (
		<Grid
			templateColumns={{
				base: "repeat(2, minmax(0, 1fr))",
				md: "auto auto auto",
			}}
			gap={2}
			alignItems="center"
			w={{ base: "full", md: "auto" }}
		>
			<Tag
				colorScheme="gray"
				borderRadius="full"
				px={3}
				gridColumn={{ base: "1 / -1", md: "auto" }}
				justifySelf="start"
			>
				{currentVersion}
			</Tag>
			{canMaintain && (
				<>
					<Popover placement="bottom-end" closeOnBlur={!operation?.running}>
						<PopoverTrigger>
							<Button
								size="sm"
								colorScheme={update?.available ? "green" : "primary"}
								variant={update?.available ? "solid" : "outline"}
								borderRadius="full"
								leftIcon={<ArrowUpTrayIcon width={16} height={16} />}
								w="full"
							>
								{update?.available
									? "update avable!"
									: t("settings.panel.updateAction")}
							</Button>
						</PopoverTrigger>
						<PopoverContent
							w="min(480px, calc(100vw - 24px))"
							maxW="480px"
							borderRadius="xl"
							boxShadow="2xl"
						>
							<PopoverHeader fontWeight="bold" py={3}>
								<Flex justify="space-between" align="center" gap={3}>
									<Text>{t("settings.panel.maintenanceTitle")}</Text>
									<Button
										size="xs"
										variant="ghost"
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
												onChange={(event) =>
													setSelectedChannel(event.target.value as UpdateChannel)
												}
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
											size="sm"
											variant="outline"
											borderRadius="full"
											onClick={() => reloadMutation.mutate()}
											isLoading={reloadMutation.isLoading}
											isDisabled={!hostActionsAvailable}
										>
											{t("settings.panel.softReloadAction")}
										</Button>
										<Button
											size="sm"
											colorScheme={update?.available ? "green" : "primary"}
											borderRadius="full"
											onClick={startUpdate}
											isLoading={updateMutation.isLoading}
											isDisabled={!hostActionsAvailable}
										>
											{t("settings.panel.updateAction")}
										</Button>
									</Flex>
									{operation && (
										<Stack spacing={3} pt={2}>
											<Alert
												status={operation.error ? "error" : "info"}
												borderRadius="md"
											>
												<AlertIcon />
												<Box>
													<Text fontWeight="semibold">
														{operation.phase ||
															t("settings.panel.maintenanceQueued")}
													</Text>
													<Text fontSize="sm">
														{operation.error || operation.message}
													</Text>
												</Box>
											</Alert>
											<Progress
												value={
													typeof operation.progress === "number"
														? operation.progress
														: undefined
												}
												isIndeterminate={
													typeof operation.progress !== "number" && !operation.error
												}
												colorScheme={operation.error ? "red" : "green"}
												borderRadius="full"
											/>
											{waitingForAPI && (
												<Text fontSize="sm" color="gray.500">
													{t("settings.panel.autoRefreshAfterRestart")}
												</Text>
											)}
											<Box
												as="pre"
												maxH="180px"
												overflowY="auto"
												bg={outputBg}
												border="1px solid"
												borderColor={outputBorder}
												borderRadius="md"
												p={3}
												fontSize="xs"
												whiteSpace="pre-wrap"
											>
												{cleanTerminalOutput(operation.logs) ||
													t("settings.panel.waitingForOutput.variant2")}
											</Box>
										</Stack>
									)}
								</Stack>
							</PopoverBody>
						</PopoverContent>
					</Popover>
					<Button
						size="sm"
						colorScheme="red"
						variant="outline"
						borderRadius="full"
						leftIcon={<ArrowsRightLeftIcon width={16} height={16} />}
						onClick={() => restartMutation.mutate()}
						isLoading={restartMutation.isLoading}
						isDisabled={info.isLoading || !hostActionsAvailable}
						w="full"
					>
						{t("settings.panel.restartAction")}
					</Button>
				</>
			)}
		</Grid>
	);
};
