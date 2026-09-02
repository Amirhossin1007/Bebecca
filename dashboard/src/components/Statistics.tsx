import {
	Badge,
	Box,
	type BoxProps,
	Button,
	Flex,
	HStack,
	Modal,
	ModalBody,
	ModalCloseButton,
	ModalContent,
	ModalHeader,
	ModalOverlay,
	Progress,
	SimpleGrid,
	Spinner,
	Stack,
	Text,
	VStack,
	useColorMode,
	useColorModeValue,
} from "@chakra-ui/react";
import {
	ArrowDownTrayIcon,
	ArrowUpTrayIcon,
	CircleStackIcon,
	ClockIcon,
	CpuChipIcon,
	ServerStackIcon,
	SignalIcon,
	UserGroupIcon,
} from "@heroicons/react/24/outline";
import type { ApexOptions } from "apexcharts";
import { useDashboard } from "contexts/DashboardContext";
import { AnimatePresence, motion } from "framer-motion";
import useGetUser from "hooks/useGetUser";
import type { TFunction } from "i18next";
import {
	type FC,
	lazy,
	type ReactNode,
	Suspense,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "react-query";
import { fetch } from "service/http";
import { AdminRole } from "types/Admin";
import type { SystemStats } from "types/System";
import { formatBytes, numberWithCommas } from "utils/formatByte";
import {
	formatDurationParts,
	formatLocalizedDuration,
} from "utils/formatDuration";
import { mergeLiveSystemStats } from "utils/systemMetrics";
import { getAPIWebSocketURL } from "utils/websocket";
import { DashboardMaintenanceControls } from "./DashboardMaintenanceControls";

export const StatisticsQueryKey = "statistics-query-key";

const HistoryChart = lazy(() => import("react-apexcharts"));

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
					queryClient.setQueryData<SystemStats>(StatisticsQueryKey, (current) =>
						mergeLiveSystemStats(current, stats),
					);
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
): SystemStats | undefined => {
	if (!value || typeof value !== "object") {
		return undefined;
	}

	return {
		version: typeof value.version === "string" ? value.version : "",
		mem_total: toFiniteNumber(value.mem_total),
		mem_used: toFiniteNumber(value.mem_used),
		cpu_cores: toFiniteNumber(value.cpu_cores),
		cpu_usage: toFiniteNumber(value.cpu_usage),
		app_threads: toFiniteNumber(value.app_threads),
		app_memory: toFiniteNumber(value.app_memory),
		cpu_history: safeHistory(value.cpu_history),
		panel_cpu_history: safeHistory(value.panel_cpu_history),
		panel_memory_history: safeHistory(value.panel_memory_history),
		network_history: safeNetworkHistory(value.network_history),
		total_user: toFiniteNumber(value.total_user),
		users_active: toFiniteNumber(value.users_active),
		incoming_bandwidth: toFiniteNumber(value.incoming_bandwidth),
		outgoing_bandwidth: toFiniteNumber(value.outgoing_bandwidth),
		incoming_bandwidth_speed: toFiniteNumber(value.incoming_bandwidth_speed),
		outgoing_bandwidth_speed: toFiniteNumber(value.outgoing_bandwidth_speed),
		online_users_count: toFiniteNumber(value.online_users_count),
		uptime_seconds: toFiniteNumber(value.uptime_seconds),
		panel_uptime_seconds: toFiniteNumber(value.panel_uptime_seconds),
		panel_cpu_percent: toFiniteNumber(value.panel_cpu_percent),
		panel_memory_percent: toFiniteNumber(value.panel_memory_percent),
		traffic_used_total: toFiniteNumber(value.traffic_used_total),
		traffic_used_today: toFiniteNumber(value.traffic_used_today),
		traffic_used_month: toFiniteNumber(value.traffic_used_month),
		memory: safeUsageStats(value.memory),
		swap: safeUsageStats(value.swap),
		disk: safeUsageStats(value.disk),
		online_users_usage: toFiniteNumber(value.online_users_usage),
		personal_usage: value.personal_usage
			? {
					total_user: toFiniteNumber(value.personal_usage.total_user),
					users_active: toFiniteNumber(value.personal_usage.users_active),
					online_users_count: toFiniteNumber(
						value.personal_usage.online_users_count,
					),
					traffic_used_total: toFiniteNumber(
						value.personal_usage.traffic_used_total,
					),
					traffic_used_today: toFiniteNumber(
						value.personal_usage.traffic_used_today,
					),
					traffic_used_month: toFiniteNumber(
						value.personal_usage.traffic_used_month,
					),
					traffic_created_total: toFiniteNumber(
						value.personal_usage.traffic_created_total,
					),
					traffic_reset_total: toFiniteNumber(
						value.personal_usage.traffic_reset_total,
					),
					traffic_basis:
						value.personal_usage.traffic_basis === "created_traffic"
							? "created_traffic"
							: "user_usage",
				}
			: undefined,
	};
};

const clampPercent = (val: number): number => {
	if (!Number.isFinite(val)) return 0;
	return Math.min(100, Math.max(0, val));
};

const formatNumberValue = (value: number | string | undefined | null) => {
	if (value === undefined || value === null) return "0";
	const numeric = typeof value === "number" ? value : Number(value);
	if (Number.isNaN(numeric)) return String(value);
	return numberWithCommas(numeric);
};

const HISTORY_INTERVALS = [
	{ seconds: 120, labelKey: "intervals.2m" },
	{ seconds: 600, labelKey: "intervals.10m" },
	{ seconds: 1800, labelKey: "intervals.30m" },
	{ seconds: 3600, labelKey: "intervals.1h" },
	{ seconds: 10800, labelKey: "intervals.3h" },
	{ seconds: 18000, labelKey: "intervals.5h" },
];

type HistoryModalPayload = {
	type: "cpu" | "memory" | "network" | "panel";
	title: string;
	metricLabel?: string;
	entries?: SystemStats["cpu_history"];
	cpuEntries?: SystemStats["cpu_history"];
	memoryEntries?: SystemStats["cpu_history"];
	networkEntries?: SystemStats["network_history"];
};

const HistoryModal: FC<{
	isOpen: boolean;
	onClose: () => void;
	payload: HistoryModalPayload | null;
	intervalSeconds: number;
	onIntervalChange: (interval: number) => void;
}> = ({ isOpen, onClose, payload, intervalSeconds, onIntervalChange }) => {
	const { t } = useTranslation();
	const { colorMode } = useColorMode();
	const gridColor = useColorModeValue("rgba(0,0,0,0.06)", "rgba(255,255,255,0.06)");
	const mutedTextColor = useColorModeValue("#64748b", "#94a3b8");

	const { latestTimestamp, availableSpan } = useMemo(() => {
		if (!payload) return { latestTimestamp: Math.floor(Date.now() / 1000), availableSpan: 120 };
		let timestamps: number[] = [];
		if (payload.type === "network" && payload.networkEntries?.length) {
			timestamps = payload.networkEntries.map((e) => e.timestamp);
		} else if (payload.type === "panel") {
			const cTs = (payload.cpuEntries || []).map((e) => e.timestamp);
			const mTs = (payload.memoryEntries || []).map((e) => e.timestamp);
			timestamps = [...cTs, ...mTs];
		} else if (payload.entries?.length) {
			timestamps = payload.entries.map((e) => e.timestamp);
		}

		if (!timestamps.length) return { latestTimestamp: Math.floor(Date.now() / 1000), availableSpan: 120 };
		const maxT = Math.max(...timestamps);
		const minT = Math.min(...timestamps);
		return { latestTimestamp: maxT, availableSpan: Math.max(120, maxT - minT) };
	}, [payload]);

	const cutoff = latestTimestamp - intervalSeconds;

	const chartSeries = useMemo(() => {
		if (!payload) return [];
		if (payload.type === "network" && payload.networkEntries) {
			const filtered = payload.networkEntries.filter((e) => e.timestamp >= cutoff);
			const finalData = filtered.length ? filtered : payload.networkEntries;
			return [
				{
					name: t("networkIncoming"),
					data: finalData.map((e) => [e.timestamp * 1000, e.incoming]),
				},
				{
					name: t("networkOutgoing"),
					data: finalData.map((e) => [e.timestamp * 1000, e.outgoing]),
				},
			];
		}
		if (payload.type === "panel") {
			const filteredCpu = (payload.cpuEntries || []).filter((e) => e.timestamp >= cutoff);
			const filteredMem = (payload.memoryEntries || []).filter((e) => e.timestamp >= cutoff);
			const finalCpu = filteredCpu.length ? filteredCpu : payload.cpuEntries || [];
			const finalMem = filteredMem.length ? filteredMem : payload.memoryEntries || [];
			return [
				{
					name: `${t("cpuUsage")} (Panel CPU %)`,
					data: finalCpu.map((e) => [e.timestamp * 1000, e.value]),
				},
				{
					name: `${t("memoryUsage")} (Panel RAM %)`,
					data: finalMem.map((e) => [e.timestamp * 1000, e.value]),
				},
			];
		}
		if (payload.entries) {
			const filtered = payload.entries.filter((e) => e.timestamp >= cutoff);
			const finalEntries = filtered.length ? filtered : payload.entries;
			return [
				{
					name: payload.metricLabel ?? payload.title,
					data: finalEntries.map((e) => [e.timestamp * 1000, e.value]),
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
			colors: ["var(--rb-panel-accent)", "#3b82f6", "#10b981", "#a855f7"],
			fill: {
				type: "gradient",
				gradient: {
					shadeIntensity: 1,
					opacityFrom: 0.28,
					opacityTo: 0.02,
					stops: [0, 100],
				},
			},
			dataLabels: { enabled: false },
			markers: {
				size: 4,
				strokeWidth: 2,
				hover: { size: 6 },
			},
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
				min: (latestTimestamp - intervalSeconds) * 1000,
				max: latestTimestamp * 1000,
				axisBorder: { show: false },
				axisTicks: { show: false },
				labels: {
					style: { colors: mutedTextColor, fontSize: "11px", fontFamily: "inherit" },
					datetimeFormatter: {
						year: "yyyy",
						month: "MMM 'yy",
						day: "dd MMM",
						hour: "HH:mm",
						minute: "HH:mm:ss",
					},
				},
			},
			yaxis: {
				labels: {
					style: { colors: mutedTextColor, fontSize: "11px", fontFamily: "inherit" },
					formatter: (val: number) => {
						if (!Number.isFinite(val)) return "0";
						if (payload?.type === "network") {
							return `${formatBytes(val)}/s`;
						}
						if (payload?.type === "cpu" || payload?.type === "memory" || payload?.type === "panel") {
							return `${val.toFixed(0)}%`;
						}
						return formatBytes(val);
					},
				},
			},
			legend: {
				position: "bottom",
				labels: { colors: mutedTextColor },
			},
			tooltip: {
				theme: colorMode,
				x: { format: "HH:mm:ss" },
				y: {
					formatter: (val: number) => {
						if (!Number.isFinite(val)) return "0";
						if (payload?.type === "network") {
							return `${formatBytes(val)}/s`;
						}
						if (payload?.type === "cpu" || payload?.type === "memory" || payload?.type === "panel") {
							return `${val.toFixed(1)}%`;
						}
						return formatBytes(val);
					},
				},
			},
		}),
		[colorMode, gridColor, mutedTextColor, latestTimestamp, intervalSeconds, payload?.type],
	);

	return (
		<Modal isOpen={isOpen} onClose={onClose} size="2xl" scrollBehavior="inside" isCentered>
			<ModalOverlay bg="blackAlpha.700" backdropFilter="blur(16px)" />
			<ModalContent
				bg="panel.surface"
				borderWidth="1px"
				borderColor="panel.border"
				borderRadius="24px"
				boxShadow="inset 0 1px 1px 0 rgba(255, 255, 255, 0.1), 0 32px 80px rgba(0,0,0,0.6)"
				mx={{ base: 3, sm: 6 }}
			>
				<ModalHeader
					display="flex"
					alignItems="center"
					justifyContent="space-between"
					px={{ base: 4, md: 6 }}
					py={{ base: 3.5, md: 4 }}
					borderBottomWidth="1px"
					borderColor="panel.border"
					fontSize="sm"
					fontWeight="700"
				>
					<Text color="panel.text">{t("historyModalTitle", { metric: payload?.title ?? "" })}</Text>
					<ModalCloseButton position="static" size="sm" />
				</ModalHeader>
				<ModalBody px={{ base: 4, md: 6 }} py={{ base: 4, md: 5 }}>
					<Stack spacing={4}>
						<Flex wrap="wrap" gap={2}>
							{HISTORY_INTERVALS.map((interval, idx) => {
								const isAvailable = idx === 0 || interval.seconds <= availableSpan * 2;
								return (
									<Button
										key={interval.seconds}
										size="xs"
										h="26px"
										px={3}
										borderRadius="full"
										variant={intervalSeconds === interval.seconds ? "solid" : "ghost"}
										colorScheme={intervalSeconds === interval.seconds ? "primary" : "gray"}
										color={intervalSeconds === interval.seconds ? undefined : "panel.textMuted"}
										fontSize="11px"
										opacity={isAvailable ? 1 : 0.4}
										cursor={isAvailable ? "pointer" : "not-allowed"}
										onClick={() => {
											if (isAvailable) onIntervalChange(interval.seconds);
										}}
									>
										{t(interval.labelKey)}
									</Button>
								);
							})}
						</Flex>
						<Box minH="260px">
							<Suspense
								fallback={
									<Flex h="260px" align="center" justify="center">
										<Spinner size="md" color="panel.accent" />
									</Flex>
								}
							>
								<HistoryChart
									options={options}
									series={chartSeries}
									type="area"
									height={260}
								/>
							</Suspense>
						</Box>
					</Stack>
				</ModalBody>
			</ModalContent>
		</Modal>
	);
};

const ResourceCard: FC<{
	label: string;
	icon: ReactNode;
	value: string;
	totalValue?: string;
	percent: number;
	metaUnit?: string;
	metaValue?: string | number;
	onHistory?: () => void;
	historyLabel?: string;
	isRTL?: boolean;
}> = ({
	label,
	icon,
	value,
	totalValue,
	percent,
	metaUnit,
	metaValue,
	onHistory,
	historyLabel,
	isRTL = false,
}) => {
	const safe = clampPercent(percent);
	const accent = "var(--rb-panel-accent)";
	const trackBg = useColorModeValue("panel.border", "panel.elevated");
	const criticalColor = safe >= 90 ? "#ef4444" : safe >= 75 ? "#f59e0b" : accent;

	return (
		<Box
			bg="panel.surface"
			borderWidth="1px"
			borderColor="panel.border"
			borderRadius="20px"
			p={{ base: 4, sm: 5 }}
			position="relative"
			overflow="hidden"
			display="flex"
			flexDirection="column"
			justifyContent="space-between"
			boxShadow="inset 0 1px 1px 0 rgba(255, 255, 255, 0.05), 0 8px 24px -6px rgba(0, 0, 0, 0.12)"
			transition="border-color 0.25s ease, background-color 0.25s ease, box-shadow 0.25s ease"
			_hover={{
				md: {
					borderColor: "panel.borderStrong",
					bg: "panel.elevated",
					boxShadow: "inset 0 1px 1px 0 rgba(255, 255, 255, 0.08), 0 12px 32px -4px rgba(0, 0, 0, 0.22)",
				},
			}}
		>
			<Box>
				<Flex justify="space-between" align="center" mb={3}>
					<HStack spacing={2.5} align="center">
						<Flex
							w="32px"
							h="32px"
							align="center"
							justify="center"
							borderRadius="9px"
							bg="panel.elevated"
							color="panel.textSecondary"
							flexShrink={0}
						>
							{icon}
						</Flex>
						<Text fontSize="13px" fontWeight="600" color="panel.textSecondary" noOfLines={1}>
							{label}
						</Text>
					</HStack>
					{onHistory && (
						<Button
							size="xs"
							h="22px"
							px={2}
							fontSize="11px"
							variant="ghost"
							borderRadius="full"
							color="panel.textMuted"
							fontWeight="500"
							_hover={{ color: "panel.text", bg: "panel.surface" }}
							onClick={onHistory}
						>
							{historyLabel}
						</Button>
					)}
				</Flex>

				<Flex align="baseline" gap={1.5} mb={1} wrap="nowrap" justify="flex-start">
					{totalValue ? (
						<Flex
							dir="ltr"
							align="baseline"
							gap={1.5}
							sx={{ unicodeBidi: "isolate" }}
						>
							<Text
								fontSize={{ base: "20px", sm: "22px" }}
								fontWeight="800"
								color="panel.text"
								letterSpacing="-0.02em"
								lineHeight="1.1"
								sx={{ fontVariantNumeric: "tabular-nums" }}
							>
								{value}
							</Text>
							<Text
								fontSize="13px"
								fontWeight="600"
								color="panel.textMuted"
								sx={{ fontVariantNumeric: "tabular-nums" }}
							>
								/ {totalValue}
							</Text>
						</Flex>
					) : (
						<Flex align="baseline" gap={1.5} wrap="wrap">
							<Text
								fontSize={{ base: "20px", sm: "22px" }}
								fontWeight="800"
								color="panel.text"
								letterSpacing="-0.02em"
								lineHeight="1.1"
								dir="ltr"
								sx={{ fontVariantNumeric: "tabular-nums", unicodeBidi: "isolate" }}
							>
								{value}
							</Text>
							{metaValue !== undefined && metaUnit && (
								<Flex
									align="center"
									dir={isRTL ? "rtl" : "ltr"}
									gap={1}
									color="panel.textMuted"
									fontSize="13px"
									fontWeight="600"
									sx={{ unicodeBidi: "isolate" }}
								>
									<Text as="span">{metaValue}</Text>
									<Text as="span">{metaUnit}</Text>
								</Flex>
							)}
						</Flex>
					)}
				</Flex>
			</Box>

			<Box mt={3}>
				<Flex justify="space-between" align="center" mb={1.5}>
					<Text fontSize="11px" fontWeight="600" color="panel.textMuted">
						{safe.toFixed(1)}%
					</Text>
					{safe >= 90 && (
						<Badge
							colorScheme="red"
							variant="subtle"
							fontSize="10px"
							px={1.5}
							py={0}
							borderRadius="4px"
						>
							High
						</Badge>
					)}
				</Flex>
				<Progress
					value={safe}
					size="xs"
					borderRadius="full"
					bg={trackBg}
					sx={{
						"& > div": {
							bg: criticalColor,
							transition: "width 0.4s ease, background-color 0.3s ease",
						},
					}}
				/>
			</Box>
		</Box>
	);
};

const SpeedItem: FC<{
	icon: ReactNode;
	label: string;
	value: string;
}> = ({ icon, label, value }) => (
	<Flex align="center" justify="space-between" gap={3}>
		<HStack spacing={2.5} color="panel.textMuted">
			<Flex
				w="28px"
				h="28px"
				align="center"
				justify="center"
				borderRadius="8px"
				bg="panel.elevated"
				color="panel.textSecondary"
				flexShrink={0}
			>
				{icon}
			</Flex>
			<Text fontSize="13px" fontWeight="500" color="panel.textSecondary">
				{label}
			</Text>
		</HStack>
		<Text
			fontSize="13px"
			fontWeight="700"
			color="panel.text"
			dir="ltr"
			sx={{ fontVariantNumeric: "tabular-nums", unicodeBidi: "isolate" }}
		>
			{value}
		</Text>
	</Flex>
);

const UserStatRow: FC<{
	label: string;
	count?: number | string;
	percent?: number;
	badgeLabel?: string;
	badgeColor?: string;
	secondaryText?: string;
}> = ({ label, count, percent, badgeLabel, badgeColor, secondaryText }) => (
	<Flex align="center" justify="space-between" py={1.5}>
		<Text fontSize="13px" fontWeight="500" color="panel.textSecondary">
			{label}
		</Text>
		<HStack spacing={2}>
			{count !== undefined && (
				<Text
					fontSize="13px"
					fontWeight="700"
					color="panel.text"
					dir="ltr"
					sx={{ fontVariantNumeric: "tabular-nums", unicodeBidi: "isolate" }}
				>
					{formatNumberValue(count)}
				</Text>
			)}
			{percent !== undefined && (
				<Text
					fontSize="12px"
					fontWeight="600"
					color="panel.textMuted"
					dir="ltr"
					sx={{ fontVariantNumeric: "tabular-nums", unicodeBidi: "isolate" }}
				>
					({percent.toFixed(1)}%)
				</Text>
			)}
			{badgeLabel && (
				<Badge
					colorScheme={badgeColor ?? "gray"}
					variant="subtle"
					fontSize="11px"
					px={1.5}
					py={0.2}
					borderRadius="6px"
				>
					{badgeLabel}
				</Badge>
			)}
			{secondaryText && (
				<Text
					fontSize="13px"
					fontWeight="700"
					color="panel.text"
					dir="ltr"
					sx={{ fontVariantNumeric: "tabular-nums", unicodeBidi: "isolate" }}
				>
					{secondaryText}
				</Text>
			)}
		</HStack>
	</Flex>
);

const SectionCard: FC<{
	children: ReactNode;
	title?: ReactNode;
	action?: ReactNode;
	noHover?: boolean;
}> = ({
	children,
	title,
	action,
	noHover = false,
}) => (
	<Box
		bg="panel.surface"
		borderWidth="1px"
		borderColor="panel.border"
		borderRadius="20px"
		overflow="hidden"
		boxShadow="inset 0 1px 1px 0 rgba(255, 255, 255, 0.05), 0 8px 24px -6px rgba(0, 0, 0, 0.12)"
		transition="border-color 0.25s ease, background-color 0.25s ease, box-shadow 0.25s ease"
		_hover={
			noHover
				? undefined
				: {
						md: {
							borderColor: "panel.borderStrong",
							bg: "panel.elevated",
							boxShadow: "inset 0 1px 1px 0 rgba(255, 255, 255, 0.08), 0 12px 32px -4px rgba(0, 0, 0, 0.22)",
						},
					}
		}
	>
		{(title || action) && (
			<Flex
				px={{ base: 4, sm: 5, md: 6 }}
				py={3.5}
				align="center"
				justify="space-between"
				borderBottomWidth="1px"
				borderColor="panel.border"
			>
				{title && (
					<Text fontSize="13px" fontWeight="700" color="panel.text" letterSpacing="-0.01em">
						{title}
					</Text>
				)}
				{action}
			</Flex>
		)}
		<Box px={{ base: 4, sm: 5, md: 6 }} py={4}>
			{children}
		</Box>
	</Box>
);

const AnimatedHeightWrapper: FC<{
	children: ReactNode;
	activeKey: string;
}> = ({ children, activeKey }) => {
	const containerRef = useRef<HTMLDivElement>(null);
	const [height, setHeight] = useState<number | "auto">("auto");

	useEffect(() => {
		if (containerRef.current) {
			const resizeObserver = new ResizeObserver((entries) => {
				for (const entry of entries) {
					const newHeight = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
					if (newHeight > 0) {
						setHeight(newHeight);
					}
				}
			});

			resizeObserver.observe(containerRef.current);
			return () => resizeObserver.disconnect();
		}
	}, []);

	return (
		<motion.div
			animate={{ height }}
			transition={{
				duration: 0.7,
				ease: [0.22, 1, 0.36, 1],
			}}
			style={{ overflow: "hidden" }}
		>
			<div ref={containerRef}>
				<AnimatePresence mode="popLayout" initial={false}>
					<motion.div
						key={activeKey}
						initial={{ opacity: 0, y: 6 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -6 }}
						transition={{
							opacity: { duration: 0.2 },
							y: { duration: 0.25, ease: "easeInOut" },
						}}
					>
						{children}
					</motion.div>
				</AnimatePresence>
			</div>
		</motion.div>
	);
};

export const Statistics: FC<BoxProps> = (props) => {
	const { t, i18n } = useTranslation();
	const isRTL = i18n.dir() === "rtl";
	const user = useGetUser();
	const isAdmin = user?.role === AdminRole.admin;
	const isSudo = user?.role === AdminRole.sudo;
	const canSeeGlobal = isSudo || !isAdmin;

	const [activeUserTab, setActiveUserTab] = useState<"all" | "mine">("all");
	const [historyModalPayload, setHistoryModalPayload] = useState<HistoryModalPayload | null>(null);
	const [historyInterval, setHistoryInterval] = useState<number>(120);

	const redErrorBg = useColorModeValue("red.50", "rgba(239, 68, 68, 0.1)");
	const redErrorBorder = useColorModeValue("red.200", "rgba(239, 68, 68, 0.25)");
	const orangeErrorBg = useColorModeValue("orange.50", "rgba(245, 158, 11, 0.1)");
	const orangeErrorBorder = useColorModeValue("orange.200", "rgba(245, 158, 11, 0.25)");

	const {
		data: systemDataRaw,
		error: systemError,
		isLoading: isSystemLoading,
	} = useQuery<SystemStats, Error>(
		StatisticsQueryKey,
		async () => {
			const res = await fetch<SystemStats>({ url: "/system" });
			return res.data;
		},
		{
			refetchInterval: 10000,
			refetchOnWindowFocus: true,
		},
	);

	const { data: myUsersData } = useQuery<{
		total: number;
		active: number;
		disabled: number;
		expired: number;
		on_hold: number;
		limited: number;
		online: number;
	}>(
		["my-admin-users-stats", user?.username],
		async () => {
			if (!user?.username) return { total: 0, active: 0, disabled: 0, expired: 0, on_hold: 0, limited: 0, online: 0 };
			const res = await fetch<{ users?: Array<{ status?: string; is_online?: boolean }> }>({
				url: `/users?admin=${encodeURIComponent(user.username)}`,
			});
			const list = res.data?.users ?? [];
			const activeCount = list.filter((u) => u.status === "active").length;
			const disabledCount = list.filter((u) => u.status === "disabled").length;
			const expiredCount = list.filter((u) => u.status === "expired").length;
			const onHoldCount = list.filter((u) => u.status === "on_hold").length;
			const limitedCount = list.filter((u) => u.status === "limited").length;
			const onlineCount = list.filter((u) => Boolean(u.is_online)).length;
			return {
				total: list.length,
				active: activeCount,
				disabled: disabledCount,
				expired: expiredCount,
				on_hold: onHoldCount,
				limited: limitedCount,
				online: onlineCount,
			};
		},
		{
			enabled: Boolean(user?.username),
			refetchInterval: 15000,
		},
	);

	const { data: adminsData } = useQuery(
		"dashboard-admins-count",
		async () => {
			const res = await fetch<{ total?: number; admins?: unknown[] }>({ url: "/admins" });
			return res.data?.total ?? res.data?.admins?.length ?? 0;
		},
		{
			enabled: canSeeGlobal,
			staleTime: 60000,
		},
	);

	const { data: maintenanceInfo } = useQuery(
		"dashboard-maintenance-tag",
		async () => {
			const res = await fetch<{
				panel?: { tag?: string; channel?: string; commit?: string };
				update?: { current?: string };
			}>({
				url: "/maintenance/info",
			});
			return res.data;
		},
		{
			staleTime: 60000,
		},
	);

	useSystemMetricsStream(true);

	const systemData = useMemo(() => sanitizeSystemStats(systemDataRaw), [systemDataRaw]);

	const { hasPermission } = useDashboard();
	const canViewSystem = hasPermission("GENERAL_SYSTEM");

	const openHistory = (payload: HistoryModalPayload) => {
		setHistoryModalPayload(payload);
		setHistoryInterval(120);
	};

	if (!canViewSystem) return null;

	if (isSystemLoading && !systemData) {
		return (
			<Flex h="280px" align="center" justify="center">
				<Spinner size="lg" color="panel.accent" thickness="3px" />
			</Flex>
		);
	}

	if (!systemData) return null;

	const allUsers = systemData.total_user || 0;
	const activeUsers = systemData.users_active || 0;
	const onlineUsers = systemData.online_users_count || 0;
	const inactiveUsers = Math.max(0, allUsers - activeUsers);
	const activePercent = allUsers > 0 ? (activeUsers / allUsers) * 100 : 0;
	const inactivePercent = allUsers > 0 ? (inactiveUsers / allUsers) * 100 : 0;
	const onlinePercent = allUsers > 0 ? (onlineUsers / allUsers) * 100 : 0;

	const myTotal = myUsersData?.total ?? systemData.personal_usage?.total_user ?? 0;
	const myActive = myUsersData?.active ?? systemData.personal_usage?.users_active ?? 0;
	const myOnline = myUsersData?.online ?? systemData.personal_usage?.online_users_count ?? 0;
	const myActivePercent = myTotal > 0 ? (myActive / myTotal) * 100 : 0;
	const myOnlinePercent = myTotal > 0 ? (myOnline / myTotal) * 100 : 0;

	const exactVersion =
		maintenanceInfo?.panel?.tag ||
		maintenanceInfo?.update?.current ||
		(systemData.version ? `v${systemData.version}` : "");

	return (
		<Stack spacing={{ base: 4, md: 5 }} {...props}>
			<Flex
				justify="space-between"
				align="center"
				wrap="wrap"
				gap={3}
				px={1}
				py={1}
			>
				<HStack spacing={2} align="center">
					<Box w="8px" h="8px" borderRadius="full" bg="emerald.500" />
					<Text fontSize="13px" fontWeight="600" color="panel.text">
						{t("running")}
					</Text>
					{exactVersion && (
						<HStack
							spacing={1.5}
							align="center"
							dir="ltr"
							sx={{ unicodeBidi: "isolate" }}
						>
							<Text fontSize="12px" color="panel.textMuted">
								·
							</Text>
							<Text fontSize="12px" fontWeight="500" color="panel.textMuted">
								{exactVersion}
							</Text>
						</HStack>
					)}
				</HStack>

				<DashboardMaintenanceControls />
			</Flex>

			<SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} gap={{ base: 3, md: 4 }}>
				<ResourceCard
					label={t("cpuUsage")}
					icon={<CpuChipIcon width={16} />}
					value={`${systemData.cpu_usage.toFixed(1)}%`}
					percent={systemData.cpu_usage}
					metaValue={formatNumberValue(systemData.cpu_cores)}
					metaUnit={t("core")}
					historyLabel={t("viewHistory")}
					isRTL={isRTL}
					onHistory={() =>
						openHistory({
							type: "cpu",
							title: t("cpuUsage"),
							metricLabel: t("cpuUsage"),
							entries: systemData.cpu_history,
						})
					}
				/>
				<ResourceCard
					label={t("memoryUsage")}
					icon={<ServerStackIcon width={16} />}
					value={formatBytes(systemData.memory.current, 1)}
					totalValue={formatBytes(systemData.memory.total, 1)}
					percent={systemData.memory.percent}
					historyLabel={t("viewHistory")}
					isRTL={isRTL}
					onHistory={() =>
						openHistory({
							type: "memory",
							title: t("memoryUsage"),
							metricLabel: t("memoryUsage"),
							entries: systemData.cpu_history,
						})
					}
				/>
				<ResourceCard
					label={t("diskUsage")}
					icon={<CircleStackIcon width={16} />}
					value={formatBytes(systemData.disk.current, 1)}
					totalValue={formatBytes(systemData.disk.total, 1)}
					percent={systemData.disk.percent}
					isRTL={isRTL}
				/>
				<ResourceCard
					label={t("nodes.swap")}
					icon={<SignalIcon width={16} />}
					value={formatBytes(systemData.swap.current, 1)}
					totalValue={formatBytes(systemData.swap.total, 1)}
					percent={systemData.swap.percent}
					isRTL={isRTL}
				/>
			</SimpleGrid>

			<SimpleGrid columns={{ base: 1, md: 2 }} gap={{ base: 3, md: 4 }}>
				<SectionCard
					title={
						<HStack spacing={2.5}>
							<Flex w="26px" h="26px" align="center" justify="center" borderRadius="7px" bg="panel.elevated" color="panel.textSecondary">
								<ArrowDownTrayIcon width={14} />
							</Flex>
							<span>{t("networkSpeed")}</span>
						</HStack>
					}
					action={
						<Button
							size="xs"
							h="22px"
							px={2.5}
							fontSize="11px"
							variant="ghost"
							borderRadius="full"
							color="panel.textMuted"
							fontWeight="500"
							_hover={{ color: "panel.text", bg: "panel.surface" }}
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
					}
				>
					<Stack spacing={3}>
						<SpeedItem
							icon={<ArrowDownTrayIcon width={13} />}
							label={t("incomingSpeed")}
							value={`${formatBytes(systemData.incoming_bandwidth_speed)}/s`}
						/>
						<SpeedItem
							icon={<ArrowUpTrayIcon width={13} />}
							label={t("outgoingSpeed")}
							value={`${formatBytes(systemData.outgoing_bandwidth_speed)}/s`}
						/>
					</Stack>
				</SectionCard>

				<SectionCard
					title={
						<HStack spacing={2.5}>
							<Flex w="26px" h="26px" align="center" justify="center" borderRadius="7px" bg="panel.elevated" color="panel.textSecondary">
								<ClockIcon width={14} />
							</Flex>
							<span>{t("uptime")}</span>
						</HStack>
					}
				>
					<Stack spacing={3}>
						<Flex align="center" justify="space-between" gap={3}>
							<HStack spacing={2.5} color="panel.textMuted">
								<Flex w="28px" h="28px" align="center" justify="center" borderRadius="8px" bg="panel.elevated" flexShrink={0}>
									<ServerStackIcon width={13} />
								</Flex>
								<Text fontSize="13px" fontWeight="500" color="panel.textSecondary">
									{t("systemUptime")}
								</Text>
							</HStack>
							<Text fontSize="13px" fontWeight="700" color="panel.text" dir={isRTL ? "rtl" : "ltr"}>
								{formatLocalizedDuration(systemData.uptime_seconds, t, isRTL)}
							</Text>
						</Flex>
						<Flex align="center" justify="space-between" gap={3}>
							<HStack spacing={2.5} color="panel.textMuted">
								<Flex w="28px" h="28px" align="center" justify="center" borderRadius="8px" bg="panel.elevated" flexShrink={0}>
									<CircleStackIcon width={13} />
								</Flex>
								<Text fontSize="13px" fontWeight="500" color="panel.textSecondary">
									{t("panelUptime")}
								</Text>
							</HStack>
							<Text fontSize="13px" fontWeight="700" color="panel.text" dir={isRTL ? "rtl" : "ltr"}>
								{formatLocalizedDuration(systemData.panel_uptime_seconds, t, isRTL)}
							</Text>
						</Flex>
					</Stack>
				</SectionCard>
			</SimpleGrid>

			{systemError && (
				<Stack spacing={2}>
					<Box p={4} borderRadius="14px" bg={redErrorBg} borderWidth="1px" borderColor={redErrorBorder}>
						<Text fontSize="13px" fontWeight="700" color="red.500" mb={1}>
							{t("error")}
						</Text>
						<Text fontSize="12px" color="panel.textSecondary">
							{systemError.message}
						</Text>
					</Box>
					{String(systemError.message).toLowerCase().includes("permission") && (
						<Box p={4} borderRadius="14px" bg={orangeErrorBg} borderWidth="1px" borderColor={orangeErrorBorder}>
							<Text fontSize="13px" fontWeight="700" color="orange.500" mb={1}>
								{t("notice")}
							</Text>
							<Text fontSize="12px" color="panel.textSecondary">
								{t("settings.panel.binaryMigrationRequiredDescription")}
							</Text>
						</Box>
					)}
				</Stack>
			)}

			<SectionCard
				noHover
				title={
					<HStack spacing={2.5}>
						<Flex w="26px" h="26px" align="center" justify="center" borderRadius="7px" bg="panel.elevated" color="panel.textSecondary">
							<CpuChipIcon width={14} />
						</Flex>
						<span>{t("panelUsage")}</span>
					</HStack>
				}
				action={
					<Button
						size="xs"
						h="22px"
						px={2.5}
						fontSize="11px"
						variant="ghost"
						borderRadius="full"
						color="panel.textMuted"
						fontWeight="500"
						_hover={{ color: "panel.text", bg: "panel.surface" }}
						onClick={() =>
							openHistory({
								type: "panel",
								title: t("panelUsage"),
								cpuEntries: systemData.panel_cpu_history,
								memoryEntries: systemData.panel_memory_history,
							})
						}
					>
						{t("viewHistory")}
					</Button>
				}
			>
				<SimpleGrid columns={{ base: 1, sm: 2 }} gap={{ base: 3, md: 4 }}>
					<ResourceCard
						label={`${t("cpuUsage")} (Panel)`}
						icon={<CpuChipIcon width={16} />}
						value={`${systemData.panel_cpu_percent.toFixed(1)}%`}
						percent={systemData.panel_cpu_percent}
						metaValue={formatNumberValue(systemData.app_threads)}
						metaUnit={t("thread")}
						isRTL={isRTL}
					/>
					<ResourceCard
						label={`${t("memoryUsage")} (Panel)`}
						icon={<ServerStackIcon width={16} />}
						value={formatBytes(systemData.app_memory, 1)}
						totalValue={formatBytes(systemData.memory.total, 1)}
						percent={systemData.panel_memory_percent}
						isRTL={isRTL}
					/>
				</SimpleGrid>
			</SectionCard>

			<SectionCard
				title={
					<HStack spacing={2.5}>
						<Flex w="26px" h="26px" align="center" justify="center" borderRadius="7px" bg="panel.elevated" color="panel.textSecondary">
							<UserGroupIcon width={14} />
						</Flex>
						<span>{t("usersOverview")}</span>
					</HStack>
				}
				action={
					canSeeGlobal ? (
						<HStack spacing={0.5} bg="panel.elevated" p={0.5} borderRadius="8px">
							<Button
								size="xs"
								h="22px"
								px={2.5}
								fontSize="11px"
								borderRadius="6px"
								variant={activeUserTab === "all" ? "solid" : "ghost"}
								bg={activeUserTab === "all" ? "panel.surface" : "transparent"}
								color={activeUserTab === "all" ? "panel.text" : "panel.textMuted"}
								boxShadow={activeUserTab === "all" ? "0 1px 2px rgba(0,0,0,0.1)" : "none"}
								_hover={{ color: "panel.text" }}
								onClick={() => setActiveUserTab("all")}
							>
								{t("allUsers")}
							</Button>
							<Button
								size="xs"
								h="22px"
								px={2.5}
								fontSize="11px"
								borderRadius="6px"
								variant={activeUserTab === "mine" ? "solid" : "ghost"}
								bg={activeUserTab === "mine" ? "panel.surface" : "transparent"}
								color={activeUserTab === "mine" ? "panel.text" : "panel.textMuted"}
								boxShadow={activeUserTab === "mine" ? "0 1px 2px rgba(0,0,0,0.1)" : "none"}
								_hover={{ color: "panel.text" }}
								onClick={() => setActiveUserTab("mine")}
							>
								{t("myUsers")}
							</Button>
						</HStack>
					) : null
				}
			>
				<AnimatedHeightWrapper activeKey={activeUserTab}>
					{activeUserTab === "all" ? (
						<Stack spacing={2}>
							<UserStatRow label={t("totalUsers")} count={allUsers} />
							<UserStatRow
								label={t("activeUsers")}
								count={activeUsers}
								percent={activePercent}
								badgeLabel={t("active")}
								badgeColor="emerald"
							/>
							<UserStatRow
								label={t("inactiveUsers")}
								count={inactiveUsers}
								percent={inactivePercent}
								badgeLabel={t("disabled")}
								badgeColor="gray"
							/>
							<UserStatRow
								label={t("onlineUsers")}
								count={onlineUsers}
								percent={onlinePercent}
								badgeLabel={t("online")}
								badgeColor="blue"
							/>
							<UserStatRow
								label={t("trafficUsage")}
								secondaryText={formatBytes(systemData.traffic_used_total)}
							/>
						</Stack>
					) : (
						<Stack spacing={2}>
							<UserStatRow label={t("totalUsers")} count={myTotal} />
							<UserStatRow
								label={t("activeUsers")}
								count={myActive}
								percent={myActivePercent}
								badgeLabel={t("active")}
								badgeColor="emerald"
							/>
							<UserStatRow
								label={t("onlineUsers")}
								count={myOnline}
								percent={myOnlinePercent}
								badgeLabel={t("online")}
								badgeColor="blue"
							/>
							<UserStatRow
								label={t("trafficUsage")}
								secondaryText={formatBytes(
									systemData.personal_usage?.traffic_used_total ?? 0,
								)}
							/>
							{(systemData.personal_usage?.traffic_reset_total ?? 0) > 0 && (
								<UserStatRow
									label={t("resetUsage")}
									secondaryText={formatBytes(
										systemData.personal_usage?.traffic_reset_total ?? 0,
									)}
								/>
							)}
						</Stack>
					)}
				</AnimatedHeightWrapper>
			</SectionCard>

			{canSeeGlobal && adminsData !== undefined && (
				<SectionCard
					title={
						<HStack spacing={2.5}>
							<Flex w="26px" h="26px" align="center" justify="center" borderRadius="7px" bg="panel.elevated" color="panel.textSecondary">
								<UserGroupIcon width={14} />
							</Flex>
							<span>{t("admins.listHeader")}</span>
						</HStack>
					}
				>
					<Flex align="center" justify="space-between">
						<Text fontSize="13px" fontWeight="500" color="panel.textSecondary">
							{t("totalAdmins")}
						</Text>
						<Text
							fontSize="13px"
							fontWeight="700"
							color="panel.text"
							dir="ltr"
							sx={{ fontVariantNumeric: "tabular-nums", unicodeBidi: "isolate" }}
						>
							{formatNumberValue(adminsData)}
						</Text>
					</Flex>
				</SectionCard>
			)}

			<HistoryModal
				isOpen={Boolean(historyModalPayload)}
				onClose={() => setHistoryModalPayload(null)}
				payload={historyModalPayload}
				intervalSeconds={historyInterval}
				onIntervalChange={setHistoryInterval}
			/>
		</Stack>
	);
};
