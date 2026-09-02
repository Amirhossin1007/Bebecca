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
	UsersIcon,
} from "@heroicons/react/24/outline";
import type { ApexOptions } from "apexcharts";
import { useDashboard } from "contexts/DashboardContext";
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
	mergeLiveSystemStats,
} from "utils/systemMetrics";
import { getAPIWebSocketURL } from "utils/websocket";
import { DashboardMaintenanceControls } from "./DashboardMaintenanceControls";
import { motion, AnimatePresence } from "framer-motion";

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
	fallback?: SystemStats,
): SystemStats => {
	const base = value ?? fallback ?? ({} as SystemStats);
	const rawMemory = safeUsageStats(base.memory);
	const rawDisk = safeUsageStats(base.disk);
	const rawSwap = safeUsageStats(base.swap);

	return {
		version: typeof base.version === "string" ? base.version : "",
		channel: typeof base.channel === "string" ? base.channel : "",
		status: typeof base.status === "string" ? base.status : "running",
		uptime_seconds: toFiniteNumber(base.uptime_seconds),
		app_uptime: toFiniteNumber(base.app_uptime),
		cpu_usage: toFiniteNumber(base.cpu_usage),
		cpu_cores: toFiniteNumber(base.cpu_cores),
		panel_cpu_percent: toFiniteNumber(base.panel_cpu_percent),
		panel_memory_percent: toFiniteNumber(base.panel_memory_percent),
		app_memory: toFiniteNumber(base.app_memory),
		app_threads: toFiniteNumber(base.app_threads),
		incoming_bandwidth_speed: toFiniteNumber(base.incoming_bandwidth_speed),
		outgoing_bandwidth_speed: toFiniteNumber(base.outgoing_bandwidth_speed),
		users_active: toFiniteNumber(base.users_active),
		users_disabled: toFiniteNumber(base.users_disabled),
		users_expired: toFiniteNumber(base.users_expired),
		users_limited: toFiniteNumber(base.users_limited),
		users_online: toFiniteNumber(base.users_online),
		users_total: toFiniteNumber(base.users_total),
		memory: rawMemory,
		disk: rawDisk,
		swap: rawSwap,
		cpu_history: safeHistory(base.cpu_history),
		memory_history: safeHistory(base.memory_history),
		network_history: safeNetworkHistory(base.network_history),
		panel_cpu_history: safeHistory(base.panel_cpu_history),
		panel_memory_history: safeHistory(base.panel_memory_history),
		personal_usage: base.personal_usage,
	};
};

const HISTORY_INTERVALS = [
	{ labelKey: "minute.two", seconds: 120 },
	{ labelKey: "minute.ten", seconds: 600 },
	{ labelKey: "minute.thirty", seconds: 1800 },
	{ labelKey: "hour.one", seconds: 3600 },
	{ labelKey: "hour.three", seconds: 10800 },
	{ labelKey: "hour.five", seconds: 18000 },
];

const clampPercent = (val: number) => Math.min(100, Math.max(0, val));

const formatNumberValue = (value: number | string | undefined): string => {
	if (value === undefined || value === null) return "";
	return numberWithCommas(value);
};

const formatLocalizedDuration = (seconds: number, t: TFunction, isRTL = false): string => {
	const d = Math.floor(seconds / 86400);
	const h = Math.floor((seconds % 86400) / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = Math.floor(seconds % 60);

	const parts: { val: number; unitKey: string }[] = [];
	if (d > 0) parts.push({ val: d, unitKey: "day" });
	if (h > 0 || d > 0) parts.push({ val: h, unitKey: "hour" });
	if (m > 0 || h > 0 || d > 0) parts.push({ val: m, unitKey: "minute" });
	parts.push({ val: s, unitKey: "second" });

	const formattedParts = parts.map((p) => `${formatNumberValue(p.val)} ${t(p.unitKey)}`);

	if (formattedParts.length === 1) return formattedParts[0];
	if (formattedParts.length === 2) {
		return `${formattedParts[0]}${t("common.and")}${formattedParts[1]}`;
	}
	const leading = formattedParts.slice(0, -1).join(t("common.comma"));
	const last = formattedParts[formattedParts.length - 1];
	return `${leading}${t("common.and")}${last}`;
};

interface HistoryModalPayload {
	type: "cpu" | "memory" | "network" | "panel";
	title: string;
	metricLabel?: string;
	entries?: { timestamp: number; value: number }[];
	networkEntries?: { timestamp: number; incoming: number; outgoing: number }[];
	cpuEntries?: { timestamp: number; value: number }[];
	memoryEntries?: { timestamp: number; value: number }[];
}

const HistoryModal: FC<{
	isOpen: boolean;
	onClose: () => void;
	payload: HistoryModalPayload | null;
	intervalSeconds: number;
	onIntervalChange: (seconds: number) => void;
	systemUptimeSeconds: number;
}> = ({
	isOpen,
	onClose,
	payload,
	intervalSeconds,
	onIntervalChange,
	systemUptimeSeconds,
}) => {
	const { t, i18n } = useTranslation();
	const { colorMode } = useColorMode();
	const isRTL = i18n.dir() === "rtl";

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

		if (!timestamps.length) {
			const now = Math.floor(Date.now() / 1000);
			return { latestTimestamp: now, availableSpan: Math.max(120, systemUptimeSeconds || 120) };
		}
		const maxT = Math.max(...timestamps);
		const minT = Math.min(...timestamps);
		return { latestTimestamp: maxT, availableSpan: Math.max(120, maxT - minT, systemUptimeSeconds || 120) };
	}, [payload, systemUptimeSeconds]);

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
			colors: ["#3b82f6", "#10b981", "#f59e0b", "#a855f7"],
			fill: {
				type: "gradient",
				gradient: {
					shadeIntensity: 1,
					opacityFrom: 0.32,
					opacityTo: 0.02,
					stops: [0, 100],
				},
			},
			dataLabels: { enabled: false },
			theme: { mode: colorMode },
			stroke: { curve: "smooth", width: 2.5 },
			markers: {
				size: 4,
				strokeWidth: 2,
				strokeColors: colorMode === "dark" ? "#1e293b" : "#ffffff",
				hover: { size: 6 },
			},
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
						second: "HH:mm:ss",
					},
				},
			},
			yaxis: {
				decimalsInFloat: 1,
				labels: {
					style: { colors: mutedTextColor, fontSize: "11px", fontFamily: "inherit" },
					formatter: (val: number) => {
						if (!Number.isFinite(val)) return "0";
						if (payload?.type === "network") {
							return `${formatBytes(val)}/s`;
						}
						return `${val.toFixed(1)}%`;
					},
				},
			},
			legend: {
				position: "bottom",
				labels: { colors: mutedTextColor },
				markers: {
					width: 10,
					height: 10,
					radius: 12,
				},
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
						return `${val.toFixed(2)}%`;
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
									width="100%"
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
									fontSize="12px"
									fontWeight="600"
								>
									<Text as="span" dir="ltr" sx={{ unicodeBidi: "isolate" }}>
										{metaValue}
									</Text>
									<Text as="span">
										{metaUnit}
									</Text>
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
				</Flex>
				<Progress
					value={safe}
					size="xs"
					borderRadius="full"
					bg={trackBg}
					sx={{
						"& > div": {
							bg: criticalColor,
							borderRadius: "full",
							transition: "width 0.4s ease, background-color 0.4s ease",
						},
					}}
				/>
			</Box>
		</Box>
	);
};

const MetricRow: FC<{
	label: string;
	value: string | number;
	badge?: { text: string; colorScheme: string };
	isRTL?: boolean;
}> = ({ label, value, badge, isRTL = false }) => (
	<Flex
		py={2.5}
		px={3}
		borderRadius="12px"
		align="center"
		justify="space-between"
		bg="panel.elevated"
		transition="background-color 0.2s ease"
		_hover={{ bg: "panel.surface" }}
	>
		<Text fontSize="13px" fontWeight="500" color="panel.textSecondary">
			{label}
		</Text>
		<HStack spacing={2} align="center">
			{badge && (
				<Badge size="sm" variant="subtle" colorScheme={badge.colorScheme} borderRadius="full" px={2} fontSize="10px">
					{badge.text}
				</Badge>
			)}
			<Text
				fontSize="13px"
				fontWeight="700"
				color="panel.text"
				dir={isRTL ? "rtl" : "ltr"}
				sx={{ fontVariantNumeric: "tabular-nums" }}
			>
				{value}
			</Text>
		</HStack>
	</Flex>
);

const SpeedItem: FC<{
	icon: ReactNode;
	label: string;
	value: string;
}> = ({ icon, label, value }) => {
	const accent = "var(--rb-panel-accent)";
	return (
		<Flex
			p={3}
			borderRadius="14px"
			bg="panel.elevated"
			align="center"
			justify="space-between"
			gap={3}
			transition="background-color 0.2s ease"
			_hover={{ bg: "panel.surface" }}
		>
			<HStack spacing={2.5}>
				<Flex
					w="30px"
					h="30px"
					align="center"
					justify="center"
					borderRadius="8px"
					bg="panel.surface"
					color={accent}
					flexShrink={0}
				>
					{icon}
				</Flex>
				<Text fontSize="13px" fontWeight="500" color="panel.textSecondary">
					{label}
				</Text>
			</HStack>
			<Text
				fontSize="14px"
				fontWeight="700"
				color="panel.text"
				dir="ltr"
				sx={{ fontVariantNumeric: "tabular-nums", unicodeBidi: "isolate" }}
			>
				{value}
			</Text>
		</Flex>
	);
};

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

	const { currentUser } = useGetUser();
	const { system: initialSystemData } = useDashboard();
	const isAdminUser = currentUser?.role === AdminRole.admin;
	const canSeeGlobal = currentUser?.role === AdminRole.sudo;

	const [activeUserTab, setActiveUserTab] = useState<"global" | "mine">("global");
	const [historyModalPayload, setHistoryModalPayload] = useState<HistoryModalPayload | null>(null);
	const [historyInterval, setHistoryInterval] = useState<number>(120);

	useSystemMetricsStream(true);

	const { data: rawSystemData } = useQuery<SystemStats>(
		StatisticsQueryKey,
		async () => {
			const res = await fetch<SystemStats>("/system");
			return res.data;
		},
		{
			initialData: initialSystemData,
			refetchInterval: 10000,
			staleTime: 5000,
		},
	);

	const { data: myUsersData } = useQuery(
		["my-users-stats", currentUser?.username],
		async () => {
			if (!currentUser?.username) return null;
			const res = await fetch<any>(`/users?admin=${encodeURIComponent(currentUser.username)}`);
			return res.data;
		},
		{
			enabled: !!currentUser?.username,
			refetchInterval: 15000,
			staleTime: 10000,
		},
	);

	const { data: maintenanceInfo } = useQuery(
		"maintenance-info-stream",
		async () => {
			const res = await fetch<{
				panel?: { tag?: string; channel?: string };
				update?: { current?: string; latest?: string; available?: boolean };
			}>("/maintenance/info");
			return res.data;
		},
		{
			staleTime: 60000,
			refetchInterval: 60000,
		},
	);

	const myUsersStats = useMemo(() => {
		const list = Array.isArray(myUsersData?.users)
			? myUsersData.users
			: Array.isArray(myUsersData)
				? myUsersData
				: [];

		const total = list.length;
		const active = list.filter((u: any) => u.status === "active").length;
		const online = list.filter((u: any) => u.online_at && Date.now() / 1000 - Number(u.online_at) < 300).length;
		const totalUsedTraffic = list.reduce((acc: number, u: any) => acc + (Number(u.used_traffic) || 0), 0);

		return {
			total,
			active,
			online,
			totalUsedTraffic,
		};
	}, [myUsersData]);

	const systemData = useMemo(
		() => sanitizeSystemStats(rawSystemData, initialSystemData),
		[rawSystemData, initialSystemData],
	);

	const openHistory = (payload: HistoryModalPayload) => {
		setHistoryModalPayload(payload);
	};

	const isServiceOnline = systemData.status === "running";
	const activeVersion = maintenanceInfo?.panel?.tag || maintenanceInfo?.update?.current || systemData.version;

	const redErrorBg = useColorModeValue("red.50", "rgba(239, 68, 68, 0.08)");
	const redErrorBorder = useColorModeValue("red.200", "rgba(239, 68, 68, 0.2)");
	const orangeErrorBg = useColorModeValue("orange.50", "rgba(245, 158, 11, 0.08)");
	const orangeErrorBorder = useColorModeValue("orange.200", "rgba(245, 158, 11, 0.2)");

	return (
		<Stack spacing={{ base: 4, md: 5 }} {...props}>
			<Flex
				direction={{ base: "column", sm: "row" }}
				justify="space-between"
				align={{ base: "stretch", sm: "center" }}
				gap={3}
				py={1}
			>
				<HStack spacing={3} align="center">
					<Flex
						align="center"
						gap={2}
						px={3}
						py={1.5}
						borderRadius="full"
						bg="panel.surface"
						borderWidth="1px"
						borderColor="panel.border"
					>
						<Box
							w="7px"
							h="7px"
							borderRadius="full"
							bg={isServiceOnline ? "#10b981" : "#ef4444"}
							boxShadow={isServiceOnline ? "0 0 8px rgba(16, 185, 129, 0.6)" : "0 0 8px rgba(239, 68, 68, 0.6)"}
						/>
						<Text fontSize="12px" fontWeight="600" color="panel.text">
							{isServiceOnline ? t("running") : t("stopped")}
						</Text>
						{activeVersion && (
							<HStack spacing={1.5} dir="ltr" sx={{ unicodeBidi: "isolate" }}>
								<Text as="span" fontSize="12px" color="panel.textMuted">
									·
								</Text>
								<Text
									as="span"
									fontSize="12px"
									fontWeight="500"
									color="panel.textMuted"
								>
									{activeVersion}
								</Text>
							</HStack>
						)}
					</Flex>
				</HStack>

				<DashboardMaintenanceControls channel={systemData.channel} version={systemData.version} />
			</Flex>

			<SimpleGrid columns={{ base: 1, sm: 2, xl: 4 }} gap={{ base: 3, md: 4 }}>
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
							entries: systemData.memory_history,
						})
					}
				/>
				<ResourceCard
					label={t("swapUsage")}
					icon={<CircleStackIcon width={16} />}
					value={formatBytes(systemData.swap.current, 1)}
					totalValue={formatBytes(systemData.swap.total, 1)}
					percent={systemData.swap.percent}
					isRTL={isRTL}
				/>
				<ResourceCard
					label={t("diskUsage")}
					icon={<CircleStackIcon width={16} />}
					value={formatBytes(systemData.disk.current, 1)}
					totalValue={formatBytes(systemData.disk.total, 1)}
					percent={systemData.disk.percent}
					isRTL={isRTL}
				/>
			</SimpleGrid>

			<SimpleGrid columns={{ base: 1, md: 2 }} gap={{ base: 3, md: 4 }}>
				<SectionCard
					title={
						<HStack spacing={2.5}>
							<Flex w="26px" h="26px" align="center" justify="center" borderRadius="7px" bg="panel.elevated" color="panel.textSecondary">
								<SignalIcon width={14} />
							</Flex>
							<span>{t("bandwidthSpeed")}</span>
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
								{formatLocalizedDuration(systemData.app_uptime, t, isRTL)}
							</Text>
						</Flex>
					</Stack>
				</SectionCard>
			</SimpleGrid>

			{systemData.personal_usage && (
				<Stack spacing={3}>
					{systemData.personal_usage.is_disabled && (
						<Box p={4} borderRadius="14px" bg={redErrorBg} borderWidth="1px" borderColor={redErrorBorder}>
							<Text fontSize="13px" fontWeight="700" color="red.500" mb={1}>
								{t("admins.disabledReason.timeLimitExceeded")}
							</Text>
							{systemData.personal_usage.disabled_reason && (
								<Text fontSize="12px" color="red.400">
									{systemData.personal_usage.disabled_reason}
								</Text>
							)}
						</Box>
					)}
					{systemData.personal_usage.traffic_limit_reached && (
						<Box p={4} borderRadius="14px" bg={orangeErrorBg} borderWidth="1px" borderColor={orangeErrorBorder}>
							<Text fontSize="13px" fontWeight="700" color="orange.500">
								{t("admins.trafficDepletedNotice")}
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
								h="24px"
								px={2.5}
								borderRadius="6px"
								fontSize="11px"
								variant={activeUserTab === "global" ? "solid" : "ghost"}
								colorScheme={activeUserTab === "global" ? "primary" : "gray"}
								color={activeUserTab === "global" ? undefined : "panel.textMuted"}
								onClick={() => setActiveUserTab("global")}
							>
								{t("allUsers")}
							</Button>
							<Button
								size="xs"
								h="24px"
								px={2.5}
								borderRadius="6px"
								fontSize="11px"
								variant={activeUserTab === "mine" ? "solid" : "ghost"}
								colorScheme={activeUserTab === "mine" ? "primary" : "gray"}
								color={activeUserTab === "mine" ? undefined : "panel.textMuted"}
								onClick={() => setActiveUserTab("mine")}
							>
								{t("myUsers")}
							</Button>
						</HStack>
					) : undefined
				}
			>
				<AnimatedHeightWrapper activeKey={activeUserTab}>
					{activeUserTab === "global" && canSeeGlobal ? (
						<VStack spacing={2.5} align="stretch">
							<MetricRow label={t("totalUsers")} value={formatNumberValue(systemData.users_total)} isRTL={isRTL} />
							<MetricRow
								label={t("activeUsers")}
								value={formatNumberValue(systemData.users_active)}
								badge={{
									text: `${((systemData.users_active / (systemData.users_total || 1)) * 100).toFixed(0)}%`,
									colorScheme: "green",
								}}
								isRTL={isRTL}
							/>
							<MetricRow
								label={t("onlineUsers")}
								value={formatNumberValue(systemData.users_online)}
								badge={{
									text: `${((systemData.users_online / (systemData.users_total || 1)) * 100).toFixed(0)}%`,
									colorScheme: "blue",
								}}
								isRTL={isRTL}
							/>
							<MetricRow label={t("disabledUsers")} value={formatNumberValue(systemData.users_disabled)} isRTL={isRTL} />
							<MetricRow label={t("expiredUsers")} value={formatNumberValue(systemData.users_expired)} isRTL={isRTL} />
							<MetricRow label={t("limitedUsers")} value={formatNumberValue(systemData.users_limited)} isRTL={isRTL} />
						</VStack>
					) : (
						<VStack spacing={2.5} align="stretch">
							<MetricRow label={t("totalUsers")} value={formatNumberValue(myUsersStats.total)} isRTL={isRTL} />
							<MetricRow
								label={t("activeUsers")}
								value={formatNumberValue(myUsersStats.active)}
								badge={{
									text: `${((myUsersStats.active / (myUsersStats.total || 1)) * 100).toFixed(0)}%`,
									colorScheme: "green",
								}}
								isRTL={isRTL}
							/>
							<MetricRow
								label={t("onlineUsers")}
								value={formatNumberValue(myUsersStats.online)}
								badge={{
									text: `${((myUsersStats.online / (myUsersStats.total || 1)) * 100).toFixed(0)}%`,
									colorScheme: "blue",
								}}
								isRTL={isRTL}
							/>
							<MetricRow
								label={t("totalUserUsage")}
								value={formatBytes(myUsersStats.totalUsedTraffic)}
								isRTL={isRTL}
							/>
							{systemData.personal_usage?.reset_traffic && systemData.personal_usage.reset_traffic > 0 ? (
								<MetricRow
									label={t("dashboard.resetTraffic", "حجم ریست‌شده")}
									value={formatBytes(systemData.personal_usage.reset_traffic)}
									isRTL={isRTL}
								/>
							) : null}
						</VStack>
					)}
				</AnimatedHeightWrapper>
			</SectionCard>

			{systemData.personal_usage && isAdminUser && (
				<SectionCard
					title={
						<HStack spacing={2.5}>
							<Flex w="26px" h="26px" align="center" justify="center" borderRadius="7px" bg="panel.elevated" color="panel.textSecondary">
								<UsersIcon width={14} />
							</Flex>
							<span>{t("adminUsageSummary")}</span>
						</HStack>
					}
				>
					<VStack spacing={2.5} align="stretch">
						<MetricRow
							label={t("totalUsers")}
							value={formatNumberValue(myUsersStats.total)}
							isRTL={isRTL}
						/>
						<MetricRow
							label={t("activeUsers")}
							value={formatNumberValue(myUsersStats.active)}
							badge={{
								text: `${((myUsersStats.active / (myUsersStats.total || 1)) * 100).toFixed(0)}%`,
								colorScheme: "green",
							}}
							isRTL={isRTL}
						/>
						<MetricRow
							label={
								systemData.personal_usage.traffic_basis === "created_traffic"
									? t("dashboard.currentCreatedTraffic")
									: t("dashboard.currentUserUsage")
							}
							value={formatBytes(systemData.personal_usage.current_usage)}
							isRTL={isRTL}
						/>
						{systemData.personal_usage.traffic_limit ? (
							<MetricRow
								label={t("admins.trafficLimit")}
								value={formatBytes(systemData.personal_usage.traffic_limit)}
								isRTL={isRTL}
							/>
						) : null}
					</VStack>
				</SectionCard>
			)}

			<HistoryModal
				isOpen={!!historyModalPayload}
				onClose={() => setHistoryModalPayload(null)}
				payload={historyModalPayload}
				intervalSeconds={historyInterval}
				onIntervalChange={setHistoryInterval}
				systemUptimeSeconds={systemData.uptime_seconds}
			/>
		</Stack>
	);
};
