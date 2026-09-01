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
} from "@chakra-ui/react";
import {
	ArrowDownTrayIcon,
	ArrowUpTrayIcon,
	CheckCircleIcon,
	CircleStackIcon,
	ClockIcon,
	CpuChipIcon,
	ExclamationTriangleIcon,
	ServerStackIcon,
	ShieldCheckIcon,
	SignalIcon,
	UserGroupIcon,
	UserIcon,
	WifiIcon,
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
	useState,
} from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "react-query";
import { fetch } from "service/http";
import { AdminRole } from "types/Admin";
import type { SystemStats } from "types/System";
import { formatBytes, numberWithCommas } from "utils/formatByte";
import { formatDuration } from "utils/formatDuration";
import {
	mergeLiveSystemStats,
	sampleSparklineValues,
} from "utils/systemMetrics";
import { getAPIWebSocketURL } from "utils/websocket";
import { ChartBox } from "./common/ChartBox";
import { DashboardMaintenanceControls } from "./DashboardMaintenanceControls";

export const StatisticsQueryKey = "statistics-query-key";

const HistoryChart = lazy(() => import("react-apexcharts"));

const iconProps = {
	baseStyle: {
		w: 5,
		h: 5,
		position: "relative",
		zIndex: "2",
	},
};

/* فرمت هوشمند و خوانای زمان */
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
		online_users_usage: toFiniteNumber(raw.online_users_usage),
		online_users_upload_speed: toFiniteNumber(raw.online_users_upload_speed),
		online_users_download_speed: toFiniteNumber(raw.online_users_download_speed),
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
		<Modal isOpen={isOpen} onClose={onClose} size="2xl" scrollBehavior="inside">
			<ModalOverlay bg="blackAlpha.500" />
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
						<Box
							key={`chart-interval-box-${intervalSeconds}`}
							mx="-10px"
							sx={{
								"@keyframes subtleFadeIn": {
									from: { opacity: 0.65 },
									to: { opacity: 1 },
								},
								animation: "subtleFadeIn 0.2s ease-out",
								"@media (prefers-reduced-motion: reduce)": {
									animation: "none",
								},
							}}
						>
							<Suspense
								fallback={
									<Flex h="300px" align="center" justify="center">
										<Spinner />
									</Flex>
								}
							>
								<HistoryChart
									key={`chart-interval-${intervalSeconds}`}
									options={options}
									series={chartSeries}
									type="area"
									height={300}
								/>
							</Suspense>
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

const HistorySparkline: FC<{ values: number[]; accent?: string }> = ({
	values,
	accent,
}) => {
	const defaultColor = useColorModeValue("gray.600", "gray.300");
	const normalized = sampleSparklineValues(values.length ? values : [0]);
	const maxValue = Math.max(...normalized, 1);
	const singlePointY = 39 - (Math.max(0, normalized[0]) / maxValue) * 38;
	const points = normalized
		.map((value, index) => {
			const x =
				normalized.length === 1
					? 50
					: (index / (normalized.length - 1)) * 100;
			const y = 39 - (Math.max(0, value) / maxValue) * 38;
			return `${x.toFixed(2)},${y.toFixed(2)}`;
		})
		.join(" ");

	return (
		<Box
			as="svg"
			viewBox="0 0 100 40"
			preserveAspectRatio="none"
			mt={3}
			h="42px"
			w="full"
			color={accent ?? defaultColor}
			aria-hidden="true"
		>
			{normalized.length === 1 ? (
				<line
					x1="42"
					x2="58"
					y1={singlePointY}
					y2={singlePointY}
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					vectorEffect="non-scaling-stroke"
				/>
			) : (
				<polyline
					points={points}
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
					vectorEffect="non-scaling-stroke"
				/>
			)}
		</Box>
	);
};

const UsageMetricCard: FC<{
	label: string;
	icon: ReactNode;
	primaryValue: string;
	percent: number;
	subtitle?: string;
	onViewHistory?: () => void;
	actionLabel?: string;
	isRTL?: boolean;
}> = ({ label, icon, primaryValue, percent, subtitle, onViewHistory, actionLabel, isRTL }) => {
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
			minW={0}
			transition="all 0.25s cubic-bezier(0.16, 1, 0.3, 1)"
			_hover={{
				borderColor: "panel.borderStrong",
				bg: "panel.elevated",
			}}
		>
			<Stack spacing={3.5}>
				<Flex justify="space-between" align="center">
					<HStack spacing={2.5}>
						<ThemedIconBadge icon={icon} />
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
							_hover={{ color: "panel.text", bg: "panel.surface" }}
							onClick={onViewHistory}
						>
							{actionLabel ?? "نمایش تاریخچه"}
						</Button>
					)}
				</Flex>

				<Flex justify="space-between" align="baseline">
					<Text
						fontSize={{ base: "xl", md: "22px" }}
						fontWeight="800"
						lineHeight="1.2"
						color="panel.text"
						dir="ltr"
						sx={{ fontVariantNumeric: "tabular-nums", unicodeBidi: "isolate" }}
					>
						{primaryValue}
					</Text>
					{subtitle && (
						<Text
							fontSize="xs"
							fontWeight="700"
							color="panel.textMuted"
							dir={isRTL ? "rtl" : "ltr"}
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
					sx={{
						"& > div": {
							backgroundColor: "var(--rb-panel-accent)",
						},
					}}
				/>
			</Stack>
		</Box>
	);
};

/* کارت داخلی سرعت و آپتایم - کاملاً ضد تداخل و ریسپانسیو در هر سایز */
const ResponsiveInnerCard: FC<{
	icon: ReactNode;
	label: string;
	value: string;
	dir?: "ltr" | "rtl";
}> = ({ icon, label, value, dir }) => (
	<Box
		p={{ base: 3, md: 3.5 }}
		borderRadius="xl"
		bg="panel.elevated"
		borderWidth="1px"
		borderColor="panel.border"
		minW={0}
		overflow="hidden"
		transition="all 0.2s ease"
		_hover={{ borderColor: "panel.borderStrong" }}
	>
		<Stack spacing={1.5} minW={0}>
			<HStack spacing={2} minW={0}>
				<ThemedIconBadge icon={icon} size={7} />
				<Text
					fontSize="xs"
					fontWeight="700"
					color="panel.textSecondary"
					whiteSpace="nowrap"
					overflow="hidden"
					textOverflow="ellipsis"
				>
					{label}
				</Text>
			</HStack>
			<Text
				fontSize={{ base: "xs", sm: "sm" }}
				fontWeight="800"
				color="panel.text"
				dir={dir}
				sx={{ fontVariantNumeric: "tabular-nums" }}
				whiteSpace="nowrap"
				overflow="hidden"
				textOverflow="ellipsis"
				pt={0.5}
			>
				{value}
			</Text>
			{helper ? (
				<Text mt={2} fontSize="xs" color={helperColor} fontWeight="medium">
					{helper}
				</Text>
			) : null}
		</Box>
	);
};

const SystemOverviewCard: FC<{
	data: SystemStats;
	t: TFunction;
	onOpenHistory: (payload: HistoryModalPayload) => void;
}> = ({ data, t, onOpenHistory }) => {
	const cpuHistoryValues = data.cpu_history.map((entry) => entry.value);
	const memoryHistoryValues = data.memory_history.map((entry) => entry.value);
	const swapHistoryValues = data.swap_history.map((entry) => entry.value);
	const diskHistoryValues = data.disk_history.map((entry) => entry.value);
	const cpuThreads = data.cpu_threads || data.cpu_cores;
	const cpuDetail = [
		`${formatNumberValue(data.cpu_cores)} ${t("cores")} / ${formatNumberValue(cpuThreads)} ${t("threads")}`,
		formatCPUFrequency(data.cpu_frequency_hz),
		`${t("systemUptime")}: ${formatDuration(data.uptime_seconds)}`,
	]
		.filter(Boolean)
		.join(" · ");
	return (
		<ChartBox
			title={t("systemOverview")}
			headerActions={
				<DashboardMaintenanceControls
					channel={data.channel}
					version={data.version}
				/>
			}
		>
			<Stack spacing={5}>
				<SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} gap={5}>
					<UsageMetricCard
						label={t("cpuUsage")}
						percent={data.cpu_usage}
						detail={cpuDetail}
						history={cpuHistoryValues}
						footerLeft={`${t("average")}: ${average(cpuHistoryValues).toFixed(1)}%`}
						footerRight={`${t("peak")}: ${peak(cpuHistoryValues).toFixed(1)}%`}
						actionLabel={t("viewHistory")}
						onOpen={() =>
							onOpenHistory({
								type: "cpu",
								title: t("cpuUsage"),
								metricLabel: t("cpuUsage"),
								entries: data.cpu_history,
							})
						}
					/>
					<UsageMetricCard
						label={t("memoryUsage")}
						percent={data.memory.percent}
						detail={`${formatBytes(data.memory.current)} / ${formatBytes(data.memory.total)}`}
						history={memoryHistoryValues}
						footerLeft={`${t("average")}: ${average(memoryHistoryValues).toFixed(1)}%`}
						footerRight={`${t("peak")}: ${peak(memoryHistoryValues).toFixed(1)}%`}
						actionLabel={t("viewHistory")}
						onOpen={() =>
							onOpenHistory({
								type: "memory",
								title: t("memoryUsage"),
								metricLabel: t("memoryUsage"),
								entries: data.memory_history,
							})
						}
					/>
					<UsageMetricCard
						label={t("swapUsage")}
						percent={data.swap.percent}
						detail={`${formatBytes(data.swap.current)} / ${formatBytes(data.swap.total)}`}
						history={swapHistoryValues}
						footerLeft={`${t("average")}: ${average(swapHistoryValues).toFixed(1)}%`}
						footerRight={`${t("peak")}: ${peak(swapHistoryValues).toFixed(1)}%`}
					/>
					<UsageMetricCard
						label={t("diskUsage")}
						percent={data.disk.percent}
						detail={`${formatBytes(data.disk.current)} / ${formatBytes(data.disk.total)}`}
						history={diskHistoryValues}
						footerLeft={`${t("free")}: ${formatBytes(Math.max(0, data.disk.total - data.disk.current))}`}
						footerRight={`${t("average")}: ${average(diskHistoryValues).toFixed(1)}%`}
					/>
				</SimpleGrid>
				<NetworkSpeedCard
					incoming={data.incoming_bandwidth_speed}
					outgoing={data.outgoing_bandwidth_speed}
					t={t}
					onOpen={() =>
						onOpenHistory({
							type: "network",
							title: t("networkHistory"),
							entries: data.network_history,
						})
					}
				/>
				{data.last_xray_error && (
					<Box
						mt={4}
						p={4}
						borderRadius="xl"
						bg="red.50"
						borderWidth="1px"
						borderColor="red.200"
						_dark={{
							bg: "rgba(239, 68, 68, 0.1)",
							borderColor: "red.800",
						}}
					>
						<HStack spacing={2} mb={2} alignItems="center">
							<Text
								fontSize="sm"
								fontWeight="bold"
								color="red.600"
								_dark={{ color: "red.400" }}
							>
								{t("coreError")}:
							</Text>
						</HStack>
						<Text
							fontSize="sm"
							color="red.700"
							fontFamily="mono"
							whiteSpace="pre-wrap"
							wordBreak="break-word"
							_dark={{ color: "red.300" }}
						>
							{data.last_xray_error}
						</Text>
					</Box>
				)}
				{data.last_telegram_error && (
					<Box
						mt={4}
						p={4}
						borderRadius="xl"
						bg="orange.50"
						borderWidth="1px"
						borderColor="orange.200"
						_dark={{
							bg: "rgba(237, 137, 54, 0.1)",
							borderColor: "orange.800",
						}}
					>
						<HStack
							spacing={2}
							mb={2}
							alignItems="center"
							justifyContent="space-between"
						>
							<Text
								fontSize="sm"
								fontWeight="bold"
								color="orange.600"
								_dark={{ color: "orange.400" }}
							>
								{t("telegramError")}:
							</Text>
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
						<Text
							fontSize="sm"
							color="orange.700"
							fontFamily="mono"
							whiteSpace="pre-wrap"
							wordBreak="break-word"
							_dark={{ color: "orange.300" }}
						>
							{data.last_telegram_error}
						</Text>
					</Box>
				)}
			</Stack>
		</ChartBox>
	);
};

const PanelOverviewCard: FC<{
	data: SystemStats;
	t: TFunction;
	onOpenHistory: (payload: HistoryModalPayload) => void;
}> = ({ data, t, onOpenHistory }) => {
	const panelCpuHistory = data.panel_cpu_history.map((entry) => entry.value);
	const panelMemoryHistory = data.panel_memory_history.map(
		(entry) => entry.value,
	);
	const panelCpuDetail = `${formatNumberValue(data.app_threads)} ${t("threads")} · ${t("panelUptime")}: ${formatDuration(data.panel_uptime_seconds)}`;
	return (
		<ChartBox
			title={t("panelUsage")}
			headerActions={
				<Badge
					colorScheme={data.xray_running ? "green" : "red"}
					borderRadius="full"
					px={3}
					py={1}
				>
					{data.xray_running ? t("status.running") : t("status.stopped")}
				</Badge>
			}
		>
			<Stack spacing={5}>
				<SimpleGrid columns={{ base: 1, md: 2 }} gap={5}>
					<UsageMetricCard
						label={t("cpuUsage")}
						percent={data.panel_cpu_percent}
						detail={panelCpuDetail}
						history={panelCpuHistory}
						footerLeft={`${t("average")}: ${average(panelCpuHistory).toFixed(1)}%`}
						footerRight={`${t("peak")}: ${peak(panelCpuHistory).toFixed(1)}%`}
						actionLabel={t("viewHistory")}
						onOpen={() =>
							onOpenHistory({
								type: "panel",
								title: t("panelUsage"),
								cpuEntries: data.panel_cpu_history,
								memoryEntries: data.panel_memory_history,
							})
						}
					/>
					<UsageMetricCard
						label={t("memoryUsage")}
						percent={data.panel_memory_percent}
						detail={`${formatBytes(data.app_memory)} / ${formatBytes(data.memory.total)}`}
						history={panelMemoryHistory}
						footerLeft={`${t("average")}: ${average(panelMemoryHistory).toFixed(1)}%`}
						footerRight={`${t("peak")}: ${peak(panelMemoryHistory).toFixed(1)}%`}
						actionLabel={t("viewHistory")}
						onOpen={() =>
							onOpenHistory({
								type: "panel",
								title: t("panelUsage"),
								cpuEntries: data.panel_cpu_history,
								memoryEntries: data.panel_memory_history,
							})
						}
					/>
				</SimpleGrid>
			</Stack>
		</ChartBox>
	);
};

const UsersOverviewCard: FC<{
	data: SystemStats;
	t: TFunction;
}> = ({ data, t }) => (
	<ChartBox title={t("usersOverview")}>
		<Stack spacing={5}>
			<MetricBadge
				label={t("total")}
				value={formatNumberValue(data.total_user)}
				colorScheme="blue"
			/>
			<SimpleGrid columns={{ base: 1, sm: 2 }} gap={5}>
				<MetricBadge
					label={t("dashboard.onlineUsersUsage")}
					value={formatBytes(data.online_users_usage)}
					colorScheme="teal"
					helper={t("dashboard.onlineUsersCount", { count: data.online_users })}
				/>
				<MetricBadge
					label={t("dashboard.onlineUsersSpeed")}
					value={`${formatBytes(data.online_users_upload_speed + data.online_users_download_speed)}/s`}
					colorScheme="cyan"
					helper={`↑ ${formatBytes(data.online_users_upload_speed)}/s · ↓ ${formatBytes(data.online_users_download_speed)}/s`}
				/>
			</SimpleGrid>
			<SimpleGrid columns={{ base: 1, sm: 2 }} gap={5}>
				<MetricBadge
					label={t("status.active")}
					value={formatNumberValue(data.users_active)}
					colorScheme="green"
				/>
				<MetricBadge
					label={t("status.disabled")}
					value={formatNumberValue(data.users_disabled)}
					colorScheme="red"
				/>
				<MetricBadge
					label={t("status.expired")}
					value={formatNumberValue(data.users_expired)}
					colorScheme="orange"
				/>
				<MetricBadge
					label={t("status.limited")}
					value={formatNumberValue(data.users_limited)}
					colorScheme="yellow"
				/>
				<Box gridColumn={{ base: "span 1", sm: "span 2" }}>
					<MetricBadge
						label={t("status.on_hold")}
						value={formatNumberValue(data.users_on_hold)}
						colorScheme="purple"
					/>
				</Box>
			</SimpleGrid>
		</Stack>
	</Box>
);

/* Metric Cell با نقطه دایره‌ای ساده و استاندارد */
const MetricCell: FC<{
	label: string;
	value: number | string;
	percentage?: string;
	dotColor?: string;
}> = ({ label, value, percentage, dotColor }) => {
	const cardBg = useColorModeValue("panel.input", "panel.input");
	const borderColor = useColorModeValue("panel.border", "panel.border");

	return (
		<Flex
			p={4}
			borderRadius="xl"
			bg={cardBg}
			borderWidth="1px"
			borderColor={borderColor}
			justify="space-between"
			align="center"
			minW={0}
			overflow="hidden"
			transition="all 0.2s ease"
			_hover={{ borderColor: "panel.borderStrong", bg: "panel.elevated" }}
		>
			<HStack spacing={2.5} minW={0}>
				{dotColor && <Box w="8px" h="8px" borderRadius="full" bg={dotColor} flexShrink={0} />}
				<Text fontSize="xs" fontWeight="700" color="panel.textSecondary" noOfLines={1}>
					{label}
				</Text>
			</HStack>
			<HStack spacing={2} flexShrink={0}>
				{percentage && (
					<Text fontSize="11px" color="panel.textMuted" dir="ltr">
						{percentage}
					</Text>
				)}
				<Text
					fontSize={{ base: "sm", sm: "md" }}
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
};

export const Statistics: FC<BoxProps> = (props) => {
	const { version } = useDashboard();
	const { userData } = useGetUser();
	const { t, i18n } = useTranslation();
	const isRTL = i18n.dir(i18n.language) === "rtl";

	const redErrorBg = useColorModeValue("red.50", "rgba(220, 38, 38, 0.15)");
	const redErrorBorder = useColorModeValue("red.300", "rgba(220, 38, 38, 0.4)");
	const redErrorColor = useColorModeValue("red.900", "red.100");
	const redErrorHeader = useColorModeValue("red.600", "red.300");

	const orangeErrorBg = useColorModeValue("orange.50", "rgba(234, 88, 12, 0.15)");
	const orangeErrorBorder = useColorModeValue("orange.300", "rgba(234, 88, 12, 0.4)");
	const orangeErrorColor = useColorModeValue("orange.900", "orange.100");
	const orangeErrorHeader = useColorModeValue("orange.600", "orange.300");

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

	const cpuSubtitle = `${formatNumberValue(systemData.cpu_cores)} ${t("core", "هسته")}`;
	const panelCpuSubtitle = `${formatNumberValue(systemData.app_threads)} ${t("thread", "ترد")}`;

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
					{/* Hardware Metrics 2x2 Grid */}
					<SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
						<HardwareBentoCard
							label={t("cpuUsage")}
							icon={<CpuChipIcon width={18} />}
							primaryValue={`${systemData.cpu_usage.toFixed(1)}%`}
							percent={systemData.cpu_usage}
							subtitle={cpuSubtitle}
							actionLabel={t("viewHistory")}
							isRTL={isRTL}
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
							isRTL={isRTL}
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
							isRTL={isRTL}
						/>
						<HardwareBentoCard
							label={t("diskUsage")}
							icon={<CircleStackIcon width={18} />}
							primaryValue={`${formatBytes(systemData.disk.current, 1)} / ${formatBytes(systemData.disk.total, 1)}`}
							percent={systemData.disk.percent}
							subtitle={`${systemData.disk.percent.toFixed(1)}%`}
							isRTL={isRTL}
						/>
					</SimpleGrid>

					{/* Row: Speeds Card (Left) & Uptime Card (Right) */}
					<SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
						{/* Separate Speeds Card */}
						<Box
							p={{ base: 4, md: 5 }}
							borderRadius="2xl"
							bg="panel.input"
							borderWidth="1px"
							borderColor="panel.border"
							display="flex"
							flexDirection="column"
							justifyContent="space-between"
							minW={0}
							transition="all 0.25s cubic-bezier(0.16, 1, 0.3, 1)"
							_hover={{ borderColor: "panel.borderStrong", bg: "panel.elevated" }}
						>
							<Flex justify="space-between" align="center" mb={3.5} flexWrap="wrap" gap={2}>
								<HStack spacing={2.5}>
									<ThemedIconBadge icon={<SignalIcon width={18} />} />
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
							</Flex>

							<SimpleGrid columns={{ base: 1, sm: 2 }} gap={3}>
								<ResponsiveInnerCard
									icon={<ArrowDownTrayIcon width={16} />}
									label={t("incomingSpeed")}
									value={`${formatBytes(systemData.incoming_bandwidth_speed)}/s`}
									dir="ltr"
								/>
								<ResponsiveInnerCard
									icon={<ArrowUpTrayIcon width={16} />}
									label={t("outgoingSpeed")}
									value={`${formatBytes(systemData.outgoing_bandwidth_speed)}/s`}
									dir="ltr"
								/>
							</SimpleGrid>
						</Box>

						{/* Symmetrical Uptime Card */}
						<Box
							p={{ base: 4, md: 5 }}
							borderRadius="2xl"
							bg="panel.input"
							borderWidth="1px"
							borderColor="panel.border"
							display="flex"
							flexDirection="column"
							justifyContent="space-between"
							minW={0}
							transition="all 0.25s cubic-bezier(0.16, 1, 0.3, 1)"
							_hover={{ borderColor: "panel.borderStrong", bg: "panel.elevated" }}
						>
							<Flex justify="space-between" align="center" mb={3.5}>
								<HStack spacing={2.5}>
									<ThemedIconBadge icon={<ClockIcon width={18} />} />
									<Text fontSize="sm" fontWeight="700" color="panel.text">
										{t("uptime")}
									</Text>
								</HStack>
							</Flex>

							<SimpleGrid columns={{ base: 1, sm: 2 }} gap={3}>
								<ResponsiveInnerCard
									icon={<ServerStackIcon width={16} />}
									label={t("systemUptime")}
									value={formatLocalizedDuration(systemData.uptime_seconds, t, isRTL)}
									dir={isRTL ? "rtl" : "ltr"}
								/>
								<ResponsiveInnerCard
									icon={<CircleStackIcon width={16} />}
									label={t("panelUptime")}
									value={formatLocalizedDuration(systemData.panel_uptime_seconds, t, isRTL)}
									dir={isRTL ? "rtl" : "ltr"}
								/>
							</SimpleGrid>
						</Box>
					</SimpleGrid>

					{/* Tinted Error Alerts inside System Overview Card (At the Bottom) */}
					{systemData.last_xray_error && (
						<Box
							p={4}
							borderRadius="xl"
							bg={redErrorBg}
							borderWidth="1px"
							borderColor={redErrorBorder}
							color={redErrorColor}
							boxShadow="sm"
							minW={0}
						>
							<HStack spacing={2} mb={1.5} color={redErrorHeader}>
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
							bg={orangeErrorBg}
							borderWidth="1px"
							borderColor={orangeErrorBorder}
							color={orangeErrorColor}
							boxShadow="sm"
							minW={0}
						>
							<HStack spacing={2} mb={2} align="center" justify="space-between">
								<HStack spacing={2} color={orangeErrorHeader}>
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
			>
				<SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
					<HardwareBentoCard
						label={`${t("cpuUsage")} (Panel Process)`}
						icon={<CpuChipIcon width={18} />}
						primaryValue={`${systemData.panel_cpu_percent.toFixed(1)}%`}
						percent={systemData.panel_cpu_percent}
						subtitle={panelCpuSubtitle}
						actionLabel={t("viewHistory")}
						isRTL={isRTL}
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
						isRTL={isRTL}
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
					<HStack spacing={2.5}>
						<ThemedIconBadge icon={<UserGroupIcon width={18} />} />
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
							{t("total")}: {formatNumberValue(systemData.personal_usage?.total_users ?? 0)}
						</Badge>
					)
				}
			>
				<Box
					key={userTab}
					sx={{
						"@keyframes ultraSoftFade": {
							from: { opacity: 0.35, transform: "scale(0.995)" },
							to: { opacity: 1, transform: "scale(1)" },
						},
						animation: "ultraSoftFade 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
					}}
				>
					{canSeeGlobal && userTab === "all" ? (
						/* All Users: 6 Cards in 3 Columns */
						<SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} gap={3.5}>
							<MetricCell
								label={t("total")}
								value={systemData.total_user}
								dotColor="#3b82f6"
							/>
							<MetricCell
								label={t("status.active")}
								value={systemData.users_active}
								percentage={activePercent}
								dotColor="#22c55e"
							/>
							<MetricCell
								label={t("onlineUsers")}
								value={systemData.online_users}
								percentage={onlinePercent}
								dotColor="#06b6d4"
							/>
							<MetricCell
								label={t("status.on_hold")}
								value={systemData.users_on_hold}
								dotColor="#a855f7"
							/>
							<MetricCell
								label={t("status.limited")}
								value={systemData.users_limited}
								dotColor="#eab308"
							/>
							<MetricCell
								label={t("status.expired")}
								value={systemData.users_expired}
								dotColor="#f97316"
							/>
						</SimpleGrid>
					) : (
						/* My Users: 2 Rows × 2 Cards (4 Cards) */
						<SimpleGrid columns={{ base: 1, sm: 2 }} gap={3.5}>
							{/* Row 1: Total & Active */}
							<MetricCell
								label={t("total")}
								value={systemData.personal_usage?.total_users ?? 0}
								dotColor="#3b82f6"
							/>
							<MetricCell
								label={t("status.active")}
								value={systemData.personal_usage?.total_users ?? 0}
								dotColor="#22c55e"
							/>
							{/* Row 2: Online & Consumed Traffic */}
							<MetricCell
								label={t("onlineUsers")}
								value={systemData.online_users}
								dotColor="#06b6d4"
							/>
							<MetricCell
								label={t("consumedData")}
								value={formatBytes(systemData.personal_usage?.consumed_bytes ?? 0, 1)}
								dotColor="#a855f7"
							/>
						</SimpleGrid>
					)}
				</Box>
			</ChartBox>

			{/* 4. Admins Overview ChartBox (Sudo / FullAccess Only) */}
			{canSeeGlobal && systemData.admin_overview && (
				<ChartBox
					title={
						<HStack spacing={2.5}>
							<ThemedIconBadge icon={<ShieldCheckIcon width={18} />} />
							<Text fontWeight="800" fontSize={{ base: "md", md: "lg" }}>
								{t("adminOverview")}
							</Text>
						</HStack>
					}
				>
					<Stack spacing={4}>
						{/* 4 Equal Cards: Total Admins + Roles */}
						<SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} gap={3.5}>
							<MetricCell
								label={t("totalAdmins")}
								value={systemData.admin_overview.total_admins}
								dotColor="#3b82f6"
							/>
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
								dotColor="#10b981"
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
								minW={0}
								transition="all 0.2s ease"
								_hover={{ bg: "panel.elevated", borderColor: "panel.borderStrong" }}
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