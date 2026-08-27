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
	Stack,
	Text,
	useColorMode,
	useColorModeValue,
	VStack,
} from "@chakra-ui/react";
import {
	ArrowDownTrayIcon,
	ArrowUpTrayIcon,
	ChartBarIcon,
	ClockIcon,
	CpuChipIcon,
	CircleStackIcon,
	ServerStackIcon,
	ShieldCheckIcon,
	UserGroupIcon,
	SignalIcon,
} from "@heroicons/react/24/outline";
import { useDashboard } from "contexts/DashboardContext";
import useGetUser from "hooks/useGetUser";
import type { TFunction } from "i18next";
import { type FC, type ReactNode, useEffect, useMemo, useState } from "react";
import Chart from "react-apexcharts";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "react-query";
import { fetch } from "service/http";
import type { SystemStats } from "types/System";
import { formatBytes, numberWithCommas } from "utils/formatByte";
import { formatDuration } from "utils/formatDuration";
import { getAPIWebSocketURL } from "utils/websocket";
import { ChartBox } from "./common/ChartBox";
import { DashboardMaintenanceControls } from "./DashboardMaintenanceControls";
import { AdminRole } from "types/Admin";

export const StatisticsQueryKey = "statistics-query-key";

const useSystemMetricsStream = (enabled = true) => {
	const queryClient = useQueryClient();
	useEffect(() => {
		if (!enabled || typeof window === "undefined") {
			return;
		}
		const url = getAPIWebSocketURL("/system/metrics", { interval: 3 });
		if (!url) {
			return;
		}
		let closed = false;
		let ws: WebSocket | null = null;
		let reconnectTimer: number | undefined;

		const connect = () => {
			ws = new WebSocket(url);
			ws.onmessage = (event) => {
				try {
					const payload = JSON.parse(event.data);
					const stats = payload?.stats ?? payload;
					if (!stats || typeof stats !== "object" || !("version" in stats)) {
						return;
					}
					queryClient.setQueryData<SystemStats>(StatisticsQueryKey, stats);
				} catch (error) {
					console.error("Unable to parse system metrics stream payload", error);
				}
			};
			ws.onerror = () => {
				ws?.close();
			};
			ws.onclose = () => {
				if (!closed) {
					reconnectTimer = window.setTimeout(connect, 3000);
				}
			};
		};

		connect();
		return () => {
			closed = true;
			if (reconnectTimer) {
				window.clearTimeout(reconnectTimer);
			}
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

const sanitizeSystemStats = (
	value: SystemStats | undefined,
): SystemStats | null => {
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
		load_avg: Array.isArray(raw.load_avg)
			? raw.load_avg.map((item: unknown) => toFiniteNumber(item))
			: [],
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
						full_access_admins: toFiniteNumber(
							raw.admin_overview.full_access_admins,
						),
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
const average = (values: number[]) =>
	values.length
		? values.reduce((total, value) => total + value, 0) / values.length
		: 0;
const peak = (values: number[]) => (values.length ? Math.max(...values) : 0);
const formatCPUFrequency = (value: number) =>
	value > 0 ? `${(value / 1_000_000_000).toFixed(2)} GHz` : "";
const getUsageColorScheme = (percent: number) => {
	if (percent >= 85) return "red";
	if (percent >= 65) return "yellow";
	return "green";
};

const HISTORY_INTERVALS = [
	{ labelKey: "historyInterval.2m", seconds: 120 },
	{ labelKey: "historyInterval.10m", seconds: 600 },
	{ labelKey: "historyInterval.30m", seconds: 1800 },
	{ labelKey: "historyInterval.1h", seconds: 3600 },
	{ labelKey: "historyInterval.3h", seconds: 10800 },
	{ labelKey: "historyInterval.5h", seconds: 18000 },
];

type CpuMemoryHistoryPayload = {
	type: "cpu" | "memory";
	title: string;
	metricLabel: string;
	entries: SystemStats["cpu_history"];
};

type NetworkHistoryPayload = {
	type: "network";
	title: string;
	entries: SystemStats["network_history"];
};

type PanelHistoryPayload = {
	type: "panel";
	title: string;
	cpuEntries: SystemStats["panel_cpu_history"];
	memoryEntries: SystemStats["panel_memory_history"];
};

type HistoryModalPayload =
	| CpuMemoryHistoryPayload
	| NetworkHistoryPayload
	| PanelHistoryPayload;

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
		const extractLatest = (entries: Array<{ timestamp: number }>) =>
			entries.length ? entries[entries.length - 1].timestamp : null;
		if (payload.type === "network") {
			return extractLatest(payload.entries) ?? Math.floor(Date.now() / 1000);
		}
		if (payload.type === "panel") {
			return (
				extractLatest(payload.cpuEntries) ??
				extractLatest(payload.memoryEntries) ??
				Math.floor(Date.now() / 1000)
			);
		}
		return extractLatest(payload.entries) ?? Math.floor(Date.now() / 1000);
	}, [payload]);

	const cutoff = latestTimestamp - intervalSeconds;

	const filteredStandardEntries = useMemo(() => {
		if (!payload || payload.type === "network" || payload.type === "panel") {
			return [];
		}
		const entries = payload.entries.slice().sort((a, b) => a.timestamp - b.timestamp);
		const filtered = entries.filter((entry) => entry.timestamp >= cutoff);
		return filtered.length ? filtered : entries;
	}, [payload, cutoff]);

	const filteredNetworkEntries = useMemo(() => {
		if (!payload || payload.type !== "network") {
			return [];
		}
		const entries = payload.entries.slice().sort((a, b) => a.timestamp - b.timestamp);
		const filtered = entries.filter((entry) => entry.timestamp >= cutoff);
		return filtered.length ? filtered : entries;
	}, [payload, cutoff]);

	const filteredPanelCpu = useMemo(() => {
		if (!payload || payload.type !== "panel") return [];
		const entries = payload.cpuEntries.slice().sort((a, b) => a.timestamp - b.timestamp);
		const filtered = entries.filter((entry) => entry.timestamp >= cutoff);
		return filtered.length ? filtered : entries;
	}, [payload, cutoff]);

	const filteredPanelMemory = useMemo(() => {
		if (!payload || payload.type !== "panel") return [];
		const entries = payload.memoryEntries.slice().sort((a, b) => a.timestamp - b.timestamp);
		const filtered = entries.filter((entry) => entry.timestamp >= cutoff);
		return filtered.length ? filtered : entries;
	}, [payload, cutoff]);

	const chartSeries = useMemo(() => {
		if (!payload) return [];
		if (payload.type === "network") {
			return [
				{
					name: t("networkIncoming"),
					data: filteredNetworkEntries.map((entry) => [entry.timestamp * 1000, entry.incoming]),
				},
				{
					name: t("networkOutgoing"),
					data: filteredNetworkEntries.map((entry) => [entry.timestamp * 1000, entry.outgoing]),
				},
			];
		}
		if (payload.type === "panel") {
			return [
				{
					name: t("cpuUsage"),
					data: filteredPanelCpu.map((entry) => [entry.timestamp * 1000, entry.value]),
				},
				{
					name: t("memoryUsage"),
					data: filteredPanelMemory.map((entry) => [entry.timestamp * 1000, entry.value]),
				},
			];
		}
		return [
			{
				name: payload.metricLabel,
				data: filteredStandardEntries.map((entry) => [entry.timestamp * 1000, entry.value]),
			},
		];
	}, [filteredStandardEntries, filteredNetworkEntries, filteredPanelCpu, filteredPanelMemory, payload, t]);

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
			colors: ["#3b82f6", "#10b981", "#8b5cf6", "#f43f5e"],
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
			stroke: {
				curve: "smooth",
				width: 2,
			},
			grid: {
				borderColor: gridColor,
				strokeDashArray: 3,
				xaxis: { lines: { show: false } },
				yaxis: { lines: { show: true } },
				padding: { top: 10, right: 10, bottom: 0, left: 10 },
			},
			xaxis: {
				type: "datetime",
				axisBorder: { show: false },
				axisTicks: { show: false },
				labels: {
					style: {
						colors: mutedTextColor,
						fontSize: "11px",
						fontFamily: "inherit",
					},
					datetimeFormatter: { hour: "HH:mm" },
				},
				tooltip: { enabled: false },
			},
			yaxis: {
				decimalsInFloat: 0,
				labels: {
					style: {
						colors: mutedTextColor,
						fontSize: "11px",
						fontFamily: "inherit",
						fontWeight: 500,
					},
				},
			},
			legend: {
				position: "bottom",
				horizontalAlign: "center",
				offsetY: 6,
				markers: { radius: 6 },
				labels: { colors: mutedTextColor },
				itemMargin: { horizontal: 8, vertical: 0 },
			},
			tooltip: {
				theme: colorMode,
				x: { format: "HH:mm:ss" },
				style: { fontSize: "12px", fontFamily: "inherit" },
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
				overflow="hidden"
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
						<Box minH="300px">
							<Chart
								key={`chart-interval-${intervalSeconds}`}
								options={options}
								series={chartSeries}
								type="area"
								height={300}
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

const HistorySparkline: FC<{ values: number[]; accent?: string }> = ({ values, accent }) => {
	const defaultColor = useColorModeValue("gray.400", "gray.600");
	const normalized = values.length ? values.slice(-24) : [0];
	const maxValue = Math.max(...normalized, 1);

	return (
		<HStack alignItems="flex-end" spacing="2px" h="32px" w="full" overflow="hidden" pt={1}>
			{normalized.map((value, idx) => {
				const heightPct = maxValue > 0 ? (value / maxValue) * 100 : 0;
				const height = Math.max(3, Math.round((heightPct / 100) * 28));
				return (
					<Box
						key={`spark-${idx}-${value}`}
						flex="1 1 0"
						h={`${height}px`}
						bg={accent ?? defaultColor}
						borderRadius="full"
						opacity={0.85}
						transition="height 0.2s ease"
					/>
				);
			})}
		</HStack>
	);
};

const UsageMetricCard: FC<{
	label: string;
	percent: number;
	icon: ReactNode;
	detail?: string;
	history?: number[];
	footerLeft?: string;
	footerRight?: string;
	onOpen?: () => void;
	actionLabel?: string;
}> = ({ label, percent, icon, detail, history, footerLeft, footerRight, onOpen, actionLabel }) => {
	const colorScheme = getUsageColorScheme(percent);
	const safePercent = clampPercent(percent);
	const borderColor = useColorModeValue("panel.border", "panel.border");
	const bg = useColorModeValue("panel.surface", "panel.surface");
	const labelColor = useColorModeValue("panel.textSecondary", "panel.textSecondary");
	const mutedColor = useColorModeValue("panel.textMuted", "panel.textMuted");
	const accent = useColorModeValue(`${colorScheme}.400`, `${colorScheme}.300`);

	return (
		<Box
			borderWidth="1px"
			borderColor={borderColor}
			borderRadius="2xl"
			bg={bg}
			p={{ base: 3.5, md: 4 }}
			transition="all 0.2s cubic-bezier(0.23, 1, 0.32, 1)"
			_hover={{
				borderColor: "panel.borderStrong",
				transform: "translateY(-2px)",
				boxShadow: "sm",
			}}
		>
			<Stack spacing={3}>
				<Flex justify="space-between" align="center" gap={2}>
					<HStack spacing={2} minW={0}>
						<Flex
							w={7}
							h={7}
							align="center"
							justify="center"
							borderRadius="lg"
							bg="panel.elevated"
							color={accent}
							flexShrink={0}
						>
							{icon}
						</Flex>
						<Text fontSize="sm" fontWeight="600" color={labelColor} noOfLines={1}>
							{label}
						</Text>
					</HStack>
					{onOpen && actionLabel && (
						<Button
							size="xs"
							h="22px"
							px={2}
							fontSize="11px"
							variant="ghost"
							borderRadius="full"
							color="panel.textMuted"
							_hover={{ color: "panel.text", bg: "panel.elevated" }}
							onClick={onOpen}
						>
							{actionLabel}
						</Button>
					)}
				</Flex>

				<Flex align="baseline" justify="space-between" gap={2} wrap="wrap">
					<Text
						fontSize={{ base: "2xl", md: "3xl" }}
						fontWeight="800"
						lineHeight="1"
						color="panel.text"
						dir="ltr"
						sx={{ fontVariantNumeric: "tabular-nums" }}
					>
						{Math.max(0, percent).toFixed(1)}%
					</Text>
					{detail && (
						<Text
							fontSize="xs"
							color={mutedColor}
							dir="ltr"
							noOfLines={1}
							sx={{ fontVariantNumeric: "tabular-nums" }}
						>
							{detail}
						</Text>
					)}
				</Flex>

				<Progress
					value={safePercent}
					colorScheme={colorScheme}
					bg="panel.elevated"
					borderRadius="full"
					h="5px"
				/>

				{(footerLeft || footerRight) && (
					<Flex
						justify="space-between"
						fontSize="11px"
						color={mutedColor}
						dir="ltr"
						sx={{ fontVariantNumeric: "tabular-nums" }}
					>
						<Text>{footerLeft}</Text>
						<Text>{footerRight}</Text>
					</Flex>
				)}

				{history && history.length > 0 && <HistorySparkline values={history} accent={accent} />}
			</Stack>
		</Box>
	);
};

const SpeedMetricBadge: FC<{
	icon: ReactNode;
	label: string;
	speedBytes: number;
	colorScheme: "blue" | "green";
}> = ({ icon, label, speedBytes, colorScheme }) => {
	const iconColor = useColorModeValue(`${colorScheme}.500`, `${colorScheme}.300`);

	return (
		<Flex
			align="center"
			gap={3}
			p={3.5}
			borderRadius="xl"
			bg="panel.elevated"
			borderWidth="1px"
			borderColor="panel.border"
			flex="1"
			minW={{ base: "full", sm: "140px" }}
		>
			<Flex
				w={9}
				h={9}
				align="center"
				justify="center"
				borderRadius="lg"
				bg="panel.surface"
				color={iconColor}
				flexShrink={0}
			>
				{icon}
			</Flex>
			<Box minW={0} flex="1">
				<Text fontSize="xs" color="panel.textMuted" fontWeight="500" noOfLines={1}>
					{label}
				</Text>
				<Text
					fontSize={{ base: "md", md: "lg" }}
					fontWeight="700"
					color="panel.text"
					dir="ltr"
					sx={{ fontVariantNumeric: "tabular-nums", unicodeBidi: "isolate" }}
					noOfLines={1}
				>
					{formatBytes(speedBytes)}/s
				</Text>
			</Box>
		</Flex>
	);
};

const MinimalUserStatItem: FC<{
	label: string;
	count: number;
	dotColor: string;
}> = ({ label, count, dotColor }) => (
	<HStack
		p={3}
		borderRadius="xl"
		bg="panel.elevated"
		borderWidth="1px"
		borderColor="panel.border"
		justify="space-between"
		align="center"
		spacing={2}
	>
		<HStack spacing={2} minW={0}>
			<Box w="8px" h="8px" borderRadius="full" bg={dotColor} flexShrink={0} />
			<Text fontSize="xs" fontWeight="500" color="panel.textSecondary" noOfLines={1}>
				{label}
			</Text>
		</HStack>
		<Text
			fontSize="sm"
			fontWeight="700"
			color="panel.text"
			dir="ltr"
			sx={{ fontVariantNumeric: "tabular-nums" }}
		>
			{formatNumberValue(count)}
		</Text>
	</HStack>
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

	const cpuHistoryValues = systemData.cpu_history.map((e) => e.value);
	const memoryHistoryValues = systemData.memory_history.map((e) => e.value);
	const swapHistoryValues = systemData.swap_history.map((e) => e.value);
	const diskHistoryValues = systemData.disk_history.map((e) => e.value);
	const panelCpuHistory = systemData.panel_cpu_history.map((e) => e.value);
	const panelMemoryHistory = systemData.panel_memory_history.map((e) => e.value);

	const cpuThreads = systemData.cpu_threads || systemData.cpu_cores;
	const cpuSubtitle = [
		`${formatNumberValue(systemData.cpu_cores)} ${t("cores")} / ${formatNumberValue(cpuThreads)} ${t("threads")}`,
		formatCPUFrequency(systemData.cpu_frequency_hz),
	]
		.filter(Boolean)
		.join(" · ");

	return (
		<Stack spacing={5} w="full" dir={isRTL ? "rtl" : "ltr"} {...props}>
			{/* Top Header Card: Title, Status Badges & Maintenance */}
			<ChartBox
				title={
					<HStack spacing={3} align="center" flexWrap="wrap">
						<Text fontWeight="800" fontSize={{ base: "lg", md: "xl" }} color="panel.text">
							{t("systemOverview")}
						</Text>
						<HStack spacing={2}>
							<Badge
								colorScheme={systemData.xray_running ? "green" : "red"}
								borderRadius="full"
								px={2.5}
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
								{systemData.xray_running ? "Xray Core Active" : t("status.stopped")}
							</Badge>
							{systemData.xray_version && (
								<Badge variant="subtle" borderRadius="full" px={2} py={0.5} fontSize="11px">
									v{systemData.xray_version}
								</Badge>
							)}
						</HStack>
					</HStack>
				}
				headerActions={
					<DashboardMaintenanceControls
						channel={systemData.channel}
						version={systemData.version}
					/>
				}
			>
				<Stack spacing={5}>
					{/* Hardware Metrics Grid */}
					<SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} gap={4}>
						<UsageMetricCard
							label={t("cpuUsage")}
							percent={systemData.cpu_usage}
							icon={<CpuChipIcon width={16} />}
							detail={cpuSubtitle}
							history={cpuHistoryValues}
							footerLeft={`${t("average")}: ${average(cpuHistoryValues).toFixed(1)}%`}
							footerRight={`${t("peak")}: ${peak(cpuHistoryValues).toFixed(1)}%`}
							actionLabel={t("viewHistory")}
							onOpen={() =>
								openHistory({
									type: "cpu",
									title: t("cpuUsage"),
									metricLabel: t("cpuUsage"),
									entries: systemData.cpu_history,
								})
							}
						/>
						<UsageMetricCard
							label={t("memoryUsage")}
							percent={systemData.memory.percent}
							icon={<ServerStackIcon width={16} />}
							detail={`${formatBytes(systemData.memory.current)} / ${formatBytes(systemData.memory.total)}`}
							history={memoryHistoryValues}
							footerLeft={`${t("average")}: ${average(memoryHistoryValues).toFixed(1)}%`}
							footerRight={`${t("peak")}: ${peak(memoryHistoryValues).toFixed(1)}%`}
							actionLabel={t("viewHistory")}
							onOpen={() =>
								openHistory({
									type: "memory",
									title: t("memoryUsage"),
									metricLabel: t("memoryUsage"),
									entries: systemData.memory_history,
								})
							}
						/>
						<UsageMetricCard
							label={t("swapUsage")}
							percent={systemData.swap.percent}
							icon={<CircleStackIcon width={16} />}
							detail={`${formatBytes(systemData.swap.current)} / ${formatBytes(systemData.swap.total)}`}
							history={swapHistoryValues}
							footerLeft={`${t("free")}: ${formatBytes(Math.max(0, systemData.swap.total - systemData.swap.current))}`}
							footerRight={`${t("peak")}: ${peak(swapHistoryValues).toFixed(1)}%`}
						/>
						<UsageMetricCard
							label={t("diskUsage")}
							percent={systemData.disk.percent}
							icon={<CircleStackIcon width={16} />}
							detail={`${formatBytes(systemData.disk.current)} / ${formatBytes(systemData.disk.total)}`}
							history={diskHistoryValues}
							footerLeft={`${t("free")}: ${formatBytes(Math.max(0, systemData.disk.total - systemData.disk.current))}`}
							footerRight={`${t("peak")}: ${peak(diskHistoryValues).toFixed(1)}%`}
						/>
					</SimpleGrid>

					{/* Network Speeds & Bandwidth */}
					<Box
						p={4}
						borderRadius="2xl"
						bg="panel.surface"
						borderWidth="1px"
						borderColor="panel.border"
					>
						<Flex
							justify="space-between"
							align="center"
							mb={3}
							flexWrap="wrap"
							gap={2}
						>
							<HStack spacing={2}>
								<SignalIcon width={18} color="var(--rb-panel-accent)" />
								<Text fontSize="sm" fontWeight="700" color="panel.text">
									{t("bandwidthSpeed")}
								</Text>
							</HStack>
							<Button
								size="xs"
								variant="ghost"
								borderRadius="full"
								color="panel.textMuted"
								_hover={{ color: "panel.text", bg: "panel.elevated" }}
								onClick={() =>
									openHistory({
										type: "network",
										title: t("networkHistory"),
										entries: systemData.network_history,
									})
								}
							>
								{t("viewHistory")}
							</Button>
						</Flex>
						<SimpleGrid columns={{ base: 1, sm: 2 }} gap={3}>
							<SpeedMetricBadge
								icon={<ArrowDownTrayIcon width={18} />}
								label={t("incomingSpeed")}
								speedBytes={systemData.incoming_bandwidth_speed}
								colorScheme="green"
							/>
							<SpeedMetricBadge
								icon={<ArrowUpTrayIcon width={18} />}
								label={t("outgoingSpeed")}
								speedBytes={systemData.outgoing_bandwidth_speed}
								colorScheme="blue"
							/>
						</SimpleGrid>
					</Box>

					{/* Errors notice if any */}
					{systemData.last_xray_error && (
						<Box
							p={3.5}
							borderRadius="xl"
							bg="red.950"
							borderWidth="1px"
							borderColor="red.800"
							color="red.200"
						>
							<Text fontSize="xs" fontWeight="bold" mb={1}>
								{t("coreError")}:
							</Text>
							<Text fontSize="xs" fontFamily="mono" wordBreak="break-word">
								{systemData.last_xray_error}
							</Text>
						</Box>
					)}
				</Stack>
			</ChartBox>

			{/* Second Row: Users Overview & Quick Statuses */}
			<SimpleGrid columns={{ base: 1, lg: canSeeGlobal ? 2 : 1 }} gap={5}>
				<ChartBox
					title={
						<HStack spacing={2}>
							<UserGroupIcon width={18} color="var(--rb-panel-accent)" />
							<Text fontWeight="700">{t("usersOverview")}</Text>
						</HStack>
					}
					headerActions={
						<Badge colorScheme="blue" borderRadius="full" px={2.5} py={0.5} fontSize="11px">
							{t("total")}: {formatNumberValue(systemData.total_user)}
						</Badge>
					}
				>
					<SimpleGrid columns={{ base: 2, sm: 3 }} gap={2.5}>
						<MinimalUserStatItem
							label={t("status.active")}
							count={systemData.users_active}
							dotColor="#22c55e"
						/>
						<MinimalUserStatItem
							label={t("onlineUsers")}
							count={systemData.online_users}
							dotColor="#06b6d4"
						/>
						<MinimalUserStatItem
							label={t("status.on_hold")}
							count={systemData.users_on_hold}
							dotColor="#a855f7"
						/>
						<MinimalUserStatItem
							label={t("status.limited")}
							count={systemData.users_limited}
							dotColor="#eab308"
						/>
						<MinimalUserStatItem
							label={t("status.expired")}
							count={systemData.users_expired}
							dotColor="#f97316"
						/>
						<MinimalUserStatItem
							label={t("status.disabled")}
							count={systemData.users_disabled}
							dotColor="#64748b"
						/>
					</SimpleGrid>
				</ChartBox>

				{/* Admin Overview or Panel Health */}
				{canSeeGlobal && systemData.admin_overview && (
					<ChartBox
						title={
							<HStack spacing={2}>
								<ShieldCheckIcon width={18} color="var(--rb-panel-accent)" />
								<Text fontWeight="700">{t("adminOverview")}</Text>
							</HStack>
						}
						headerActions={
							<Badge colorScheme="purple" borderRadius="full" px={2.5} py={0.5} fontSize="11px">
								{t("totalAdmins")}: {formatNumberValue(systemData.admin_overview.total_admins)}
							</Badge>
						}
					>
						<SimpleGrid columns={{ base: 2, sm: 3 }} gap={2.5}>
							<MinimalUserStatItem
								label={t("fullAccessAdmins")}
								count={systemData.admin_overview.full_access_admins}
								dotColor="#eab308"
							/>
							<MinimalUserStatItem
								label={t("sudoAdmins")}
								count={systemData.admin_overview.sudo_admins}
								dotColor="#a855f7"
							/>
							<MinimalUserStatItem
								label={t("standardAdmins")}
								count={systemData.admin_overview.standard_admins}
								dotColor="#3b82f6"
							/>
						</SimpleGrid>
						{systemData.admin_overview.top_admin_username && (
							<HStack
								mt={3}
								p={2.5}
								borderRadius="xl"
								bg="panel.elevated"
								borderWidth="1px"
								borderColor="panel.border"
								justify="space-between"
								fontSize="xs"
							>
								<Text color="panel.textMuted">
									{t("topAdmin")}:{" "}
									<chakra.span fontWeight="700" color="panel.text">
										{systemData.admin_overview.top_admin_username}
									</chakra.span>
								</Text>
								<Text color="panel.textMuted" dir="ltr">
									{formatBytes(systemData.admin_overview.top_admin_usage)}
								</Text>
							</HStack>
						)}
					</ChartBox>
				)}
			</SimpleGrid>

			{/* Bottom Row: Panel Internal Engine & Uptime */}
			<ChartBox
				title={
					<HStack spacing={2}>
						<ClockIcon width={18} color="var(--rb-panel-accent)" />
						<Text fontWeight="700">{t("panelUsage")}</Text>
					</HStack>
				}
				headerActions={
					<Text fontSize="xs" color="panel.textMuted" dir="ltr">
						{t("panelUptime")}: {formatDuration(systemData.panel_uptime_seconds)}
					</Text>
				}
			>
				<SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
					<UsageMetricCard
						label={`${t("cpuUsage")} (Panel Process)`}
						percent={systemData.panel_cpu_percent}
						icon={<CpuChipIcon width={16} />}
						detail={`${formatNumberValue(systemData.app_threads)} ${t("threads")}`}
						history={panelCpuHistory}
						footerLeft={`${t("average")}: ${average(panelCpuHistory).toFixed(1)}%`}
						footerRight={`${t("peak")}: ${peak(panelCpuHistory).toFixed(1)}%`}
						actionLabel={t("viewHistory")}
						onOpen={() =>
							openHistory({
								type: "panel",
								title: t("panelUsage"),
								cpuEntries: systemData.panel_cpu_history,
								memoryEntries: systemData.panel_memory_history,
							})
						}
					/>
					<UsageMetricCard
						label={`${t("memoryUsage")} (Panel Heap)`}
						percent={systemData.panel_memory_percent}
						icon={<ServerStackIcon width={16} />}
						detail={`${formatBytes(systemData.app_memory)} / ${formatBytes(systemData.memory.total)}`}
						history={panelMemoryHistory}
						footerLeft={`${t("average")}: ${average(panelMemoryHistory).toFixed(1)}%`}
						footerRight={`${t("peak")}: ${peak(panelMemoryHistory).toFixed(1)}%`}
						actionLabel={t("viewHistory")}
						onOpen={() =>
							openHistory({
								type: "panel",
								title: t("panelUsage"),
								cpuEntries: systemData.panel_cpu_history,
								memoryEntries: systemData.panel_memory_history,
							})
						}
					/>
				</SimpleGrid>
			</ChartBox>

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