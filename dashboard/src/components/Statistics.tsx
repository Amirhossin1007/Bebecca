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
	CubeIcon,
	ServerStackIcon,
	SignalIcon,
	UserGroupIcon,
	UsersIcon,
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
import { formatDuration } from "utils/formatDuration";
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
	if (!value) {
		return undefined;
	}

	return {
		...value,
		cpu_percent: toFiniteNumber(value.cpu_percent),
		cpu_cores: toFiniteNumber(value.cpu_cores),
		cpu_threads: toFiniteNumber(value.cpu_threads),
		cpu_history: safeHistory(value.cpu_history),
		memory: safeUsageStats(value.memory),
		memory_history: safeHistory(value.memory_history),
		disk: safeUsageStats(value.disk),
		incoming_bandwidth_speed: toFiniteNumber(value.incoming_bandwidth_speed),
		outgoing_bandwidth_speed: toFiniteNumber(value.outgoing_bandwidth_speed),
		network_history: safeNetworkHistory(value.network_history),
		panel_cpu_percent: toFiniteNumber(value.panel_cpu_percent),
		panel_memory_percent: toFiniteNumber(value.panel_memory_percent),
		panel_cpu_history: safeHistory(value.panel_cpu_history),
		panel_memory_history: safeHistory(value.panel_memory_history),
		app_memory: toFiniteNumber(value.app_memory),
		app_threads: toFiniteNumber(value.app_threads),
		uptime_seconds: toFiniteNumber(value.uptime_seconds),
		panel_uptime_seconds: toFiniteNumber(value.panel_uptime_seconds),
	};
};

const useGetStatistics = () => {
	const { systemMetricsInterval } = useDashboard();
	const { data: userData } = useGetUser();
	const isAdmin = userData?.role === AdminRole.admin;

	const { data, ...rest } = useQuery<SystemStats>(
		[StatisticsQueryKey, isAdmin],
		async () => {
			const res = await fetch<SystemStats>({
				url: "/system",
				params: {
					user_id: !isAdmin ? userData?.id : undefined,
				},
			});
			return res.data;
		},
		{
			refetchInterval:
				systemMetricsInterval > 0 ? systemMetricsInterval * 1000 : false,
			refetchOnWindowFocus: false,
		},
	);

	return {
		...rest,
		data: useMemo(() => sanitizeSystemStats(data), [data]),
	};
};

const useGetMyUsersStats = (username: string | undefined, enabled: boolean) =>
	useQuery(
		["my-users-stats", username],
		async () => {
			if (!username) return null;
			const res = await fetch<{
				total?: number;
				active?: number;
				users?: Array<{ status?: string; online_at?: number | null; used_traffic?: number }>;
			}>({
				url: `/users?admin=${encodeURIComponent(username)}`,
			});
			const list = res.data?.users ?? [];
			const total = res.data?.total ?? list.length;
			const active =
				res.data?.active ??
				list.filter((u) => u.status === "active" || !u.status).length;
			const now = Math.floor(Date.now() / 1000);
			const online = list.filter(
				(u) => u.online_at && now - u.online_at < 300,
			).length;
			const totalTraffic = list.reduce(
				(sum, u) => sum + (Number(u.used_traffic) || 0),
				0,
			);
			return { total, active, online, totalTraffic };
		},
		{
			enabled: enabled && Boolean(username),
			refetchInterval: 10000,
			refetchOnWindowFocus: false,
		},
	);

const clampPercent = (val: number) => {
	if (!Number.isFinite(val)) return 0;
	return Math.min(100, Math.max(0, val));
};

const formatNumberValue = (value: number | string | undefined | null) => {
	if (value === undefined || value === null) return "0";
	if (typeof value === "number") {
		return Number.isFinite(value) ? numberWithCommas(value) : "0";
	}
	return String(value);
};

interface DurationPart {
	unit: string;
	value: number;
}

const formatDurationParts = (seconds: number, t: TFunction): DurationPart[] => {
	if (!seconds || seconds <= 0) {
		return [{ unit: t("second"), value: 0 }];
	}

	const days = Math.floor(seconds / 86400);
	const hours = Math.floor((seconds % 86400) / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const remSeconds = Math.floor(seconds % 60);

	const parts: DurationPart[] = [];
	if (days > 0) parts.push({ unit: t("day"), value: days });
	if (hours > 0) parts.push({ unit: t("hour"), value: hours });
	if (minutes > 0) parts.push({ unit: t("minute"), value: minutes });
	if (remSeconds > 0 || parts.length === 0) {
		parts.push({ unit: t("second"), value: remSeconds });
	}

	return parts;
};

const formatLocalizedDuration = (
	seconds: number,
	t: TFunction,
	isRTL = false,
): ReactNode => {
	const parts = formatDurationParts(seconds, t);
	const andWord = t("common.and");
	const commaWord = t("common.comma");

	if (isRTL) {
		return (
			<Flex
				as="span"
				align="center"
				justify="flex-start"
				wrap="wrap"
				gap={1}
				dir="rtl"
				sx={{ unicodeBidi: "isolate" }}
			>
				{parts.map((part, idx) => (
					<Flex as="span" align="center" key={`${part.unit}-${part.value}`} gap={1}>
						{idx > 0 && (
							<Text as="span" color="panel.textMuted" fontSize="inherit" px={0.5}>
								{idx === parts.length - 1 ? andWord : commaWord}
							</Text>
						)}
						<Text
							as="span"
							color="panel.text"
							fontWeight="700"
							fontSize="inherit"
							dir="ltr"
							sx={{ unicodeBidi: "isolate", fontVariantNumeric: "tabular-nums" }}
						>
							{part.value}
						</Text>
						<Text as="span" color="panel.textSecondary" fontSize="inherit">
							{part.unit}
						</Text>
					</Flex>
				))}
			</Flex>
		);
	}

	return formatDuration(seconds, t);
};

const HISTORY_INTERVALS = [
	{ seconds: 120, labelKey: "intervals.2m" },
	{ seconds: 600, labelKey: "intervals.10m" },
	{ seconds: 1800, labelKey: "intervals.30m" },
	{ seconds: 3600, labelKey: "intervals.1h" },
	{ seconds: 10800, labelKey: "intervals.3h" },
	{ seconds: 18000, labelKey: "intervals.5h" },
] as const;

interface HistoryModalPayload {
	title: string;
	metricLabel?: string;
	type?: "generic" | "network" | "panel";
	unit?: string;
	entries?: SystemStats["cpu_history"];
	cpuEntries?: SystemStats["cpu_history"];
	memoryEntries?: SystemStats["memory_history"];
	networkEntries?: SystemStats["network_history"];
}

interface HistoryModalProps {
	isOpen: boolean;
	onClose: () => void;
	payload: HistoryModalPayload | null;
	intervalSeconds: number;
	onIntervalChange: (seconds: number) => void;
}

const HistoryModal: FC<HistoryModalProps> = ({
	isOpen,
	onClose,
	payload,
	intervalSeconds,
	onIntervalChange,
}) => {
	const { t } = useTranslation();
	const { colorMode } = useColorMode();
	const gridColor = useColorModeValue("rgba(0, 0, 0, 0.06)", "rgba(255, 255, 255, 0.06)");
	const mutedTextColor = useColorModeValue("#64748b", "#94a3b8");

	const { latestTimestamp, availableSpan } = useMemo(() => {
		if (!payload) return { latestTimestamp: Math.floor(Date.now() / 1000), availableSpan: 120 };
		const timestamps: number[] = [];
		if (payload.entries) timestamps.push(...payload.entries.map((e) => e.timestamp));
		if (payload.cpuEntries) timestamps.push(...payload.cpuEntries.map((e) => e.timestamp));
		if (payload.memoryEntries) timestamps.push(...payload.memoryEntries.map((e) => e.timestamp));
		if (payload.networkEntries) timestamps.push(...payload.networkEntries.map((e) => e.timestamp));

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
			const finalData = filtered.length >= 2 ? filtered : payload.networkEntries;
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
			const finalCpu = filteredCpu.length >= 2 ? filteredCpu : payload.cpuEntries || [];
			const finalMem = filteredMem.length >= 2 ? filteredMem : payload.memoryEntries || [];
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
			const finalEntries = filtered.length >= 2 ? filtered : payload.entries;
			return [
				{
					name: payload.metricLabel ?? payload.title,
					data: finalEntries.map((e) => [e.timestamp * 1000, e.value]),
				},
			];
		}
		return [];
	}, [payload, cutoff, t]);

	const isNetwork = payload?.type === "network";
	const isPercentage = !isNetwork;

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
			colors: isNetwork
				? ["#3b82f6", "#10b981"]
				: ["var(--rb-panel-accent)", "#8b5cf6", "#f59e0b", "#ec4899"],
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
					datetimeUTC: false,
					format: intervalSeconds <= 1800 ? "HH:mm:ss" : "HH:mm",
				},
			},
			yaxis: {
				min: 0,
				max: isPercentage ? 100 : undefined,
				forceNiceScale: !isPercentage,
				labels: {
					style: { colors: mutedTextColor, fontSize: "11px", fontFamily: "inherit" },
					formatter: (val: number) => {
						if (!Number.isFinite(val)) return "0";
						if (isNetwork) {
							return formatBytes(val, 1);
						}
						return `${val.toFixed(0)}%`;
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
						if (isNetwork) {
							return `${formatBytes(val, 2)}/s`;
						}
						return `${val.toFixed(1)}%`;
					},
				},
			},
		}),
		[colorMode, gridColor, mutedTextColor, intervalSeconds, isNetwork, isPercentage],
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
						<Box minH="280px" w="100%">
							<Suspense
								fallback={
									<Flex h="280px" align="center" justify="center">
										<Spinner size="md" color="panel.accent" />
									</Flex>
								}
							>
								{chartSeries.length > 0 && isOpen && (
									<HistoryChart
										key={`${payload?.title}-${intervalSeconds}-${colorMode}`}
										options={options}
										series={chartSeries}
										type="area"
										height={280}
										width="100%"
									/>
								)}
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
									sx={{ unicodeBidi: "isolate" }}
								>
									<Text
										fontSize="13px"
										fontWeight="600"
										color="panel.textMuted"
										dir="ltr"
										sx={{ fontVariantNumeric: "tabular-nums", unicodeBidi: "isolate" }}
									>
										{metaValue}
									</Text>
									<Text fontSize="12px" fontWeight="600" color="panel.textMuted">
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
						{safe.toFixed(0)}%
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
							transition: "width 0.6s ease, background-color 0.4s ease",
							borderRadius: "full",
						},
					}}
				/>
			</Box>
		</Box>
	);
};

const SpeedItem: FC<{ icon: ReactNode; label: string; value: string }> = ({
	icon,
	label,
	value,
}) => (
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
			letterSpacing="-0.01em"
			dir="ltr"
			sx={{ fontVariantNumeric: "tabular-nums", unicodeBidi: "isolate" }}
		>
			{value}
		</Text>
	</Flex>
);

const UserStatRow: FC<{
	label: string;
	value: string | number;
	color?: string;
	isRTL?: boolean;
}> = ({ label, value, color, isRTL = false }) => {
	const textVal = formatNumberValue(value);

	return (
		<Flex align="center" justify="space-between" py={2}>
			<Text fontSize="13px" fontWeight="500" color="panel.textSecondary">
				{label}
			</Text>
			<Box
				display="inline-flex"
				alignItems="center"
				justifyContent={isRTL ? "flex-start" : "flex-end"}
				dir={isRTL ? "rtl" : "ltr"}
				sx={{ unicodeBidi: "isolate" }}
			>
				<Text
					fontSize="14px"
					fontWeight="700"
					color={color ?? "panel.text"}
					letterSpacing="-0.01em"
					dir="ltr"
					sx={{ unicodeBidi: "isolate", fontVariantNumeric: "tabular-nums" }}
				>
					{textVal}
				</Text>
			</Box>
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
	const isRTL = i18n.language === "fa" || i18n.dir?.() === "rtl";
	const { data: userData } = useGetUser();
	const isAdmin = userData?.role === AdminRole.admin;
	const isSudo = userData?.role === AdminRole.sudo;
	const canSeeGlobal = isAdmin || isSudo;

	const [activeUserTab, setActiveUserTab] = useState<"all" | "mine">("all");
	const [historyModalPayload, setHistoryModalPayload] =
		useState<HistoryModalPayload | null>(null);
	const [historyInterval, setHistoryInterval] = useState<number>(120);

	const { data: systemData, isLoading, error } = useGetStatistics();
	useSystemMetricsStream(Boolean(systemData));

	const { data: myUsersData } = useGetMyUsersStats(
		userData?.username,
		activeUserTab === "mine",
	);

	const onlineUsersRatio = useMemo(() => {
		if (!systemData?.online_users || !systemData.users?.active) return 0;
		return (systemData.online_users / systemData.users.active) * 100;
	}, [systemData]);

	const redErrorBg = useColorModeValue("red.50", "rgba(239, 68, 68, 0.1)");
	const redErrorBorder = useColorModeValue("red.200", "rgba(239, 68, 68, 0.25)");
	const orangeErrorBg = useColorModeValue("orange.50", "rgba(245, 158, 11, 0.1)");
	const orangeErrorBorder = useColorModeValue("orange.200", "rgba(245, 158, 11, 0.25)");

	const openHistory = (payload: HistoryModalPayload) => {
		setHistoryModalPayload(payload);
		setHistoryInterval(120);
	};

	if (isLoading) {
		return (
			<Box {...props}>
				<SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} gap={{ base: 3, md: 4 }}>
					{[1, 2, 3, 4].map((item) => (
						<Box
							key={item}
							bg="panel.surface"
							borderWidth="1px"
							borderColor="panel.border"
							borderRadius="20px"
							p={5}
							minH="140px"
							display="flex"
							alignItems="center"
							justifyContent="center"
						>
							<Spinner size="md" color="panel.accent" />
						</Box>
					))}
				</SimpleGrid>
			</Box>
		);
	}

	if (error || !systemData) {
		return (
			<Box {...props}>
				<Box
					bg="panel.surface"
					borderWidth="1px"
					borderColor="panel.border"
					borderRadius="20px"
					p={8}
					textAlign="center"
				>
					<Text color="panel.textMuted">{t("errorLoadingData")}</Text>
				</Box>
			</Box>
		);
	}

	return (
		<Stack spacing={{ base: 4, md: 5 }} {...props}>
			<DashboardMaintenanceControls />

			<SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} gap={{ base: 3, md: 4 }}>
				<ResourceCard
					label={t("cpuUsage")}
					icon={<CpuChipIcon width={16} />}
					value={`${systemData.cpu_percent.toFixed(1)}%`}
					percent={systemData.cpu_percent}
					metaValue={formatNumberValue(systemData.cpu_threads)}
					metaUnit={t("thread")}
					historyLabel={t("viewHistory")}
					onHistory={() =>
						openHistory({
							type: "generic",
							title: t("cpuUsage"),
							entries: systemData.cpu_history,
						})
					}
					isRTL={isRTL}
				/>
				<ResourceCard
					label={t("memoryUsage")}
					icon={<ServerStackIcon width={16} />}
					value={formatBytes(systemData.memory.current, 1)}
					totalValue={formatBytes(systemData.memory.total, 1)}
					percent={systemData.memory.percent}
					historyLabel={t("viewHistory")}
					onHistory={() =>
						openHistory({
							type: "generic",
							title: t("memoryUsage"),
							entries: systemData.memory_history,
						})
					}
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
				<ResourceCard
					label={t("nodes.runtime")}
					icon={<CubeIcon width={16} />}
					value={systemData.version || "Rebecca"}
					percent={100}
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
									title: t("bandwidthSpeed"),
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

			{systemData.warning && (
				<Stack spacing={3}>
					{systemData.warning.critical?.length > 0 && (
						<Box p={4} borderRadius="14px" bg={redErrorBg} borderWidth="1px" borderColor={redErrorBorder}>
							<Text color="red.400" fontSize="13px" fontWeight="600">
								{systemData.warning.critical.join(" · ")}
							</Text>
						</Box>
					)}
					{systemData.warning.warn?.length > 0 && (
						<Box p={4} borderRadius="14px" bg={orangeErrorBg} borderWidth="1px" borderColor={orangeErrorBorder}>
							<Text color="orange.400" fontSize="13px" fontWeight="600">
								{systemData.warning.warn.join(" · ")}
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
								variant="ghost"
								borderRadius="6px"
								bg={activeUserTab === "all" ? "panel.surface" : "transparent"}
								color={activeUserTab === "all" ? "panel.text" : "panel.textMuted"}
								boxShadow={activeUserTab === "all" ? "0 1px 2px rgba(0,0,0,0.12)" : "none"}
								fontWeight={activeUserTab === "all" ? "600" : "500"}
								onClick={() => setActiveUserTab("all")}
							>
								{t("allUsers")}
							</Button>
							<Button
								size="xs"
								h="22px"
								px={2.5}
								fontSize="11px"
								variant="ghost"
								borderRadius="6px"
								bg={activeUserTab === "mine" ? "panel.surface" : "transparent"}
								color={activeUserTab === "mine" ? "panel.text" : "panel.textMuted"}
								boxShadow={activeUserTab === "mine" ? "0 1px 2px rgba(0,0,0,0.12)" : "none"}
								fontWeight={activeUserTab === "mine" ? "600" : "500"}
								onClick={() => setActiveUserTab("mine")}
							>
								{t("myUsers")}
							</Button>
						</HStack>
					) : undefined
				}
			>
				<AnimatedHeightWrapper activeKey={activeUserTab}>
					{activeUserTab === "all" ? (
						<Stack spacing={1}>
							<UserStatRow label={t("totalUsers")} value={systemData.users?.total ?? 0} isRTL={isRTL} />
							<UserStatRow label={t("activeUsers")} value={systemData.users?.active ?? 0} color="green.400" isRTL={isRTL} />
							<UserStatRow label={t("disabledUsers")} value={systemData.users?.disabled ?? 0} color="gray.400" isRTL={isRTL} />
							<UserStatRow label={t("expiredUsers")} value={systemData.users?.expired ?? 0} color="orange.400" isRTL={isRTL} />
							<UserStatRow label={t("onHoldUsers")} value={systemData.users?.on_hold ?? 0} color="yellow.400" isRTL={isRTL} />
							<UserStatRow label={t("limitedUsers")} value={systemData.users?.limited ?? 0} color="red.400" isRTL={isRTL} />
							<UserStatRow label={t("onlineUsers")} value={systemData.online_users ?? 0} color="blue.400" isRTL={isRTL} />
							{systemData.personal_usage && (
								<UserStatRow
									label={
										systemData.personal_usage.traffic_basis === "created_traffic"
											? t("dashboard.currentCreatedTraffic")
											: t("dashboard.currentUserUsage")
									}
									value={formatBytes(systemData.personal_usage.total_used_traffic, 1)}
									isRTL={isRTL}
								/>
							)}
							{systemData.personal_usage && systemData.personal_usage.reset_traffic_used_after_reset > 0 && (
								<UserStatRow
									label={t("dashboard.currentResetTraffic")}
									value={formatBytes(systemData.personal_usage.reset_traffic_used_after_reset, 1)}
									isRTL={isRTL}
								/>
							)}
						</Stack>
					) : (
						<Stack spacing={1}>
							<UserStatRow label={t("totalUsers")} value={myUsersData?.total ?? 0} isRTL={isRTL} />
							<UserStatRow label={t("activeUsers")} value={myUsersData?.active ?? 0} color="green.400" isRTL={isRTL} />
							<UserStatRow label={t("onlineUsers")} value={myUsersData?.online ?? 0} color="blue.400" isRTL={isRTL} />
							<UserStatRow
								label={t("dashboard.currentUserUsage")}
								value={formatBytes(myUsersData?.totalTraffic ?? 0, 1)}
								isRTL={isRTL}
							/>
							{systemData.personal_usage && systemData.personal_usage.reset_traffic_used_after_reset > 0 && (
								<UserStatRow
									label={t("dashboard.currentResetTraffic")}
									value={formatBytes(systemData.personal_usage.reset_traffic_used_after_reset, 1)}
									isRTL={isRTL}
								/>
							)}
						</Stack>
					)}
				</AnimatedHeightWrapper>
			</SectionCard>

			{systemData.admin && (
				<SectionCard
					title={
						<HStack spacing={2.5}>
							<Flex w="26px" h="26px" align="center" justify="center" borderRadius="7px" bg="panel.elevated" color="panel.textSecondary">
								<UsersIcon width={14} />
							</Flex>
							<span>{t("admins.listHeader")}</span>
						</HStack>
					}
				>
					<Stack spacing={1}>
						<UserStatRow label={t("totalUsers")} value={systemData.admin.total ?? 0} isRTL={isRTL} />
						<UserStatRow label={t("activeUsers")} value={systemData.admin.active ?? 0} color="green.400" isRTL={isRTL} />
						<UserStatRow label={t("disabledUsers")} value={systemData.admin.disabled ?? 0} color="gray.400" isRTL={isRTL} />
					</Stack>
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
