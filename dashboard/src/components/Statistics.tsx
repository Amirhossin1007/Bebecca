import {
	Badge,
	Box,
	type BoxProps,
	Button,
	chakra,
	Flex,
	HStack,
	Modal,
	ModalBody,
	ModalCloseButton,
	ModalContent,
	ModalFooter,
	ModalHeader,
	ModalOverlay,
	Progress,
	SimpleGrid,
	Spinner,
	Stack,
	Text,
	useColorMode,
	useColorModeValue,
	VStack,
} from "@chakra-ui/react";
import {
	ArrowDownTrayIcon,
	ArrowUpTrayIcon,
	CircleStackIcon,
	ClockIcon,
	CpuChipIcon,
	ExclamationTriangleIcon,
	ServerStackIcon,
	ShieldCheckIcon,
	SignalIcon,
	UserGroupIcon,
} from "@heroicons/react/24/outline";
import type { ApexOptions } from "apexcharts";
import { useDashboard } from "contexts/DashboardContext";
import useGetUser from "hooks/useGetUser";
import type { TFunction } from "i18next";
import { type FC, type ReactNode, useEffect, useMemo, useState } from "react";
import Chart from "react-apexcharts";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "react-query";
import { fetch } from "service/http";
import { AdminRole } from "types/Admin";
import type { SystemStats } from "types/System";
import { formatBytes, numberWithCommas } from "utils/formatByte";
import { getAPIWebSocketURL } from "utils/websocket";
import { ChartBox } from "./common/ChartBox";
import { DashboardMaintenanceControls } from "./DashboardMaintenanceControls";

export const StatisticsQueryKey = "statistics-query-key";

/* فرمت هوشمند و دقیق زمان (فقط ثانیه / دقیقه و ثانیه / ساعت و دقیقه / روز، ساعت و دقیقه) */
const formatLocalizedDuration = (
	totalSeconds: number,
	t: TFunction,
	isRTL: boolean,
): string => {
	if (!totalSeconds || totalSeconds <= 0) {
		return `0 ${t("second", "ثانیه")}`;
	}

	const days = Math.floor(totalSeconds / 86400);
	const hours = Math.floor((totalSeconds % 86400) / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = Math.floor(totalSeconds % 60);

	const dText = `${days} ${t("day", "روز")}`;
	const hText = `${hours} ${t("hour", "ساعت")}`;
	const mText = `${minutes} ${t("minute", "دقیقه")}`;
	const sText = `${seconds} ${t("second", "ثانیه")}`;

	const andWord = isRTL ? " و " : " and ";
	const commaWord = isRTL ? "، " : ", ";

	if (days > 0) {
		const parts: string[] = [dText];
		if (hours > 0) parts.push(hText);
		if (minutes > 0) parts.push(mText);
		if (parts.length === 1) return parts[0];
		if (parts.length === 2) return parts.join(andWord);
		return parts.slice(0, -1).join(commaWord) + andWord + parts[parts.length - 1];
	}

	if (hours > 0) {
		if (minutes > 0) return `${hText}${andWord}${mText}`;
		return hText;
	}

	if (minutes > 0) {
		if (seconds > 0) return `${mText}${andWord}${sText}`;
		return mText;
	}

	return sText;
};

const useSystemMetricsStream = (enabled = true) => {
	const queryClient = useQueryClient();
	useEffect(() => {
		if (!enabled || typeof window === "undefined") return;
		const url = getAPIWebSocketURL("/system/metrics", { interval: 3 });
		if (!url) return;
		let closed = false;
		let ws: WebSocket | null = null;
		let reconnectTimer: number | undefined;

		const connect = () => {
			ws = new WebSocket(url);
			ws.onmessage = (event) => {
				try {
					const payload = JSON.parse(event.data);
					const stats = payload?.stats ?? payload;
					if (!stats || typeof stats !== "object" || !("version" in stats)) return;
					queryClient.setQueryData<SystemStats>(StatisticsQueryKey, stats);
				} catch (error) {
					console.error("Unable to parse system metrics stream payload", error);
				}
			};
			ws.onerror = () => ws?.close();
			ws.onclose = () => {
				if (!closed) reconnectTimer = window.setTimeout(connect, 3000);
			};
		};

		connect();
		return () => {
			closed = true;
			if (reconnectTimer) window.clearTimeout(reconnectTimer);
			ws?.close();
		};
	}, [enabled, queryClient]);
};

const toFiniteNumber = (value: unknown, fallback = 0) => {
	const next = Number(value);
	return Number.isFinite(next) ? next : fallback;
};

const safeHistory = (value: unknown): SystemStats["cpu_history"] =>
	Array.isArray(value)
		? value.map((entry) => ({
				timestamp: toFiniteNumber((entry as any)?.timestamp),
				value: toFiniteNumber((entry as any)?.value),
			}))
		: [];

const safeNetworkHistory = (value: unknown): SystemStats["network_history"] =>
	Array.isArray(value)
		? value.map((entry) => ({
				timestamp: toFiniteNumber((entry as any)?.timestamp),
				incoming: toFiniteNumber((entry as any)?.incoming),
				outgoing: toFiniteNumber((entry as any)?.outgoing),
			}))
		: [];

const safeUsageStats = (value: unknown): SystemStats["memory"] => {
	const raw = value && typeof value === "object" ? (value as any) : {};
	return {
		current: toFiniteNumber(raw.current),
		total: toFiniteNumber(raw.total),
		percent: toFiniteNumber(raw.percent),
	};
};

const sanitizeSystemStats = (value: SystemStats | undefined): SystemStats | null => {
	if (!value || typeof value !== "object") return null;
	const raw = value as any;
	return {
		...value,
		version: String(raw.version ?? ""),
		cpu_cores: toFiniteNumber(raw.cpu_cores),
		cpu_threads: toFiniteNumber(raw.cpu_threads),
		cpu_frequency_hz: toFiniteNumber(raw.cpu_frequency_hz),
		cpu_usage: toFiniteNumber(raw.cpu_usage),
		total_user: toFiniteNumber(raw.total_user),
		online_users: toFiniteNumber(raw.online_users),
		users_active: toFiniteNumber(raw.users_active),
		users_on_hold: toFiniteNumber(raw.users_on_hold),
		users_disabled: toFiniteNumber(raw.users_disabled),
		users_expired: toFiniteNumber(raw.users_expired),
		users_limited: toFiniteNumber(raw.users_limited),
		incoming_bandwidth: toFiniteNumber(raw.incoming_bandwidth),
		outgoing_bandwidth: toFiniteNumber(raw.outgoing_bandwidth),
		panel_total_bandwidth: toFiniteNumber(raw.panel_total_bandwidth),
		incoming_bandwidth_speed: toFiniteNumber(raw.incoming_bandwidth_speed),
		outgoing_bandwidth_speed: toFiniteNumber(raw.outgoing_bandwidth_speed),
		memory: safeUsageStats(raw.memory),
		swap: safeUsageStats(raw.swap),
		disk: safeUsageStats(raw.disk),
		load_avg: Array.isArray(raw.load_avg) ? raw.load_avg.map((item: unknown) => toFiniteNumber(item)) : [],
		uptime_seconds: toFiniteNumber(raw.uptime_seconds),
		panel_uptime_seconds: toFiniteNumber(raw.panel_uptime_seconds),
		xray_uptime_seconds: toFiniteNumber(raw.xray_uptime_seconds),
		xray_running: Boolean(raw.xray_running),
		xray_version: raw.xray_version ?? null,
		app_memory: toFiniteNumber(raw.app_memory),
		app_threads: toFiniteNumber(raw.app_threads),
		panel_cpu_percent: toFiniteNumber(raw.panel_cpu_percent),
		panel_memory_percent: toFiniteNumber(raw.panel_memory_percent),
		cpu_history: safeHistory(raw.cpu_history),
		memory_history: safeHistory(raw.memory_history),
		swap_history: safeHistory(raw.swap_history),
		disk_history: safeHistory(raw.disk_history),
		network_history: safeNetworkHistory(raw.network_history),
		panel_cpu_history: safeHistory(raw.panel_cpu_history),
		panel_memory_history: safeHistory(raw.panel_memory_history),
		personal_usage:
			raw.personal_usage && typeof raw.personal_usage === "object"
				? {
						total_users: toFiniteNumber(raw.personal_usage.total_users),
						consumed_bytes: toFiniteNumber(raw.personal_usage.consumed_bytes),
						built_bytes: toFiniteNumber(raw.personal_usage.built_bytes),
						reset_bytes: toFiniteNumber(raw.personal_usage.reset_bytes),
						traffic_basis: raw.personal_usage.traffic_basis,
					}
				: {
						total_users: 0,
						consumed_bytes: 0,
						built_bytes: 0,
						reset_bytes: 0,
						traffic_basis: "used_traffic",
					},
		admin_overview:
			raw.admin_overview && typeof raw.admin_overview === "object"
				? {
						total_admins: toFiniteNumber(raw.admin_overview.total_admins),
						sudo_admins: toFiniteNumber(raw.admin_overview.sudo_admins),
						full_access_admins: toFiniteNumber(raw.admin_overview.full_access_admins),
						standard_admins: toFiniteNumber(raw.admin_overview.standard_admins),
						top_admin_username: raw.admin_overview.top_admin_username ?? null,
						top_admin_usage: toFiniteNumber(raw.admin_overview.top_admin_usage),
					}
				: {
						total_admins: 0,
						sudo_admins: 0,
						full_access_admins: 0,
						standard_admins: 0,
						top_admin_username: null,
						top_admin_usage: 0,
					},
	};
};

const formatNumberValue = (value?: number | null) => numberWithCommas(value);
const clampPercent = (value: number) => Math.min(100, Math.max(0, value));

const HISTORY_INTERVALS = [
	{ labelKey: "historyInterval.2m", seconds: 120 },
	{ labelKey: "historyInterval.10m", seconds: 600 },
	{ labelKey: "historyInterval.30m", seconds: 1800 },
	{ labelKey: "historyInterval.1h", seconds: 3600 },
	{ labelKey: "historyInterval.3h", seconds: 10800 },
	{ labelKey: "historyInterval.5h", seconds: 18000 },
];

type HistoryModalPayload = {
	type: "cpu" | "memory" | "network" | "panelCpu" | "panelMemory";
	title: string;
	metricLabel?: string;
	entries?: Array<{ timestamp: number; value: number }>;
	networkEntries?: SystemStats["network_history"];
};

const HistoryModal: FC<{
	isOpen: boolean;
	onClose: () => void;
	payload: HistoryModalPayload | null;
	intervalSeconds: number;
	onIntervalChange: (value: number) => void;
	t: TFunction;
}> = ({ isOpen, onClose, payload, intervalSeconds, onIntervalChange, t }) => {
	const { colorMode } = useColorMode();
	const gridColor = useColorModeValue("rgba(0, 0, 0, 0.06)", "rgba(255, 255, 255, 0.06)");
	const mutedTextColor = useColorModeValue("#64748b", "#94a3b8");

	const latestTimestamp = useMemo(() => {
		if (!payload) return Math.floor(Date.now() / 1000);
		if (payload.type === "network" && payload.networkEntries?.length) {
			return payload.networkEntries[payload.networkEntries.length - 1].timestamp;
		}
		return payload.entries?.[payload.entries.length - 1]?.timestamp ?? Math.floor(Date.now() / 1000);
	}, [payload]);

	const cutoff = latestTimestamp - intervalSeconds;

	const chartSeries = useMemo(() => {
		if (!payload) return [];
		if (payload.type === "network" && payload.networkEntries) {
			const filtered = payload.networkEntries.filter((e) => e.timestamp >= cutoff);
			return [
				{
					name: t("networkIncoming"),
					data: filtered.map((entry) => [entry.timestamp * 1000, entry.incoming]),
				},
				{
					name: t("networkOutgoing"),
					data: filtered.map((entry) => [entry.timestamp * 1000, entry.outgoing]),
				},
			];
		}
		if (payload.entries) {
			const filtered = payload.entries.filter((e) => e.timestamp >= cutoff);
			return [
				{
					name: payload.metricLabel ?? payload.title,
					data: filtered.map((entry) => [entry.timestamp * 1000, entry.value]),
				},
			];
		}
		return [];
	}, [payload, cutoff, t]);

	const options: ApexOptions = useMemo(
		() => ({
			chart: {
				type: "area",
				animations: { enabled: false },
				toolbar: { show: false },
				zoom: { enabled: false },
				background: "transparent",
				fontFamily: "inherit",
			},
			colors: ["#3b82f6", "#10b981"],
			fill: {
				type: "gradient",
				gradient: {
					shadeIntensity: 1,
					opacityFrom: 0.35,
					opacityTo: 0.02,
					stops: [0, 100],
				},
			},
			dataLabels: { enabled: false },
			theme: { mode: colorMode },
			stroke: { curve: "smooth", width: 2 },
			grid: {
				borderColor: gridColor,
				strokeDashArray: 3,
				xaxis: { lines: { show: false } },
				yaxis: { lines: { show: true } },
			},
			xaxis: {
				type: "datetime",
				axisBorder: { show: false },
				axisTicks: { show: false },
				labels: {
					style: { colors: mutedTextColor, fontSize: "11px", fontFamily: "inherit" },
					datetimeFormatter: { hour: "HH:mm" },
				},
			},
			yaxis: {
				decimalsInFloat: 0,
				labels: {
					style: { colors: mutedTextColor, fontSize: "11px", fontFamily: "inherit" },
				},
			},
			legend: {
				position: "bottom",
				labels: { colors: mutedTextColor },
			},
			tooltip: {
				theme: colorMode,
				x: { format: "HH:mm:ss" },
			},
		}),
		[colorMode, gridColor, mutedTextColor],
	);

	return (
		<Modal isOpen={isOpen} onClose={onClose} size="2xl" scrollBehavior="inside" isCentered>
			<ModalOverlay bg="blackAlpha.600" backdropFilter="blur(8px)" />
			<ModalContent
				bg="panel.surface"
				borderWidth="1px"
				borderColor="panel.border"
				borderRadius="2xl"
				boxShadow="2xl"
			>
				<ModalHeader
					display="flex"
					alignItems="center"
					justifyContent="space-between"
					px={6}
					py={4}
					borderBottomWidth="1px"
					borderColor="panel.border"
					fontSize="md"
					fontWeight="bold"
				>
					<Text>{t("historyModalTitle", { metric: payload?.title ?? "" })}</Text>
					<ModalCloseButton position="static" />
				</ModalHeader>
				<ModalBody px={6} py={5}>
					<Stack spacing={5}>
						<Flex wrap="wrap" gap={2}>
							{HISTORY_INTERVALS.map((interval) => (
								<Button
									key={interval.seconds}
									size="xs"
									h="28px"
									borderRadius="full"
									variant={intervalSeconds === interval.seconds ? "solid" : "outline"}
									colorScheme={intervalSeconds === interval.seconds ? "primary" : "gray"}
									onClick={() => onIntervalChange(interval.seconds)}
								>
									{t(interval.labelKey)}
								</Button>
							))}
						</Flex>
						<Box minH="280px">
							<Chart
								key={`chart-${intervalSeconds}`}
								options={options}
								series={chartSeries}
								type="area"
								height={280}
							/>
						</Box>
					</Stack>
				</ModalBody>
				<ModalFooter px={6} py={3} borderTopWidth="1px" borderColor="panel.border">
					<Button onClick={onClose} borderRadius="full" variant="ghost" size="sm">
						{t("close")}
					</Button>
				</ModalFooter>
			</ModalContent>
		</Modal>
	);
};

/* Modern Hardware Bento Card */
const HardwareBentoCard: FC<{
	label: string;
	icon: ReactNode;
	primaryValue: string;
	percent: number;
	subtitle?: string;
	onViewHistory?: () => void;
	actionLabel?: string;
}> = ({ label, icon, primaryValue, percent, subtitle, onViewHistory, actionLabel }) => {
	const cardBg = useColorModeValue("panel.input", "panel.input");
	const borderColor = useColorModeValue("panel.border", "panel.border");
	const safePercent = clampPercent(percent);

	return (
		<Box
			borderWidth="1px"
			borderColor={borderColor}
			borderRadius="2xl"
			bg={cardBg}
			p={{ base: 4, md: 5 }}
			position="relative"
			overflow="hidden"
			transition="all 0.2s cubic-bezier(0.16, 1, 0.3, 1)"
			_hover={{
				borderColor: "panel.borderStrong",
				transform: "translateY(-2px)",
				boxShadow: "sm",
			}}
		>
			<Stack spacing={3.5}>
				<Flex justify="space-between" align="center">
					<HStack spacing={2.5}>
						<Box color="panel.textMuted">{icon}</Box>
						<Text fontSize="xs" fontWeight="700" color="panel.textSecondary">
							{label}
						</Text>
					</HStack>
					{onViewHistory && (
						<Button
							size="xs"
							h="24px"
							px={2.5}
							fontSize="11px"
							variant="ghost"
							borderRadius="full"
							color="panel.textMuted"
							_hover={{ color: "panel.text", bg: "panel.elevated" }}
							onClick={onViewHistory}
						>
							{actionLabel ?? "نمایش تاریخچه"}
						</Button>
					)}
				</Flex>

				<Flex justify="space-between" align="baseline">
					<Text
						fontSize={{ base: "2xl", md: "3xl" }}
						fontWeight="800"
						lineHeight="1"
						color="panel.text"
						dir="ltr"
						sx={{ fontVariantNumeric: "tabular-nums", unicodeBidi: "isolate" }}
					>
						{primaryValue}
					</Text>
					{subtitle && (
						<Text
							fontSize="xs"
							fontWeight="600"
							color="panel.textMuted"
							dir="ltr"
							sx={{ unicodeBidi: "isolate", fontVariantNumeric: "tabular-nums" }}
						>
							{subtitle}
						</Text>
					)}
				</Flex>

				<Progress
					value={safePercent}
					size="xs"
					colorScheme="primary"
					bg="panel.elevated"
					borderRadius="full"
					h="4px"
				/>
			</Stack>
		</Box>
	);
};

/* Modern Metric Cell */
const MetricCell: FC<{
	label: string;
	value: number | string;
	percentage?: string;
	dotColor?: string;
}> = ({ label, value, percentage, dotColor }) => (
	<Flex
		p={4}
		borderRadius="xl"
		bg="panel.input"
		borderWidth="1px"
		borderColor="panel.border"
		justify="space-between"
		align="center"
		transition="all 0.15s ease"
		_hover={{ borderColor: "panel.borderStrong", transform: "translateY(-1px)" }}
	>
		<HStack spacing={2.5} minW={0}>
			{dotColor && <Box w="8px" h="8px" borderRadius="full" bg={dotColor} flexShrink={0} />}
			<Text fontSize="xs" fontWeight="700" color="panel.textSecondary" noOfLines={1}>
				{label}
			</Text>
		</HStack>
		<HStack spacing={2}>
			{percentage && (
				<Text fontSize="11px" color="panel.textMuted" dir="ltr">
					{percentage}
				</Text>
			)}
			<Text
				fontSize="md"
				fontWeight="800"
				color="panel.text"
				dir="ltr"
				sx={{ fontVariantNumeric: "tabular-nums" }}
			>
				{typeof value === "number" ? formatNumberValue(value) : value}
			</Text>
		</HStack>
	</Flex>
);

export const Statistics: FC<BoxProps> = (props) => {
	const { version } = useDashboard();
	const { userData } = useGetUser();
	const { t, i18n } = useTranslation();
	const isRTL = i18n.dir(i18n.language) === "rtl";

	const { data: rawSystemData } = useQuery<SystemStats>({
		queryKey: StatisticsQueryKey,
		queryFn: () => fetch("/system"),
		onSuccess: (stats) => {
			const currentVersion = stats?.version;
			if (currentVersion && version !== currentVersion) {
				useDashboard.setState({ version: currentVersion });
			}
		},
	});

	const systemData = useMemo(() => sanitizeSystemStats(rawSystemData), [rawSystemData]);
	useSystemMetricsStream(true);

	useEffect(() => {
		if (systemData?.version && version !== systemData.version) {
			useDashboard.setState({ version: systemData.version });
		}
	}, [systemData?.version, version]);

	const [historyPayload, setHistoryPayload] = useState<HistoryModalPayload | null>(null);
	const [historyInterval, setHistoryInterval] = useState(HISTORY_INTERVALS[0].seconds);
	const [userTab, setUserTab] = useState<"all" | "mine">("all");

	const canSeeGlobal =
		userData.role === AdminRole.Sudo || userData.role === AdminRole.FullAccess;

	const openHistory = (payload: HistoryModalPayload) => {
		setHistoryInterval(HISTORY_INTERVALS[0].seconds);
		setHistoryPayload(payload);
	};

	if (!systemData) {
		return (
			<Flex justify="center" align="center" minH="300px">
				<Spinner size="md" color="panel.accent" />
			</Flex>
		);
	}

	const cpuSubtitle = `${formatNumberValue(systemData.cpu_cores)} ${t("cores")}`;
	const panelCpuSubtitle = `${formatNumberValue(systemData.app_threads)} ${t("threads")}`;

	const activePercent =
		systemData.total_user > 0
			? `${((systemData.users_active / systemData.total_user) * 100).toFixed(1)}%`
			: "0.0%";

	const onlinePercent =
		systemData.total_user > 0
			? `${((systemData.online_users / systemData.total_user) * 100).toFixed(1)}%`
			: "0.0%";

	return (
		<Stack spacing={5} w="full" dir={isRTL ? "rtl" : "ltr"} {...props}>
			{/* 1. Main System & Hardware ChartBox */}
			<ChartBox
				title={
					<Text fontWeight="800" fontSize={{ base: "md", md: "lg" }} color="panel.text">
						{t("systemOverview")}
					</Text>
				}
				headerActions={
					<DashboardMaintenanceControls
						channel={systemData.channel}
						version={systemData.version}
					/>
				}
			>
				<Stack spacing={5}>
					{/* Hardware Metrics 4-Card Grid */}
					<SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} gap={4}>
						<HardwareBentoCard
							label={t("cpuUsage")}
							icon={<CpuChipIcon width={18} />}
							primaryValue={`${systemData.cpu_usage.toFixed(1)}%`}
							percent={systemData.cpu_usage}
							subtitle={cpuSubtitle}
							actionLabel={t("viewHistory")}
							onViewHistory={() =>
								openHistory({
									type: "cpu",
									title: t("cpuUsage"),
									metricLabel: t("cpuUsage"),
									entries: systemData.cpu_history,
								})
							}
						/>
						<HardwareBentoCard
							label={t("memoryUsage")}
							icon={<ServerStackIcon width={18} />}
							primaryValue={`${formatBytes(systemData.memory.current, 1)} / ${formatBytes(systemData.memory.total, 1)}`}
							percent={systemData.memory.percent}
							subtitle={`${systemData.memory.percent.toFixed(1)}%`}
							actionLabel={t("viewHistory")}
							onViewHistory={() =>
								openHistory({
									type: "memory",
									title: t("memoryUsage"),
									metricLabel: t("memoryUsage"),
									entries: systemData.memory_history,
								})
							}
						/>
						<HardwareBentoCard
							label={t("swapUsage")}
							icon={<CircleStackIcon width={18} />}
							primaryValue={`${formatBytes(systemData.swap.current, 1)} / ${formatBytes(systemData.swap.total, 1)}`}
							percent={systemData.swap.percent}
							subtitle={`${systemData.swap.percent.toFixed(1)}%`}
						/>
						<HardwareBentoCard
							label={t("diskUsage")}
							icon={<CircleStackIcon width={18} />}
							primaryValue={`${formatBytes(systemData.disk.current, 1)} / ${formatBytes(systemData.disk.total, 1)}`}
							percent={systemData.disk.percent}
							subtitle={`${systemData.disk.percent.toFixed(1)}%`}
						/>
					</SimpleGrid>

					{/* Unified Network Speeds & System Uptime Box */}
					<Box
						p={{ base: 4, md: 5 }}
						borderRadius="2xl"
						bg="panel.input"
						borderWidth="1px"
						borderColor="panel.border"
					>
						<Flex justify="space-between" align="center" mb={4} flexWrap="wrap" gap={2}>
							<HStack spacing={2.5}>
								<SignalIcon width={18} color="var(--rb-panel-accent)" />
								<Text fontSize="sm" fontWeight="700" color="panel.text">
									{t("bandwidthSpeed")}
								</Text>
							</HStack>
							<Button
								size="xs"
								h="24px"
								px={2.5}
								variant="ghost"
								borderRadius="full"
								color="panel.textMuted"
								_hover={{ color: "panel.text", bg: "panel.elevated" }}
								onClick={() =>
									openHistory({
										type: "network",
										title: t("networkHistory"),
										networkEntries: systemData.network_history,
									})
								}
							>
								{t("viewHistory")}
							</Button>
						</Flex>

						<SimpleGrid columns={{ base: 1, sm: 3 }} gap={3.5}>
							<Flex
								p={3.5}
								borderRadius="xl"
								bg="panel.elevated"
								borderWidth="1px"
								borderColor="panel.border"
								justify="space-between"
								align="center"
							>
								<HStack spacing={2.5}>
									<ArrowDownTrayIcon width={18} color="#22c55e" />
									<Text fontSize="xs" fontWeight="700" color="panel.textSecondary">
										{t("incomingSpeed")}
									</Text>
								</HStack>
								<Text
									fontSize="sm"
									fontWeight="800"
									color="panel.text"
									dir="ltr"
									sx={{ fontVariantNumeric: "tabular-nums" }}
								>
									{formatBytes(systemData.incoming_bandwidth_speed)}/s
								</Text>
							</Flex>

							<Flex
								p={3.5}
								borderRadius="xl"
								bg="panel.elevated"
								borderWidth="1px"
								borderColor="panel.border"
								justify="space-between"
								align="center"
							>
								<HStack spacing={2.5}>
									<ArrowUpTrayIcon width={18} color="#3b82f6" />
									<Text fontSize="xs" fontWeight="700" color="panel.textSecondary">
										{t("outgoingSpeed")}
									</Text>
								</HStack>
								<Text
									fontSize="sm"
									fontWeight="800"
									color="panel.text"
									dir="ltr"
									sx={{ fontVariantNumeric: "tabular-nums" }}
								>
									{formatBytes(systemData.outgoing_bandwidth_speed)}/s
								</Text>
							</Flex>

							<Flex
								p={3.5}
								borderRadius="xl"
								bg="panel.elevated"
								borderWidth="1px"
								borderColor="panel.border"
								justify="space-between"
								align="center"
							>
								<HStack spacing={2.5}>
									<ClockIcon width={18} color="var(--rb-panel-accent)" />
									<Text fontSize="xs" fontWeight="700" color="panel.textSecondary">
										{t("systemUptime")}
									</Text>
								</HStack>
								<Text
									fontSize="xs"
									fontWeight="800"
									color="panel.text"
									dir={isRTL ? "rtl" : "ltr"}
								>
									{formatLocalizedDuration(systemData.uptime_seconds, t, isRTL)}
								</Text>
							</Flex>
						</SimpleGrid>
					</Box>

					{/* Errors inside System Overview Card (At the Bottom) */}
					{systemData.last_xray_error && (
						<Box
							p={4}
							borderRadius="xl"
							bg="red.950"
							borderWidth="1px"
							borderColor="red.600"
							color="red.100"
							boxShadow="0 0 16px rgba(220, 38, 38, 0.15)"
						>
							<HStack spacing={2} mb={1.5} color="red.300">
								<ExclamationTriangleIcon width={18} />
								<Text fontSize="xs" fontWeight="800">
									{t("coreError")}
								</Text>
							</HStack>
							<Text fontSize="xs" fontFamily="mono" wordBreak="break-word" lineHeight="tall">
								{systemData.last_xray_error}
							</Text>
						</Box>
					)}

					{systemData.last_telegram_error && (
						<Box
							p={4}
							borderRadius="xl"
							bg="orange.950"
							borderWidth="1px"
							borderColor="orange.600"
							color="orange.100"
							boxShadow="0 0 16px rgba(234, 88, 12, 0.15)"
						>
							<HStack spacing={2} mb={2} align="center" justify="space-between">
								<HStack spacing={2} color="orange.300">
									<ExclamationTriangleIcon width={18} />
									<Text fontSize="xs" fontWeight="800">
										{t("telegramError")}
									</Text>
								</HStack>
								<Button
									size="xs"
									colorScheme="orange"
									variant="outline"
									borderRadius="full"
									onClick={() => {
										window.location.href = "/settings";
									}}
								>
									{t("goToTelegramSettings")}
								</Button>
							</HStack>
							<Text fontSize="xs" fontFamily="mono" wordBreak="break-word" lineHeight="tall">
								{systemData.last_telegram_error}
							</Text>
						</Box>
					)}
				</Stack>
			</ChartBox>

			{/* 2. Panel Usage Card */}
			<ChartBox
				title={
					<HStack spacing={3} align="center" flexWrap="wrap">
						<Text fontWeight="800" fontSize={{ base: "md", md: "lg" }} color="panel.text">
							{t("panelUsage")}
						</Text>
						{/* Running Status Badge */}
						<Badge
							colorScheme={systemData.xray_running ? "green" : "red"}
							borderRadius="full"
							px={3}
							py={0.5}
							fontSize="11px"
							display="inline-flex"
							alignItems="center"
							gap={1.5}
						>
							<Box
								w="6px"
								h="6px"
								borderRadius="full"
								bg={systemData.xray_running ? "green.400" : "red.400"}
								boxShadow={
									systemData.xray_running
										? "0 0 8px rgba(74, 222, 128, 0.8)"
										: "0 0 8px rgba(248, 113, 113, 0.8)"
								}
							/>
							{systemData.xray_running ? t("status.running") : t("status.stopped")}
						</Badge>
					</HStack>
				}
				headerActions={
					<HStack spacing={1.5} fontSize="xs" color="panel.textMuted">
						<Text fontWeight="600">{t("panelUptime")}:</Text>
						<Text fontWeight="700" color="panel.textSecondary">
							{formatLocalizedDuration(systemData.panel_uptime_seconds, t, isRTL)}
						</Text>
					</HStack>
				}
			>
				<SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
					<HardwareBentoCard
						label={`${t("cpuUsage")} (Panel Process)`}
						icon={<CpuChipIcon width={18} />}
						primaryValue={`${systemData.panel_cpu_percent.toFixed(1)}%`}
						percent={systemData.panel_cpu_percent}
						subtitle={panelCpuSubtitle}
						actionLabel={t("viewHistory")}
						onViewHistory={() =>
							openHistory({
								type: "panelCpu",
								title: `${t("cpuUsage")} (Panel Process)`,
								metricLabel: `${t("cpuUsage")} (Panel Process)`,
								entries: systemData.panel_cpu_history,
							})
						}
					/>
					<HardwareBentoCard
						label={`${t("memoryUsage")} (Panel Heap)`}
						icon={<ServerStackIcon width={18} />}
						primaryValue={`${formatBytes(systemData.app_memory, 1)} / ${formatBytes(systemData.memory.total, 1)}`}
						percent={systemData.panel_memory_percent}
						subtitle={`${systemData.panel_memory_percent.toFixed(1)}%`}
						actionLabel={t("viewHistory")}
						onViewHistory={() =>
							openHistory({
								type: "panelMemory",
								title: `${t("memoryUsage")} (Panel Heap)`,
								metricLabel: `${t("memoryUsage")} (Panel Heap)`,
								entries: systemData.panel_memory_history,
							})
						}
					/>
				</SimpleGrid>
			</ChartBox>

			{/* 3. Users Overview ChartBox */}
			<ChartBox
				title={
					<HStack spacing={2}>
						<UserGroupIcon width={18} color="var(--rb-panel-accent)" />
						<Text fontWeight="800" fontSize={{ base: "md", md: "lg" }}>
							{t("usersOverview")}
						</Text>
					</HStack>
				}
				headerActions={
					canSeeGlobal ? (
						<HStack spacing={1} bg="panel.input" p={0.5} borderRadius="lg">
							<Button
								size="xs"
								h="24px"
								px={2.5}
								borderRadius="md"
								variant={userTab === "all" ? "solid" : "ghost"}
								colorScheme={userTab === "all" ? "primary" : "gray"}
								onClick={() => setUserTab("all")}
							>
								{t("allUsers", "همه کاربران")}
							</Button>
							<Button
								size="xs"
								h="24px"
								px={2.5}
								borderRadius="md"
								variant={userTab === "mine" ? "solid" : "ghost"}
								colorScheme={userTab === "mine" ? "primary" : "gray"}
								onClick={() => setUserTab("mine")}
							>
								{t("myUsers", "کاربران من")}
							</Button>
						</HStack>
					) : (
						<Badge colorScheme="blue" borderRadius="full" px={3} py={0.5} fontSize="11px">
							{t("total")}: {formatNumberValue(systemData.total_user)}
						</Badge>
					)
				}
			>
				<SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} gap={3.5}>
					<MetricCell
						label={t("total")}
						value={
							userTab === "mine"
								? (systemData.personal_usage?.total_users ?? 0)
								: systemData.total_user
						}
					/>
					<MetricCell
						label={t("status.active")}
						value={
							userTab === "mine"
								? (systemData.personal_usage?.total_users ?? 0)
								: systemData.users_active
						}
						percentage={userTab === "all" ? activePercent : undefined}
						dotColor="#22c55e"
					/>
					<MetricCell
						label={userTab === "mine" ? t("consumedData") : t("onlineUsers")}
						value={
							userTab === "mine"
								? formatBytes(systemData.personal_usage?.consumed_bytes ?? 0, 1)
								: systemData.online_users
						}
						percentage={userTab === "all" ? onlinePercent : undefined}
						dotColor={userTab === "all" ? "#06b6d4" : undefined}
					/>
					<MetricCell
						label={t("status.on_hold")}
						value={userTab === "mine" ? 0 : systemData.users_on_hold}
						dotColor="#a855f7"
					/>
					<MetricCell
						label={t("status.limited")}
						value={userTab === "mine" ? 0 : systemData.users_limited}
						dotColor="#eab308"
					/>
					<MetricCell
						label={t("status.expired")}
						value={userTab === "mine" ? 0 : systemData.users_expired}
						dotColor="#f97316"
					/>
				</SimpleGrid>
			</ChartBox>

			{/* 4. Admins Overview ChartBox (Sudo / FullAccess Only) */}
			{canSeeGlobal && systemData.admin_overview && (
				<ChartBox
					title={
						<HStack spacing={2}>
							<ShieldCheckIcon width={18} color="var(--rb-panel-accent)" />
							<Text fontWeight="800" fontSize={{ base: "md", md: "lg" }}>
								{t("adminOverview")}
							</Text>
						</HStack>
					}
					headerActions={
						<Badge colorScheme="purple" borderRadius="full" px={3} py={0.5} fontSize="11px">
							{t("totalAdmins")}: {formatNumberValue(systemData.admin_overview.total_admins)}
						</Badge>
					}
				>
					<Stack spacing={4}>
						<SimpleGrid columns={{ base: 1, sm: 3 }} gap={3.5}>
							<MetricCell
								label={t("fullAccessAdmins")}
								value={systemData.admin_overview.full_access_admins}
								dotColor="#eab308"
							/>
							<MetricCell
								label={t("sudoAdmins")}
								value={systemData.admin_overview.sudo_admins}
								dotColor="#a855f7"
							/>
							<MetricCell
								label={t("standardAdmins")}
								value={systemData.admin_overview.standard_admins}
								dotColor="#3b82f6"
							/>
						</SimpleGrid>

						{systemData.admin_overview.top_admin_username && (
							<Flex
								p={3.5}
								borderRadius="xl"
								bg="panel.input"
								borderWidth="1px"
								borderColor="panel.border"
								justify="space-between"
								align="center"
								fontSize="xs"
							>
								<Text color="panel.textMuted">
									{t("topAdmin")}:{" "}
									<chakra.span fontWeight="800" color="panel.text">
										{systemData.admin_overview.top_admin_username}
									</chakra.span>
								</Text>
								<Text color="panel.text" fontWeight="700" dir="ltr">
									{formatBytes(systemData.admin_overview.top_admin_usage)}
								</Text>
							</Flex>
						)}
					</Stack>
				</ChartBox>
			)}

			{/* History Modal */}
			<HistoryModal
				isOpen={Boolean(historyPayload)}
				onClose={() => setHistoryPayload(null)}
				payload={historyPayload}
				intervalSeconds={historyInterval}
				onIntervalChange={setHistoryInterval}
				t={t}
			/>
		</Stack>
	);
};