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
	ModalFooter,
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
	ExclamationTriangleIcon,
	ServerStackIcon,
	ShieldCheckIcon,
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
import type { UsersListResponse } from "types/User";
import { formatBytes, numberWithCommas } from "utils/formatByte";
import { mergeLiveSystemStats } from "utils/systemMetrics";
import { getAPIWebSocketURL } from "utils/websocket";
import { DashboardMaintenanceControls } from "./DashboardMaintenanceControls";

export const StatisticsQueryKey = "statistics-query-key";

const HistoryChart = lazy(() => import("react-apexcharts"));

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

const toPersianDigits = (value: number | string): string => {
	const farsiDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
	return String(value).replace(/[0-9]/g, (w) => farsiDigits[+w]);
};

const formatLocalizedDuration = (
	totalSeconds: number,
	t: TFunction,
	isRTL: boolean,
): string => {
	if (!totalSeconds || totalSeconds <= 0) {
		const zero = isRTL ? "۰" : "0";
		return `${zero} ${t("second")}`;
	}

	const days = Math.floor(totalSeconds / 86400);
	const hours = Math.floor((totalSeconds % 86400) / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = Math.floor(totalSeconds % 60);

	const dNum = isRTL ? toPersianDigits(days) : String(days);
	const hNum = isRTL ? toPersianDigits(hours) : String(hours);
	const mNum = isRTL ? toPersianDigits(minutes) : String(minutes);
	const sNum = isRTL ? toPersianDigits(seconds) : String(seconds);

	const dText = `${dNum} ${t("day")}`;
	const hText = `${hNum} ${t("hour")}`;
	const mText = `${mNum} ${t("minute")}`;
	const sText = `${sNum} ${t("second")}`;

	const andWord = t("common.and");
	const commaWord = t("common.comma");

	if (days > 0) {
		const parts: string[] = [dText];
		if (hours > 0) parts.push(hText);
		if (minutes > 0) parts.push(mText);
		if (parts.length === 1) return parts[0];
		if (parts.length === 2) return parts.join(andWord);
		return parts.slice(0, -1).join(commaWord) + andWord + parts[parts.length - 1];
	}
	if (hours > 0) return minutes > 0 ? `${hText}${andWord}${mText}` : hText;
	if (minutes > 0) return seconds > 0 ? `${mText}${andWord}${sText}` : mText;
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
	type: "cpu" | "memory" | "network" | "panel" | "panelCpu" | "panelMemory";
	title: string;
	metricLabel?: string;
	entries?: Array<{ timestamp: number; value: number }>;
	networkEntries?: SystemStats["network_history"];
	cpuEntries?: SystemStats["panel_cpu_history"];
	memoryEntries?: SystemStats["panel_memory_history"];
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
	const gridColor = useColorModeValue("rgba(0,0,0,0.06)", "rgba(255,255,255,0.06)");
	const mutedTextColor = useColorModeValue("#64748b", "#94a3b8");

	const latestTimestamp = useMemo(() => {
		if (!payload) return Math.floor(Date.now() / 1000);
		if (payload.type === "network" && payload.networkEntries?.length) {
			return payload.networkEntries[payload.networkEntries.length - 1].timestamp;
		}
		if (payload.type === "panel") {
			const lastCpu = payload.cpuEntries?.[payload.cpuEntries.length - 1]?.timestamp;
			const lastMem = payload.memoryEntries?.[payload.memoryEntries.length - 1]?.timestamp;
			return Math.max(lastCpu || 0, lastMem || 0) || Math.floor(Date.now() / 1000);
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
					data: filtered.map((e) => [e.timestamp * 1000, e.incoming]),
				},
				{
					name: t("networkOutgoing"),
					data: filtered.map((e) => [e.timestamp * 1000, e.outgoing]),
				},
			];
		}
		if (payload.type === "panel") {
			const filteredCpu = (payload.cpuEntries || []).filter((e) => e.timestamp >= cutoff);
			const filteredMem = (payload.memoryEntries || []).filter((e) => e.timestamp >= cutoff);
			return [
				{
					name: `${t("cpuUsage")} (Panel CPU %)`,
					data: filteredCpu.map((e) => [e.timestamp * 1000, e.value]),
				},
				{
					name: `${t("memoryUsage")} (Panel RAM %)`,
					data: filteredMem.map((e) => [e.timestamp * 1000, e.value]),
				},
			];
		}
		if (payload.entries) {
			const filtered = payload.entries.filter((e) => e.timestamp >= cutoff);
			return [
				{
					name: payload.metricLabel ?? payload.title,
					data: filtered.map((e) => [e.timestamp * 1000, e.value]),
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
			<ModalOverlay bg="blackAlpha.700" backdropFilter="blur(8px)" />
			<ModalContent
				bg="panel.surface"
				borderWidth="1px"
				borderColor="panel.border"
				borderRadius="2xl"
				boxShadow="0 32px 80px rgba(0,0,0,0.5)"
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
							{HISTORY_INTERVALS.map((interval) => (
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
									onClick={() => onIntervalChange(interval.seconds)}
								>
									{t(interval.labelKey)}
								</Button>
							))}
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
									key={`chart-${intervalSeconds}`}
									options={options}
									series={chartSeries}
									type="area"
									height={260}
								/>
							</Suspense>
						</Box>
					</Stack>
				</ModalBody>
				<ModalFooter px={{ base: 4, md: 6 }} py={3} borderTopWidth="1px" borderColor="panel.border">
					<Button onClick={onClose} borderRadius="full" variant="ghost" size="sm" color="panel.textMuted">
						{t("close")}
					</Button>
				</ModalFooter>
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
			transition="border-color 0.25s ease, background-color 0.25s ease, box-shadow 0.25s ease"
			_hover={{
				borderColor: "panel.borderStrong",
				bg: "panel.elevated",
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
									gap={1}
									color="panel.textMuted"
									fontSize="12px"
									fontWeight="600"
									dir={isRTL ? "rtl" : "ltr"}
								>
									<Text as="span">
										{isRTL && typeof metaValue === "string" ? toPersianDigits(metaValue) : metaValue}
									</Text>
									<Text as="span">{metaUnit}</Text>
								</Flex>
							)}
						</Flex>
					)}
				</Flex>
			</Box>

			<Box mt={3}>
				<Flex justify="flex-start" align="center" mb={1.5}>
					<Text
						fontSize="11px"
						fontWeight="600"
						color="panel.textMuted"
						dir="ltr"
						sx={{ fontVariantNumeric: "tabular-nums", unicodeBidi: "isolate" }}
					>
						{safe.toFixed(1)}%
					</Text>
				</Flex>
				<Progress
					value={safe}
					size="xs"
					h="3px"
					borderRadius="full"
					bg={trackBg}
					sx={{
						"& > div": {
							backgroundColor: criticalColor,
							transition: "width 0.4s ease, background-color 0.3s ease",
						},
					}}
				/>
			</Box>
		</Box>
	);
};

const StatRow: FC<{
	label: string;
	value: string | number;
	dimLabel?: boolean;
	accent?: boolean;
	tag?: string;
	tagColor?: string;
	helper?: string;
}> = ({ label, value, dimLabel, accent, tag, tagColor, helper }) => {
	const accentColor = "var(--rb-panel-accent)";
	return (
		<Flex
			align="center"
			justify="space-between"
			py={2.5}
			borderBottomWidth="1px"
			borderColor="panel.border"
			_last={{ borderBottomWidth: 0 }}
			gap={3}
		>
			<HStack spacing={2} minW={0} flexWrap="nowrap">
				{tagColor && (
					<Box
						flexShrink={0}
						w="6px"
						h="6px"
						borderRadius="full"
						bg={tagColor}
						boxShadow={`0 0 6px ${tagColor}88`}
					/>
				)}
				<Text
					fontSize="13px"
					fontWeight="500"
					color={dimLabel ? "panel.textMuted" : "panel.textSecondary"}
					noOfLines={1}
				>
					{label}
				</Text>
				{tag && (
					<Badge
						fontSize="10px"
						px={1.5}
						py={0.5}
						borderRadius="md"
						bg="panel.elevated"
						color="panel.textMuted"
						fontWeight="600"
						textTransform="none"
					>
						{tag}
					</Badge>
				)}
			</HStack>
			<VStack align="flex-end" spacing={0} flexShrink={0}>
				<Text
					fontSize="13px"
					fontWeight="700"
					color={accent ? accentColor : "panel.text"}
					dir="ltr"
					sx={{ fontVariantNumeric: "tabular-nums", unicodeBidi: "isolate" }}
				>
					{typeof value === "number" ? formatNumberValue(value) : value}
				</Text>
				{helper && (
					<Text
						fontSize="10px"
						color="panel.textMuted"
						dir="ltr"
						sx={{ fontVariantNumeric: "tabular-nums", unicodeBidi: "isolate" }}
					>
						{helper}
					</Text>
				)}
			</VStack>
		</Flex>
	);
};

const SectionCard: FC<{
	children: ReactNode;
	title?: ReactNode;
	action?: ReactNode;
	layout?: boolean;
}> = ({
	children,
	title,
	action,
	layout,
}) => (
	<Box
		as={layout ? motion.div : "div"}
		layout={layout ? "size" : undefined}
		transition="border-color 0.25s ease, background-color 0.25s ease"
		bg="panel.surface"
		borderWidth="1px"
		borderColor="panel.border"
		borderRadius="20px"
		overflow="hidden"
		_hover={{
			borderColor: "panel.borderStrong",
		}}
		sx={{
			...(layout
				? {
						transition: "height 0.7s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.25s ease, background-color 0.25s ease",
					}
				: {}),
		}}
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

const SpeedItem: FC<{ icon: ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
	<Flex align="center" justify="space-between" gap={3}>
		<HStack spacing={2.5} color="panel.textMuted">
			<Flex w="28px" h="28px" align="center" justify="center" borderRadius="8px" bg="panel.elevated" flexShrink={0}>
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

	const { data: maintenanceInfo } = useQuery<MaintenanceInfo>(
		["dashboard-maintenance-info"],
		() => fetch<MaintenanceInfo>("/maintenance/info", { timeout: 8000 }),
		{
			refetchOnWindowFocus: false,
			staleTime: 5 * 60 * 1000,
			retry: false,
		},
	);

	const { data: myUsersData } = useQuery<UsersListResponse>(
		["dashboard-my-users-stats", userData.username],
		() =>
			fetch<UsersListResponse>("/users", {
				query: { admin: userData.username, limit: 1 },
			}),
		{
			enabled: Boolean(userData.username),
			staleTime: 10_000,
			refetchInterval: 15_000,
		},
	);

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

	const canSeeGlobal = userData.role === AdminRole.Sudo || userData.role === AdminRole.FullAccess;

	const openHistory = (payload: HistoryModalPayload) => {
		setHistoryInterval(HISTORY_INTERVALS[0].seconds);
		setHistoryPayload(payload);
	};

	const redErrorBg = useColorModeValue("red.50", "rgba(220,38,38,0.08)");
	const redErrorBorder = useColorModeValue("red.200", "rgba(220,38,38,0.2)");
	const redErrorColor = useColorModeValue("red.900", "red.200");
	const orangeErrorBg = useColorModeValue("orange.50", "rgba(234,88,12,0.08)");
	const orangeErrorBorder = useColorModeValue("orange.200", "rgba(234,88,12,0.2)");
	const orangeErrorColor = useColorModeValue("orange.900", "orange.200");

	if (!systemData) {
		return (
			<Flex justify="center" align="center" minH="60vh" w="full">
				<VStack spacing={4}>
					<Spinner size="lg" color="panel.accent" thickness="2px" speed="0.8s" />
					<Text fontSize="13px" color="panel.textMuted">{t("loading")}</Text>
				</VStack>
			</Flex>
		);
	}

	const activePercent =
		systemData.total_user > 0
			? `${((systemData.users_active / systemData.total_user) * 100).toFixed(1)}%`
			: "0.0%";
	const onlinePercent =
		systemData.total_user > 0
			? `${((systemData.online_users / systemData.total_user) * 100).toFixed(1)}%`
			: "0.0%";

	const myTotalUsers = myUsersData?.total ?? systemData.personal_usage?.total_users ?? 0;
	const myActiveUsers = myUsersData?.active_total ?? myUsersData?.status_breakdown?.active ?? myTotalUsers;
	const myOnlineUsers = myUsersData?.online_total ?? 0;

	const myActivePercent =
		myTotalUsers > 0
			? `${((myActiveUsers / myTotalUsers) * 100).toFixed(1)}%`
			: "0.0%";
	const myOnlinePercent =
		myTotalUsers > 0
			? `${((myOnlineUsers / myTotalUsers) * 100).toFixed(1)}%`
			: "0.0%";

	const myUsageLabel =
		systemData.personal_usage?.traffic_basis === "created_traffic"
			? t("dashboard.currentCreatedTraffic")
			: t("dashboard.currentUserUsage");

	const panelInfo = maintenanceInfo?.panel;
	const exactVersion =
		panelInfo?.tag ||
		panelInfo?.update?.current ||
		(systemData.channel?.toLowerCase() === "dev" ? "dev" : systemData.version) ||
		"-";

	return (
		<Stack
			spacing={{ base: 4, md: 5 }}
			w="full"
			dir={isRTL ? "rtl" : "ltr"}
			{...props}
		>
			<Flex align="center" justify="space-between" flexWrap="wrap" gap={3} px={1}>
				<VStack align="flex-start" spacing={1}>
					<Text fontSize={{ base: "18px", md: "20px" }} fontWeight="700" color="panel.text" letterSpacing="-0.02em">
						{t("systemOverview")}
					</Text>
					<HStack spacing={2} align="center">
						<Box
							w="6px"
							h="6px"
							borderRadius="full"
							bg={systemData.xray_running ? "#22c55e" : "#ef4444"}
							sx={{
								animation: systemData.xray_running ? "livePulse 2.4s ease-in-out infinite" : "none",
								"@keyframes livePulse": {
									"0%,100%": { opacity: 0.5 },
									"50%": { opacity: 1 },
								},
							}}
						/>
						<Text fontSize="12px" color="panel.textMuted" fontWeight="500">
							{systemData.xray_running ? t("status.running") : t("status.stopped")}
						</Text>
						{exactVersion && exactVersion !== "-" && (
							<Text fontSize="12px" color="panel.textMuted" fontWeight="500" dir="ltr">
								· {exactVersion}
							</Text>
						)}
					</HStack>
				</VStack>
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

			{(systemData.last_xray_error || systemData.last_telegram_error) && (
				<Stack spacing={3}>
					{systemData.last_xray_error && (
						<Box p={4} borderRadius="14px" bg={redErrorBg} borderWidth="1px" borderColor={redErrorBorder}>
							<HStack spacing={2} mb={2} color={redErrorColor}>
								<ExclamationTriangleIcon width={15} />
								<Text fontSize="12px" fontWeight="700">
									{t("coreError")}
								</Text>
							</HStack>
							<Text fontSize="12px" fontFamily="mono" color={redErrorColor} wordBreak="break-word" lineHeight="tall" opacity={0.85}>
								{systemData.last_xray_error}
							</Text>
						</Box>
					)}
					{systemData.last_telegram_error && (
						<Box p={4} borderRadius="14px" bg={orangeErrorBg} borderWidth="1px" borderColor={orangeErrorBorder}>
							<Flex align="center" justify="space-between" mb={2} flexWrap="wrap" gap={2}>
								<HStack spacing={2} color={orangeErrorColor}>
									<ExclamationTriangleIcon width={15} />
									<Text fontSize="12px" fontWeight="700">{t("telegramError")}</Text>
								</HStack>
								<Button
									size="xs"
									colorScheme="orange"
									variant="ghost"
									borderRadius="full"
									fontSize="11px"
									h="22px"
									px={2.5}
									onClick={() => {
										window.location.href = "/settings";
									}}
								>
									{t("goToTelegramSettings")}
								</Button>
							</Flex>
							<Text fontSize="12px" fontFamily="mono" color={orangeErrorColor} wordBreak="break-word" lineHeight="tall" opacity={0.85}>
								{systemData.last_telegram_error}
							</Text>
						</Box>
					)}
				</Stack>
			)}

			<SectionCard
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
						_hover={{ color: "panel.text", bg: "panel.elevated" }}
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
				layout
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
								borderRadius="6px"
								fontSize="11px"
								fontWeight="600"
								variant={userTab === "all" ? "solid" : "ghost"}
								colorScheme={userTab === "all" ? "primary" : "gray"}
								color={userTab === "all" ? undefined : "panel.textMuted"}
								onClick={() => setUserTab("all")}
							>
								{t("allUsers")}
							</Button>
							<Button
								size="xs"
								h="22px"
								px={2.5}
								borderRadius="6px"
								fontSize="11px"
								fontWeight="600"
								variant={userTab === "mine" ? "solid" : "ghost"}
								colorScheme={userTab === "mine" ? "primary" : "gray"}
								color={userTab === "mine" ? undefined : "panel.textMuted"}
								onClick={() => setUserTab("mine")}
							>
								{t("myUsers")}
							</Button>
						</HStack>
					) : (
						<Text
							fontSize="12px"
							color="panel.textMuted"
							fontWeight="600"
							dir="ltr"
							sx={{ fontVariantNumeric: "tabular-nums" }}
						>
							{t("total")}: {formatNumberValue(myTotalUsers)}
						</Text>
					)
				}
			>
				<motion.div
					layout
					style={{ overflow: "hidden" }}
					transition={{
						layout: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
					}}
				>
					<AnimatePresence mode="wait" initial={false}>
						{canSeeGlobal && userTab === "all" ? (
							<motion.div
								key="all"
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								exit={{ opacity: 0 }}
								transition={{ duration: 0.25 }}
							>
								<Stack spacing={0}>
									<StatRow label={t("total")} value={systemData.total_user} tagColor="#3b82f6" />
									<StatRow label={t("status.active")} value={systemData.users_active} tag={activePercent} tagColor="#22c55e" />
									<StatRow
										label={t("onlineUsers")}
										value={systemData.online_users}
										tag={onlinePercent}
										tagColor="#06b6d4"
										helper={
											systemData.online_users_upload_speed || systemData.online_users_download_speed
												? `↑ ${formatBytes(systemData.online_users_upload_speed)}/s · ↓ ${formatBytes(systemData.online_users_download_speed)}/s`
												: undefined
										}
									/>
									{systemData.online_users_usage > 0 && (
										<StatRow
											label={t("dashboard.onlineUsersUsage")}
											value={formatBytes(systemData.online_users_usage)}
											dimLabel
										/>
									)}
									<StatRow label={t("status.on_hold")} value={systemData.users_on_hold} tagColor="#a855f7" />
									<StatRow label={t("status.limited")} value={systemData.users_limited} tagColor="#f59e0b" />
									<StatRow label={t("status.expired")} value={systemData.users_expired} tagColor="#f97316" />
								</Stack>
							</motion.div>
						) : (
							<motion.div
								key="mine"
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								exit={{ opacity: 0 }}
								transition={{ duration: 0.25 }}
							>
								<Stack spacing={0}>
									<StatRow label={t("total")} value={myTotalUsers} tagColor="#3b82f6" />
									<StatRow label={t("status.active")} value={myActiveUsers} tag={myActivePercent} tagColor="#22c55e" />
									<StatRow label={t("onlineUsers")} value={myOnlineUsers} tag={myOnlinePercent} tagColor="#06b6d4" />
									<StatRow
										label={myUsageLabel}
										value={formatBytes(systemData.personal_usage?.consumed_bytes ?? 0, 1)}
										tagColor="#a855f7"
									/>
									{systemData.personal_usage?.reset_bytes ? (
										<StatRow
											label={t("resetData")}
											value={formatBytes(systemData.personal_usage.reset_bytes, 1)}
											tagColor="#f59e0b"
										/>
									) : null}
								</Stack>
							</motion.div>
						)}
					</AnimatePresence>
				</motion.div>
			</SectionCard>

			{canSeeGlobal && systemData.admin_overview && (
				<SectionCard
					title={
						<HStack spacing={2.5}>
							<Flex w="26px" h="26px" align="center" justify="center" borderRadius="7px" bg="panel.elevated" color="panel.textSecondary">
								<ShieldCheckIcon width={14} />
							</Flex>
							<span>{t("adminOverview")}</span>
						</HStack>
					}
				>
					<Stack spacing={0}>
						<StatRow label={t("totalAdmins")} value={systemData.admin_overview.total_admins} tagColor="#3b82f6" />
						<StatRow label={t("fullAccessAdmins")} value={systemData.admin_overview.full_access_admins} tagColor="#f59e0b" />
						<StatRow label={t("sudoAdmins")} value={systemData.admin_overview.sudo_admins} tagColor="#a855f7" />
						<StatRow label={t("standardAdmins")} value={systemData.admin_overview.standard_admins} tagColor="#22c55e" />
						{systemData.admin_overview.top_admin_username && (
							<StatRow
								label={t("topAdmin")}
								value={`${systemData.admin_overview.top_admin_username} · ${formatBytes(systemData.admin_overview.top_admin_usage)}`}
								dimLabel
								accent
							/>
						)}
					</Stack>
				</SectionCard>
			)}

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
