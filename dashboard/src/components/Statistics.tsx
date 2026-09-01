import {
	Badge,
	Box,
	type BoxProps,
	Button,
	chakra,
	Flex,
	HStack,
	Icon,
	Modal,
	ModalBody,
	ModalCloseButton,
	ModalContent,
	ModalFooter,
	ModalHeader,
	ModalOverlay,
	Progress,
	SimpleGrid,
	Skeleton,
	Spinner,
	Stack,
	Text,
	Tooltip,
	useColorMode,
	useColorModeValue,
	VStack,
} from "@chakra-ui/react";
import {
	ArrowDownTrayIcon,
	ArrowTrendingUpIcon,
	ArrowUpTrayIcon,
	BoltIcon,
	ChartBarSquareIcon,
	CheckCircleIcon,
	CircleStackIcon,
	ClockIcon,
	CpuChipIcon,
	ExclamationTriangleIcon,
	ServerStackIcon,
	ShieldCheckIcon,
	SignalIcon,
	SparklesIcon,
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
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from "react";
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

export const ThemedIconBadge: FC<{
	icon: ReactNode;
	size?: { base?: number; md?: number } | number;
	variant?: "accent" | "blue" | "emerald" | "amber" | "purple" | "rose";
}> = ({ icon, size = 9, variant = "accent" }) => {
	const rawSize = typeof size === "number" ? size : (size.md ?? 9);
	const sizePx = rawSize * 4;

	const colorMap = {
		accent: {
			color: "var(--rb-panel-accent)",
			bg: "color-mix(in srgb, var(--rb-panel-accent) 12%, transparent)",
			border: "color-mix(in srgb, var(--rb-panel-accent) 24%, transparent)",
		},
		blue: {
			color: "#3b82f6",
			bg: "rgba(59, 130, 246, 0.12)",
			border: "rgba(59, 130, 246, 0.22)",
		},
		emerald: {
			color: "#10b981",
			bg: "rgba(168, 185, 129, 0.12)",
			border: "rgba(16, 185, 129, 0.22)",
		},
		amber: {
			color: "#f59e0b",
			bg: "rgba(245, 158, 11, 0.12)",
			border: "rgba(245, 158, 11, 0.22)",
		},
		purple: {
			color: "#a855f7",
			bg: "rgba(168, 85, 247, 0.12)",
			border: "rgba(168, 85, 247, 0.22)",
		},
		rose: {
			color: "#f43f5e",
			bg: "rgba(244, 63, 94, 0.12)",
			border: "rgba(244, 63, 94, 0.22)",
		},
	};

	const style = colorMap[variant] || colorMap.accent;

	return (
		<Flex
			w={`${sizePx}px`}
			h={`${sizePx}px`}
			align="center"
			justify="center"
			borderRadius={{ base: "lg", md: "xl" }}
			color={style.color}
			bg={style.bg}
			borderWidth="1px"
			borderColor={style.border}
			flexShrink={0}
			transition="all 0.25s cubic-bezier(0.16, 1, 0.3, 1)"
			_hover={{
				transform: "scale(1.05)",
			}}
		>
			{icon}
		</Flex>
	);
};

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
		<Modal isOpen={isOpen} onClose={onClose} size="2xl" scrollBehavior="inside" isCentered>
			<ModalOverlay bg="blackAlpha.600" backdropFilter="blur(8px)" />
			<ModalContent
				bg="panel.surface"
				borderWidth="1px"
				borderColor="panel.border"
				borderRadius={{ base: "xl", md: "2xl" }}
				boxShadow="0 24px 60px -12px rgba(0, 0, 0, 0.4)"
				mx={{ base: 3, sm: 4 }}
			>
				<ModalHeader
					display="flex"
					alignItems="center"
					justifyContent="space-between"
					px={{ base: 4, md: 6 }}
					py={{ base: 3.5, md: 4 }}
					borderBottomWidth="1px"
					borderColor="panel.border"
					fontSize={{ base: "sm", md: "md" }}
					fontWeight="bold"
				>
					<Text>{t("historyModalTitle", { metric: payload?.title ?? "" })}</Text>
					<ModalCloseButton position="static" />
				</ModalHeader>
				<ModalBody px={{ base: 4, md: 6 }} py={{ base: 4, md: 5 }}>
					<Stack spacing={{ base: 4, md: 5 }}>
						<Flex wrap="wrap" gap={2}>
							{HISTORY_INTERVALS.map((interval) => (
								<Button
									key={interval.seconds}
									size="xs"
									h={{ base: "26px", md: "28px" }}
									px={3}
									borderRadius="full"
									variant={intervalSeconds === interval.seconds ? "solid" : "outline"}
									colorScheme={intervalSeconds === interval.seconds ? "primary" : "gray"}
									onClick={() => onIntervalChange(interval.seconds)}
								>
									{t(interval.labelKey)}
								</Button>
							))}
						</Flex>
						<Box minH={{ base: "220px", md: "280px" }}>
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
				<ModalFooter px={{ base: 4, md: 6 }} py={3} borderTopWidth="1px" borderColor="panel.border">
					<Button onClick={onClose} borderRadius="full" variant="ghost" size="sm">
						{t("close")}
					</Button>
				</ModalFooter>
			</ModalContent>
		</Modal>
	);
};

const HardwareBentoCard: FC<{
	label: string;
	icon: ReactNode;
	primaryValue: string;
	percent: number;
	subtitle?: string;
	onViewHistory?: () => void;
	actionLabel?: string;
	isRTL?: boolean;
	variant?: "accent" | "blue" | "emerald" | "amber" | "purple" | "rose";
}> = ({
	label,
	icon,
	primaryValue,
	percent,
	subtitle,
	onViewHistory,
	actionLabel,
	isRTL,
	variant = "accent",
}) => {
	const cardBg = useColorModeValue("panel.input", "panel.input");
	const borderColor = useColorModeValue("panel.border", "panel.border");
	const safePercent = clampPercent(percent);

	const getProgressColor = (val: number) => {
		if (val >= 90) return "#ef4444";
		if (val >= 75) return "#f59e0b";
		return "var(--rb-panel-accent)";
	};

	return (
		<Box
			borderWidth="1px"
			borderColor={borderColor}
			borderRadius={{ base: "xl", md: "2xl" }}
			bg={cardBg}
			p={{ base: 3.5, sm: 4, md: 5 }}
			position="relative"
			overflow="hidden"
			display="flex"
			flexDirection="column"
			justifyContent="space-between"
			transition="all 0.22s cubic-bezier(0.16, 1, 0.3, 1)"
			_hover={{
				borderColor: "panel.borderStrong",
				bg: "panel.elevated",
				transform: "translateY(-1px)",
				boxShadow: "0 8px 24px -6px rgba(0, 0, 0, 0.25)",
			}}
		>
			<Stack spacing={{ base: 3, md: 3.5 }}>
				<Flex justify="space-between" align="center" minH="28px">
					<HStack spacing={{ base: 2, md: 2.5 }} minW={0}>
						<ThemedIconBadge icon={icon} size={{ base: 7.5, md: 8.5 }} variant={variant} />
						<Text
							fontSize={{ base: "xs", sm: "13px" }}
							fontWeight="700"
							color="panel.textSecondary"
							noOfLines={1}
						>
							{label}
						</Text>
					</HStack>
					{onViewHistory && (
						<Button
							size="xs"
							h="24px"
							px={2}
							fontSize="11px"
							variant="ghost"
							borderRadius="full"
							color="panel.textMuted"
							_hover={{ color: "panel.text", bg: "panel.surface" }}
							onClick={onViewHistory}
							flexShrink={0}
						>
							{actionLabel ?? "تاریخچه"}
						</Button>
					)}
				</Flex>

				<Flex justify="space-between" align="baseline" gap={2} flexWrap="nowrap">
					<Text
						fontSize={{ base: "lg", sm: "xl", md: "22px" }}
						fontWeight="800"
						lineHeight="1.2"
						color="panel.text"
						dir="ltr"
						sx={{ fontVariantNumeric: "tabular-nums", unicodeBidi: "isolate" }}
						noOfLines={1}
					>
						{primaryValue}
					</Text>
					{subtitle && (
						<Text
							fontSize={{ base: "11px", sm: "xs" }}
							fontWeight="700"
							color="panel.textMuted"
							dir={isRTL ? "rtl" : "ltr"}
							flexShrink={0}
						>
							{subtitle}
						</Text>
					)}
				</Flex>

				<Box position="relative">
					<Progress
						value={safePercent}
						size="xs"
						bg="panel.elevated"
						borderRadius="full"
						h="4px"
						sx={{
							"& > div": {
								backgroundColor: getProgressColor(safePercent),
								transition: "width 0.4s ease, background-color 0.4s ease",
							},
						}}
					/>
				</Box>
			</Stack>
		</Box>
	);
};

const ResponsiveInnerCard: FC<{
	icon: ReactNode;
	label: string;
	value: string;
	dir?: "ltr" | "rtl";
	variant?: "accent" | "blue" | "emerald" | "amber" | "purple" | "rose";
}> = ({ icon, label, value, dir, variant = "accent" }) => (
	<Box
		p={{ base: 3, sm: 3.5 }}
		borderRadius={{ base: "lg", md: "xl" }}
		bg="panel.elevated"
		borderWidth="1px"
		borderColor="panel.border"
		transition="all 0.2s ease"
		_hover={{ borderColor: "panel.borderStrong" }}
	>
		<HStack spacing={2} mb={1.5} align="center">
			<ThemedIconBadge icon={icon} size={6.5} variant={variant} />
			<Text
				fontSize={{ base: "11px", sm: "xs" }}
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
			fontSize={{ base: "13px", sm: "sm", md: "md" }}
			fontWeight="800"
			color="panel.text"
			dir={dir}
			sx={{ fontVariantNumeric: "tabular-nums" }}
			noOfLines={1}
		>
			{value}
		</Text>
	</Box>
);

const MetricCell: FC<{
	label: string;
	value: number | string;
	percentage?: string;
	dotColor?: string;
	icon?: ReactNode;
}> = ({ label, value, percentage, dotColor, icon }) => {
	const cardBg = useColorModeValue("panel.input", "panel.input");
	const borderColor = useColorModeValue("panel.border", "panel.border");

	return (
		<Flex
			p={{ base: 3, sm: 3.5, md: 4 }}
			borderRadius={{ base: "lg", md: "xl" }}
			bg={cardBg}
			borderWidth="1px"
			borderColor={borderColor}
			justify="space-between"
			align="center"
			gap={2}
			transition="all 0.2s ease"
			_hover={{
				borderColor: "panel.borderStrong",
				bg: "panel.elevated",
				transform: "translateY(-1px)",
			}}
		>
			<HStack spacing={2.5} minW={0}>
				{icon ? (
					<Box flexShrink={0}>{icon}</Box>
				) : dotColor ? (
					<Box
						w="7px"
						h="7px"
						borderRadius="full"
						bg={dotColor}
						flexShrink={0}
						boxShadow={`0 0 8px ${dotColor}88`}
					/>
				) : null}
				<Text
					fontSize={{ base: "xs", sm: "13px" }}
					fontWeight="700"
					color="panel.textSecondary"
					noOfLines={1}
				>
					{label}
				</Text>
			</HStack>

			<HStack spacing={2} flexShrink={0}>
				{percentage && (
					<Text fontSize="11px" fontWeight="600" color="panel.textMuted" dir="ltr">
						{percentage}
					</Text>
				)}
				<Text
					fontSize={{ base: "sm", sm: "15px", md: "md" }}
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

	const redErrorBg = useColorModeValue("red.50", "rgba(220, 38, 38, 0.12)");
	const redErrorBorder = useColorModeValue("red.200", "rgba(220, 38, 38, 0.3)");
	const redErrorColor = useColorModeValue("red.900", "red.100");
	const redErrorHeader = useColorModeValue("red.600", "red.300");

	const orangeErrorBg = useColorModeValue("orange.50", "rgba(234, 88, 12, 0.12)");
	const orangeErrorBorder = useColorModeValue("orange.200", "rgba(234, 88, 12, 0.3)");
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
			<Flex justify="center" align="center" minH="320px" w="full">
				<VStack spacing={3}>
					<Spinner size="lg" color="panel.accent" thickness="3px" speed="0.7s" />
					<Text fontSize="xs" color="panel.textMuted">
						{t("loading", "در حال بارگذاری...")}
					</Text>
				</VStack>
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
		<Stack
			spacing={{ base: 4, md: 5 }}
			w="full"
			dir={isRTL ? "rtl" : "ltr"}
			{...props}
		>
			<ChartBox
				title={
					<HStack spacing={2.5} align="center">
						<ThemedIconBadge icon={<SparklesIcon width={17} />} size={{ base: 7.5, md: 8 }} />
						<Text fontWeight="800" fontSize={{ base: "sm", sm: "md", md: "lg" }} color="panel.text">
							{t("systemOverview")}
						</Text>
					</HStack>
				}
				headerActions={
					<DashboardMaintenanceControls
						channel={systemData.channel}
						version={systemData.version}
					/>
				}
			>
				<Stack spacing={{ base: 4, md: 5 }}>
					<SimpleGrid columns={{ base: 1, sm: 2, "2xl": 4 }} gap={{ base: 3, md: 4 }}>
						<HardwareBentoCard
							label={t("cpuUsage")}
							icon={<CpuChipIcon width={17} />}
							primaryValue={`${systemData.cpu_usage.toFixed(1)}%`}
							percent={systemData.cpu_usage}
							subtitle={cpuSubtitle}
							actionLabel={t("viewHistory")}
							isRTL={isRTL}
							variant="accent"
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
							icon={<ServerStackIcon width={17} />}
							primaryValue={`${formatBytes(systemData.memory.current, 1)} / ${formatBytes(systemData.memory.total, 1)}`}
							percent={systemData.memory.percent}
							subtitle={`${systemData.memory.percent.toFixed(1)}%`}
							actionLabel={t("viewHistory")}
							isRTL={isRTL}
							variant="blue"
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
							icon={<CircleStackIcon width={17} />}
							primaryValue={`${formatBytes(systemData.swap.current, 1)} / ${formatBytes(systemData.swap.total, 1)}`}
							percent={systemData.swap.percent}
							subtitle={`${systemData.swap.percent.toFixed(1)}%`}
							isRTL={isRTL}
							variant="purple"
						/>
						<HardwareBentoCard
							label={t("diskUsage")}
							icon={<CircleStackIcon width={17} />}
							primaryValue={`${formatBytes(systemData.disk.current, 1)} / ${formatBytes(systemData.disk.total, 1)}`}
							percent={systemData.disk.percent}
							subtitle={`${systemData.disk.percent.toFixed(1)}%`}
							isRTL={isRTL}
							variant="amber"
						/>
					</SimpleGrid>

					<SimpleGrid columns={{ base: 1, md: 2 }} gap={{ base: 3, md: 4 }}>
						<Box
							p={{ base: 3.5, sm: 4, md: 5 }}
							borderRadius={{ base: "xl", md: "2xl" }}
							bg="panel.input"
							borderWidth="1px"
							borderColor="panel.border"
							display="flex"
							flexDirection="column"
							justifyContent="space-between"
							transition="all 0.22s cubic-bezier(0.16, 1, 0.3, 1)"
							_hover={{
								borderColor: "panel.borderStrong",
								bg: "panel.elevated",
								boxShadow: "0 8px 24px -6px rgba(0, 0, 0, 0.25)",
							}}
						>
							<Flex justify="space-between" align="center" mb={{ base: 3, md: 3.5 }} flexWrap="wrap" gap={2}>
								<HStack spacing={2.5}>
									<ThemedIconBadge icon={<SignalIcon width={17} />} size={{ base: 7.5, md: 8.5 }} variant="emerald" />
									<Text fontSize={{ base: "xs", sm: "sm" }} fontWeight="700" color="panel.text">
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

							<SimpleGrid columns={{ base: 1, sm: 2 }} gap={{ base: 2.5, sm: 3 }}>
								<ResponsiveInnerCard
									icon={<ArrowDownTrayIcon width={15} />}
									label={t("incomingSpeed")}
									value={`${formatBytes(systemData.incoming_bandwidth_speed)}/s`}
									dir="ltr"
									variant="blue"
								/>
								<ResponsiveInnerCard
									icon={<ArrowUpTrayIcon width={15} />}
									label={t("outgoingSpeed")}
									value={`${formatBytes(systemData.outgoing_bandwidth_speed)}/s`}
									dir="ltr"
									variant="emerald"
								/>
							</SimpleGrid>
						</Box>

						<Box
							p={{ base: 3.5, sm: 4, md: 5 }}
							borderRadius={{ base: "xl", md: "2xl" }}
							bg="panel.input"
							borderWidth="1px"
							borderColor="panel.border"
							display="flex"
							flexDirection="column"
							justifyContent="space-between"
							transition="all 0.22s cubic-bezier(0.16, 1, 0.3, 1)"
							_hover={{
								borderColor: "panel.borderStrong",
								bg: "panel.elevated",
								boxShadow: "0 8px 24px -6px rgba(0, 0, 0, 0.25)",
							}}
						>
							<Flex justify="space-between" align="center" mb={{ base: 3, md: 3.5 }}>
								<HStack spacing={2.5}>
									<ThemedIconBadge icon={<ClockIcon width={17} />} size={{ base: 7.5, md: 8.5 }} variant="purple" />
									<Text fontSize={{ base: "xs", sm: "sm" }} fontWeight="700" color="panel.text">
										{t("uptime")}
									</Text>
								</HStack>
							</Flex>

							<SimpleGrid columns={{ base: 1, sm: 2 }} gap={{ base: 2.5, sm: 3 }}>
								<ResponsiveInnerCard
									icon={<ServerStackIcon width={15} />}
									label={t("systemUptime")}
									value={formatLocalizedDuration(systemData.uptime_seconds, t, isRTL)}
									dir={isRTL ? "rtl" : "ltr"}
									variant="purple"
								/>
								<ResponsiveInnerCard
									icon={<CircleStackIcon width={15} />}
									label={t("panelUptime")}
									value={formatLocalizedDuration(systemData.panel_uptime_seconds, t, isRTL)}
									dir={isRTL ? "rtl" : "ltr"}
									variant="accent"
								/>
							</SimpleGrid>
						</Box>
					</SimpleGrid>

					{systemData.last_xray_error && (
						<Box
							p={3.5}
							borderRadius={{ base: "lg", md: "xl" }}
							bg={redErrorBg}
							borderWidth="1px"
							borderColor={redErrorBorder}
							color={redErrorColor}
							boxShadow="sm"
						>
							<HStack spacing={2} mb={1.5} color={redErrorHeader}>
								<ExclamationTriangleIcon width={17} />
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
							p={3.5}
							borderRadius={{ base: "lg", md: "xl" }}
							bg={orangeErrorBg}
							borderWidth="1px"
							borderColor={orangeErrorBorder}
							color={orangeErrorColor}
							boxShadow="sm"
						>
							<HStack spacing={2} mb={2} align="center" justify="space-between" flexWrap="wrap" gap={2}>
								<HStack spacing={2} color={orangeErrorHeader}>
									<ExclamationTriangleIcon width={17} />
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

			<ChartBox
				title={
					<HStack spacing={{ base: 2, md: 3 }} align="center" flexWrap="wrap">
						<ThemedIconBadge icon={<BoltIcon width={17} />} size={{ base: 7.5, md: 8 }} variant="accent" />
						<Text fontWeight="800" fontSize={{ base: "sm", sm: "md", md: "lg" }} color="panel.text">
							{t("panelUsage")}
						</Text>
						<Badge
							colorScheme={systemData.xray_running ? "green" : "red"}
							borderRadius="full"
							px={{ base: 2.5, md: 3 }}
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
										? "0 0 8px rgba(74, 222, 128, 0.9)"
										: "0 0 8px rgba(248, 113, 113, 0.9)"
								}
								sx={{
									animation: systemData.xray_running ? "pulse 2s infinite ease-in-out" : "none",
									"@keyframes pulse": {
										"0%": { opacity: 0.6, transform: "scale(0.95)" },
										"50%": { opacity: 1, transform: "scale(1.15)" },
										"100%": { opacity: 0.6, transform: "scale(0.95)" },
									},
								}}
							/>
							{systemData.xray_running ? t("status.running") : t("status.stopped")}
						</Badge>
					</HStack>
				}
			>
				<SimpleGrid columns={{ base: 1, md: 2 }} gap={{ base: 3, md: 4 }}>
					<HardwareBentoCard
						label={`${t("cpuUsage")} (Panel Process)`}
						icon={<CpuChipIcon width={17} />}
						primaryValue={`${systemData.panel_cpu_percent.toFixed(1)}%`}
						percent={systemData.panel_cpu_percent}
						subtitle={panelCpuSubtitle}
						actionLabel={t("viewHistory")}
						isRTL={isRTL}
						variant="accent"
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
						icon={<ServerStackIcon width={17} />}
						primaryValue={`${formatBytes(systemData.app_memory, 1)} / ${formatBytes(systemData.memory.total, 1)}`}
						percent={systemData.panel_memory_percent}
						subtitle={`${systemData.panel_memory_percent.toFixed(1)}%`}
						actionLabel={t("viewHistory")}
						isRTL={isRTL}
						variant="blue"
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

			<ChartBox
				title={
					<HStack spacing={2.5}>
						<ThemedIconBadge icon={<UserGroupIcon width={17} />} size={{ base: 7.5, md: 8 }} variant="blue" />
						<Text fontWeight="800" fontSize={{ base: "sm", sm: "md", md: "lg" }} color="panel.text">
							{t("usersOverview")}
						</Text>
					</HStack>
				}
				headerActions={
					canSeeGlobal ? (
						<HStack spacing={1} bg="panel.input" p={0.5} borderRadius="lg" borderWidth="1px" borderColor="panel.border">
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
						"@keyframes softFadeIn": {
							from: { opacity: 0.4, transform: "translateY(2px)" },
							to: { opacity: 1, transform: "translateY(0)" },
						},
						animation: "softFadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
					}}
				>
					{canSeeGlobal && userTab === "all" ? (
						<SimpleGrid columns={{ base: 1, sm: 2, lg: 3, "2xl": 6 }} gap={{ base: 2.5, md: 3.5 }}>
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
						<SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} gap={{ base: 2.5, md: 3.5 }}>
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

			{canSeeGlobal && systemData.admin_overview && (
				<ChartBox
					title={
						<HStack spacing={2.5}>
							<ThemedIconBadge icon={<ShieldCheckIcon width={17} />} size={{ base: 7.5, md: 8 }} variant="purple" />
							<Text fontWeight="800" fontSize={{ base: "sm", sm: "md", md: "lg" }} color="panel.text">
								{t("adminOverview")}
							</Text>
						</HStack>
					}
				>
					<Stack spacing={{ base: 3, md: 4 }}>
						<SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} gap={{ base: 2.5, md: 3.5 }}>
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
								p={{ base: 3, sm: 3.5 }}
								borderRadius={{ base: "lg", md: "xl" }}
								bg="panel.input"
								borderWidth="1px"
								borderColor="panel.border"
								justify="space-between"
								align="center"
								fontSize="xs"
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
