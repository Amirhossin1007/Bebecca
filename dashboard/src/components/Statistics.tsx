import { Dialog, DialogContent, DialogHeader } from "components/ui/dialog";
import { Button } from "components/ui/button";
import { Spinner } from "components/ui/spinner";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import { Download, Upload, Database, Clock, Cpu, Server, ShieldCheck, Signal, Users } from "lucide-react";
import { useColorMode } from "lib/color-mode";

import type { ComponentPropsWithoutRef } from "react";
import { cn } from "lib/cn";
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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetch, reportAPIError, useAPIRequestErrors } from "service/http";
import { AdminRole } from "types/Admin";
import type { SystemStats } from "types/System";
import type { UsersListResponse } from "types/User";
import { formatBytes, numberWithCommas } from "utils/formatByte";
import { mergeLiveSystemStats } from "utils/systemMetrics";
import { dashboardDiagnostics } from "utils/diagnostics";
import { getAPIWebSocketURL } from "utils/websocket";
import { DashboardMaintenanceControls } from "./DashboardMaintenanceControls";
import { SystemDiagnostics, useSystemDiagnostics } from "./SystemDiagnostics";

export const StatisticsQueryKey = ["statistics-query-key"] as const;

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

const formatDurationText = (seconds: number, t: TFunction): string => {
	if (!seconds || seconds <= 0) {
		return `0 ${t("dashboard.system.durationSeconds")}`;
	}

	const days = Math.floor(seconds / 86400);
	const hours = Math.floor((seconds % 86400) / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const remSeconds = Math.floor(seconds % 60);

	const andWord = t("dashboard.system.durationAnd");
	const commaWord = t("dashboard.system.durationComma");

	const formatUnit = (val: number, singleKey: string, pluralKey: string) => {
		const unitStr = val === 1 ? t(singleKey) : t(pluralKey);
		return `${val} ${unitStr}`;
	};

	if (days > 0) {
		const parts: string[] = [formatUnit(days, "dashboard.system.durationDay", "dashboard.system.durationDays")];
		if (hours > 0) {
			parts.push(formatUnit(hours, "dashboard.system.durationHour", "dashboard.system.durationHours"));
		}
		if (minutes > 0) {
			parts.push(formatUnit(minutes, "dashboard.system.durationMinute", "dashboard.system.durationMinutes"));
		}
		if (parts.length === 1) return parts[0];
		if (parts.length === 2) return parts.join(andWord);
		return parts.slice(0, -1).join(commaWord) + andWord + parts[parts.length - 1];
	}

	if (hours > 0) {
		const hStr = formatUnit(hours, "dashboard.system.durationHour", "dashboard.system.durationHours");
		if (minutes > 0) {
			const mStr = formatUnit(minutes, "dashboard.system.durationMinute", "dashboard.system.durationMinutes");
			return `${hStr}${andWord}${mStr}`;
		}
		return hStr;
	}

	if (minutes > 0) {
		const mStr = formatUnit(minutes, "dashboard.system.durationMinute", "dashboard.system.durationMinutes");
		if (remSeconds > 0) {
			const sStr = formatUnit(remSeconds, "dashboard.system.durationSecond", "dashboard.system.durationSeconds");
			return `${mStr}${andWord}${sStr}`;
		}
		return mStr;
	}

	return formatUnit(remSeconds, "dashboard.system.durationSecond", "dashboard.system.durationSeconds");
};

const formatLocalizedDuration = (
	seconds: number,
	t: TFunction,
	isRTL = false,
): ReactNode => {
	const text = formatDurationText(seconds, t);
	return (
		<p dir={isRTL ? "rtl" : "ltr"} className="text-[13px] font-bold tracking-[-0.01em] text-panel-text [unicode-bidi:isolate] [font-variant-numeric:tabular-nums]">
			{text}
		</p>
	);
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
					if (payload?.error) {
						reportAPIError("STREAM /system/metrics", payload);
						return;
					}
					const stats = payload?.stats ?? payload;
					if (!stats || typeof stats !== "object" || !("version" in stats)) return;
					useAPIRequestErrors.getState().clear("STREAM /system/metrics");
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
		os: typeof raw.os === "string" ? raw.os : undefined,
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
		total_incoming_bandwidth_speed: toFiniteNumber(raw.total_incoming_bandwidth_speed),
		total_outgoing_bandwidth_speed: toFiniteNumber(raw.total_outgoing_bandwidth_speed),
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
const formatPercent = (val: number, _isRTL = false): string => {
	if (!Number.isFinite(val)) return "0%";
	const rounded = Math.round(val * 10) / 10;
	const formatted = rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1);
	return `${formatted}%`;
};
const clampPercent = (value: number) => Math.min(100, Math.max(0, value));

const HISTORY_INTERVALS = [
	{ labelKey: "dashboard.history.interval.2m", seconds: 120 },
	{ labelKey: "dashboard.history.interval.10m", seconds: 600 },
	{ labelKey: "dashboard.history.interval.30m", seconds: 1800 },
	{ labelKey: "dashboard.history.interval.1h", seconds: 3600 },
	{ labelKey: "dashboard.history.interval.3h", seconds: 10800 },
	{ labelKey: "dashboard.history.interval.5h", seconds: 18000 },
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

const expandShortData = <T extends { timestamp: number }>(entries: T[]): T[] => {
	if (entries.length === 1) {
		const single = entries[0];
		const synthesizedBefore = { ...single, timestamp: single.timestamp - 2 };
		return [synthesizedBefore, single];
	}
	return entries;
};

const HistoryModal: FC<{
	open: boolean;
	onClose: () => void;
	payload: HistoryModalPayload | null;
	intervalSeconds: number;
	onIntervalChange: (value: number) => void;
	t: TFunction;
	isRTL?: boolean;
}> = ({ open: isOpen, onClose, payload, intervalSeconds, onIntervalChange, t, isRTL = false }) => {
	const { colorMode } = useColorMode();
	const [isSwitchingInterval, setIsSwitchingInterval] = useState(false);
		const [isChartReady, setIsChartReady] = useState(false);
		useEffect(() => {
			if (!isOpen) {
				setIsChartReady(false);
				return;
			}
			const timer = window.setTimeout(() => setIsChartReady(true), 280);
			return () => window.clearTimeout(timer);
		}, [isOpen]);
	const tabRefs = useRef<(HTMLDivElement | null)[]>([]);
	const [pillStyle, setPillStyle] = useState<{ left: number; width: number }>({ left: 4, width: 0 });
	const gridColor = colorMode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
	const mutedTextColor = colorMode === "dark" ? "#94a3b8" : "#64748b";

	const activeIntervalIndex = HISTORY_INTERVALS.findIndex((i) => i.seconds === intervalSeconds);

	useEffect(() => {
		if (!isOpen) return;
		const timer = setTimeout(() => {
			const targetEl = tabRefs.current[activeIntervalIndex];
			if (targetEl) {
				setPillStyle({
					left: targetEl.offsetLeft,
					width: targetEl.offsetWidth,
				});
			}
		}, 50);
		return () => clearTimeout(timer);
	}, [activeIntervalIndex, isOpen]);

	const { latestTimestamp, availableSpan } = useMemo(() => {
		if (!payload) {
			const now = Math.floor(Date.now() / 1000);
			return { latestTimestamp: now, earliestTimestamp: now - 120, availableSpan: 120 };
		}
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
			return { latestTimestamp: now, earliestTimestamp: now - 120, availableSpan: 120 };
		}
		const maxT = Math.max(...timestamps);
		const minT = Math.min(...timestamps);
		return { latestTimestamp: maxT, earliestTimestamp: minT, availableSpan: Math.max(1, maxT - minT) };
	}, [payload]);

	const effectiveSpan =
		intervalSeconds === 120
			? Math.min(120, availableSpan)
			: Math.max(intervalSeconds * 0.5, Math.min(intervalSeconds, availableSpan));

	const cutoff = latestTimestamp - effectiveSpan;

	const { chartSeries, actualMinTs, actualMaxTs } = useMemo(() => {
		if (!payload) return { chartSeries: [], actualMinTs: cutoff, actualMaxTs: latestTimestamp };

		let seriesList: { name: string; data: [number, number][] }[] = [];
		let allTs: number[] = [];

		if (payload.type === "network" && payload.networkEntries) {
			const filtered = payload.networkEntries.filter((e) => e.timestamp >= cutoff);
			const rawData = filtered.length >= 1 ? filtered : payload.networkEntries;
			const finalData = expandShortData(rawData);
			allTs = finalData.map((e) => e.timestamp);
			seriesList = [
				{
					name: t("dashboard.system.networkIncoming"),
					data: finalData.map((e) => [e.timestamp * 1000, e.incoming]),
				},
				{
					name: t("dashboard.system.networkOutgoing"),
					data: finalData.map((e) => [e.timestamp * 1000, e.outgoing]),
				},
			];
		} else if (payload.type === "panel") {
			const filteredCpu = (payload.cpuEntries || []).filter((e) => e.timestamp >= cutoff);
			const filteredMem = (payload.memoryEntries || []).filter((e) => e.timestamp >= cutoff);
			const rawCpu = filteredCpu.length >= 1 ? filteredCpu : payload.cpuEntries || [];
			const rawMem = filteredMem.length >= 1 ? filteredMem : payload.memoryEntries || [];
			const finalCpu = expandShortData(rawCpu);
			const finalMem = expandShortData(rawMem);
			allTs = [...finalCpu.map((e) => e.timestamp), ...finalMem.map((e) => e.timestamp)];
			seriesList = [
				{
					name: `${t("dashboard.system.cpuUsage")} (Panel CPU %)`,
					data: finalCpu.map((e) => [e.timestamp * 1000, e.value]),
				},
				{
					name: `${t("dashboard.system.memoryUsage")} (Panel RAM %)`,
					data: finalMem.map((e) => [e.timestamp * 1000, e.value]),
				},
			];
		} else if (payload.entries) {
			const filtered = payload.entries.filter((e) => e.timestamp >= cutoff);
			const rawEntries = filtered.length >= 1 ? filtered : payload.entries;
			const finalEntries = expandShortData(rawEntries);
			allTs = finalEntries.map((e) => e.timestamp);
			seriesList = [
				{
					name: payload.metricLabel ?? payload.title,
					data: finalEntries.map((e) => [e.timestamp * 1000, e.value]),
				},
			];
		}

		const minTs = allTs.length ? Math.min(...allTs) : cutoff;
		const maxTs = allTs.length ? Math.max(...allTs) : latestTimestamp;

		return {
			chartSeries: seriesList,
			actualMinTs: minTs,
			actualMaxTs: maxTs,
		};
	}, [payload, cutoff, latestTimestamp, t]);

	const hasEnoughPoints = useMemo(() => {
		if (!payload) return false;
		let totalPoints = 0;
		if (payload.type === "network" && payload.networkEntries) {
			totalPoints = payload.networkEntries.filter((e) => e.timestamp >= cutoff).length;
		} else if (payload.type === "panel") {
			const cLen = (payload.cpuEntries || []).filter((e) => e.timestamp >= cutoff).length;
			const mLen = (payload.memoryEntries || []).filter((e) => e.timestamp >= cutoff).length;
			totalPoints = Math.max(cLen, mLen);
		} else if (payload.entries) {
			totalPoints = payload.entries.filter((e) => e.timestamp >= cutoff).length;
		}
		return totalPoints >= 2;
	}, [payload, cutoff]);

	const isNetwork = payload?.type === "network";

	const { computedMin, computedMax } = useMemo(() => {
		if (isNetwork || !chartSeries.length) {
			return { computedMin: undefined, computedMax: undefined };
		}
		let maxVal = 0;
		let minVal = 100;
		for (const series of chartSeries) {
			for (const pt of series.data) {
				const v = pt[1];
				if (Number.isFinite(v)) {
					if (v > maxVal) maxVal = v;
					if (v < minVal) minVal = v;
				}
			}
		}
		if (maxVal === 0 && minVal === 100) {
			return { computedMin: 0, computedMax: 10 };
		}
		const dynamicMax = Math.min(100, Math.ceil(maxVal * 1.15) || 10);
		const dynamicMin = Math.max(0, Math.floor(minVal * 0.85));
		return {
			computedMin: dynamicMin,
			computedMax: dynamicMax,
		};
	}, [isNetwork, chartSeries]);

	const options: ApexOptions = useMemo(
		() => ({
			chart: {
				type: "area",
				animations: {
					enabled: true,
					easing: "easeinout",
					speed: 300,
					animateGradually: { enabled: true, delay: 50 },
					dynamicAnimation: { enabled: true, speed: 250 },
				},
				toolbar: { show: false },
				zoom: { enabled: false },
				background: "transparent",
				fontFamily: "inherit",
				sparkline: { enabled: false },
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
				padding: {
					top: 0,
					right: 8,
					bottom: 12,
					left: 5,
				},
			},
			xaxis: {
				type: "numeric",
				min: actualMinTs * 1000,
				max: actualMaxTs * 1000,
				tickAmount: 5,
				axisBorder: { show: false },
				axisTicks: { show: false },
				labels: {
					style: { colors: mutedTextColor, fontSize: "11px", fontFamily: "inherit" },
					hideOverlappingLabels: true,
					formatter: (val: string, timestamp?: number) => {
						const num = timestamp !== undefined ? timestamp : Number(val);
						if (!num || !Number.isFinite(num)) return val || "";
						const d = new Date(num);
						const h = String(d.getHours()).padStart(2, "0");
						const m = String(d.getMinutes()).padStart(2, "0");
						const s = String(d.getSeconds()).padStart(2, "0");
						return intervalSeconds === 120 ? `${h}:${m}:${s}` : `${h}:${m}`;
					},
				},
			},
			yaxis: {
				min: isNetwork ? undefined : computedMin,
				max: isNetwork ? undefined : computedMax,
				forceNiceScale: isNetwork,
				tickAmount: 5,
				labels: {
					offsetX: 0,
					style: { colors: mutedTextColor, fontSize: "11px", fontFamily: "inherit" },
					formatter: (val: number) => {
						if (!Number.isFinite(val)) return "0";
						if (isNetwork) {
							return formatBytes(val, 1);
						}
						return `${Math.round(val * 10) / 10}%`;
					},
				},
			},
			legend: {
				position: "bottom",
				offsetY: 0,
				labels: { colors: mutedTextColor },
				itemMargin: { horizontal: 8, vertical: 6 },
				markers: {
					offsetX: 0,
					offsetY: 0,
				},
				formatter: (seriesName: string) => seriesName,
				onItemClick: {
					toggleDataSeries: true,
				},
				onItemHover: {
					highlightDataSeries: true,
				},
			},
			tooltip: {
				custom: ({ series, seriesIndex, dataPointIndex, w }) => {
					const timestamp = w.globals.seriesX[seriesIndex]?.[dataPointIndex];
					const dateStr = timestamp
						? new Date(timestamp).toLocaleTimeString(isRTL ? "fa-IR" : "en-US", {
								hour12: false,
								hour: "2-digit",
								minute: "2-digit",
								second: "2-digit",
							})
						: "";

					const linesHtml = w.globals.seriesNames
						.map((name: string, i: number) => {
							const val = series[i]?.[dataPointIndex];
							if (val === undefined || Number.isNaN(val)) return "";
							const color = w.globals.colors[i] || "var(--rb-panel-accent)";
							const displayVal = isNetwork ? `${formatBytes(val, 2)}/s` : `${Math.round(val * 10) / 10}%`;
							return `
								<div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 4px;">
									<div style="display: flex; align-items: center; gap: 6px;">
										<span style="width: 7px; height: 7px; border-radius: 50%; background: ${color}; box-shadow: 0 0 6px ${color}88; flex-shrink: 0;"></span>
										<span style="color: var(--rb-panel-text-secondary, #94a3b8); font-size: 11px; font-weight: 500;">${name}</span>
									</div>
									<span style="color: var(--rb-panel-text, #ffffff); font-size: 11px; font-weight: 700; font-variant-numeric: tabular-nums; direction: ltr;">${displayVal}</span>
								</div>
							`;
						})
						.join("");

					return `
						<div style="
							background: rgba(22, 23, 28, 0.92);
							backdrop-filter: blur(16px);
							-webkit-backdrop-filter: blur(16px);
							border: 1px solid rgba(255, 255, 255, 0.12);
							border-radius: 12px;
							background-clip: padding-box;
							padding: 8px 12px;
							box-shadow: 0 8px 24px -4px rgba(0, 0, 0, 0.6);
							direction: ${isRTL ? "rtl" : "ltr"};
							font-family: inherit;
							min-width: 140px;
						">
							<div style="color: var(--rb-panel-text-muted, #64748b); font-size: 10px; font-weight: 600; direction: ltr; text-align: ${isRTL ? "right" : "left"}; border-bottom: 1px solid rgba(255, 255, 255, 0.08); padding-bottom: 4px; margin-bottom: 4px;">
								${dateStr}
							</div>
							${linesHtml}
						</div>
					`;
				},
			},
		}),
		[
			colorMode,
			gridColor,
			mutedTextColor,
			intervalSeconds,
			isNetwork,
			isRTL,
			computedMin,
			computedMax,
			actualMinTs,
			actualMaxTs,
		],
	);

	return (
		<Dialog open={isOpen} onOpenChange={(open) => { if (!open) (onClose)(); }}>
			
			<DialogContent className="bg-panel-surface border border-panel-border! rounded-[20px] shadow-[inset_0_1px_1px_0_rgba(255,_255,_255,_0.08),_0_32px_80px_rgba(0,0,0,0.6)] mx-3 sm:mx-6 max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden">
				<DialogHeader className="flex items-center justify-between px-4 md:px-6 py-3.5 md:py-4 border-b border-panel-border! text-[0.875rem] font-bold">
					<p className="text-panel-text">{t("dashboard.history.modalTitle", { metric: payload?.title ?? "" })}</p>
					
				</DialogHeader>
				<div className={cn("min-h-0 flex-1 overflow-y-auto", "px-4 md:px-6 py-4 md:py-5")}>
					<div className="flex flex-col gap-4">
						{hasEnoughPoints && (
							<div className="[&::-webkit-scrollbar]:hidden [scrollbar-width:none] p-1 rounded-full bg-panel-elevated w-full md:w-fit max-w-[100%] overflow-x-auto relative inline-flex items-center">
								{pillStyle.width > 0 && (
									<motion.div
										animate={{
											left: pillStyle.left,
											width: pillStyle.width,
										}}
										transition={{
											type: "tween",
											ease: [0.16, 1, 0.3, 1],
											duration: 0.32,
										}}
										style={{
											position: "absolute",
											top: 4,
											bottom: 4,
											borderRadius: "9999px",
											backgroundColor: "var(--rb-panel-surface)",
											boxShadow: "0 1px 3px rgba(0, 0, 0, 0.15)",
											zIndex: 1,
											pointerEvents: "none",
										}}
									/>
								)}
								{HISTORY_INTERVALS.map((interval, idx) => {
									const isAvailable = idx === 0 || availableSpan >= interval.seconds * 0.5;
									const isActive = intervalSeconds === interval.seconds;
									return (
										<div key={interval.seconds} ref={(el: HTMLDivElement | null) => {
												tabRefs.current[idx] = el;
											}} className="flex-[1_1_0] md:flex-none relative inline-flex items-center justify-center">
											<Button onClick={() => {
													if (isAvailable && intervalSeconds !== interval.seconds) {
														setIsSwitchingInterval(true);
														onIntervalChange(interval.seconds);
														setTimeout(() => setIsSwitchingInterval(false), 300);
													}
												}} variant="ghost" size="xs" className={cn("h-[26px] w-full px-1 sm:px-3.5 rounded-full bg-transparent! text-[10px] sm:text-[11px] whitespace-nowrap relative z-[2] hover:md:text-panel-text focus-visible:[outline:2px_solid_var(--rb-panel-accent)] focus-visible:[outline-offset:2px]", isActive ? "text-panel-text" : "text-panel-text-muted", isActive ? "font-bold" : "font-medium", isAvailable ? "opacity-100" : "opacity-40", isAvailable ? "cursor-pointer" : "cursor-not-allowed")}>
												{t(interval.labelKey)}
											</Button>
										</div>
									);
								})}
							</div>
						)}
						<div dir="ltr" className={cn("[&_.apexcharts-canvas]:[flex-direction:ltr]! [&_.apexcharts-yaxis-label]:[flex-direction:ltr]! [&_.apexcharts-legend]:[flex-direction:ltr]! [&_.apexcharts-legend]:flex! [&_.apexcharts-legend]:justify-center! [&_.apexcharts-legend]:gap-[18px]! [&_.apexcharts-legend-series]:inline-flex! [&_.apexcharts-legend-series]:items-center! [&_.apexcharts-legend-series]:gap-[6px]! [&_.apexcharts-legend-series]:m-0! [&_.apexcharts-legend-marker]:m-0! [&_.apexcharts-legend-marker]:relative! [&_.apexcharts-legend-marker]:top-auto! [&_.apexcharts-legend-marker]:left-auto! [&_.apexcharts-legend-marker]:right-auto! [&_.apexcharts-legend-marker]:bottom-auto! [&_.apexcharts-legend-marker]:[transform:none]! [&_.apexcharts-legend-text]:m-0! [&_.apexcharts-legend-text]:p-0! [&_.apexcharts-legend-text]:relative! [&_.apexcharts-legend-text]:top-auto! [&_.apexcharts-legend-text]:left-auto! [&_.apexcharts-legend-text]:right-auto! [&_.apexcharts-legend-text]:bottom-auto! [&_.apexcharts-tooltip]:bg-transparent! [&_.apexcharts-tooltip]:border! [&_.apexcharts-tooltip]:border-none! [&_.apexcharts-tooltip]:shadow-none! [&_.apexcharts-tooltip]:overflow-visible! [&_.apexcharts-tooltip.apexcharts-theme-light]:bg-transparent! [&_.apexcharts-tooltip.apexcharts-theme-light]:border! [&_.apexcharts-tooltip.apexcharts-theme-light]:border-none! [&_.apexcharts-tooltip.apexcharts-theme-light]:shadow-none! [&_.apexcharts-tooltip.apexcharts-theme-dark]:bg-transparent! [&_.apexcharts-tooltip.apexcharts-theme-dark]:border! [&_.apexcharts-tooltip.apexcharts-theme-dark]:border-none! [&_.apexcharts-tooltip.apexcharts-theme-dark]:shadow-none! [&_.apexcharts-legend-series.apexcharts-inactive-legend]:opacity-45! [&_.apexcharts-legend-series.apexcharts-inactive-legend]:pointer-events-auto [&_.apexcharts-legend-series.apexcharts-inactive-legend:hover]:opacity-75! [&_.apexcharts-canvas:has(.apexcharts-inactive-legend:hover)_.apexcharts-series]:opacity-100!", isRTL ? "[&_.apexcharts-legend-series]:flex-row!" : "[&_.apexcharts-legend-series]:flex-row!", isRTL ? "[&_.apexcharts-legend-marker]:order-2" : "[&_.apexcharts-legend-marker]:order-1", isRTL ? "[&_.apexcharts-legend-text]:order-1" : "[&_.apexcharts-legend-text]:order-2", "min-h-[300px] w-full relative pb-2")}>
							<AnimatePresence>
								{isSwitchingInterval && (
									<motion.div
										initial={{ opacity: 0 }}
										animate={{ opacity: 1 }}
										exit={{ opacity: 0 }}
										transition={{ duration: 0.15, ease: "easeInOut" }}
										style={{
											position: "absolute",
											top: 0,
											left: 0,
											right: 0,
											bottom: 0,
											backgroundColor: "rgba(10, 12, 16, 0.7)",
											backdropFilter: "blur(6px)",
											borderRadius: "16px",
											zIndex: 10,
											display: "flex",
											alignItems: "center",
											justifyContent: "center",
										}}
									>
										<Spinner className="text-panel-accent" />
									</motion.div>
								)}
							</AnimatePresence>
							<motion.div
								animate={{ opacity: isSwitchingInterval ? 0 : 1 }}
								transition={{ duration: 0.25, ease: "easeInOut" }}
								style={{ width: "100%", height: "100%" }}
							>
								<Suspense
									fallback={
										<div className="flex h-[280px] items-center justify-center">
											<Spinner className="text-panel-accent" />
										</div>
									}
								>
									{hasEnoughPoints && isOpen && !isChartReady ? (
											<div className="flex h-[300px] items-center justify-center">
												<Spinner className="text-panel-accent" />
											</div>
										) : hasEnoughPoints && isOpen ? (
										<HistoryChart key={`${payload?.title}-${intervalSeconds}-${colorMode}`} options={options} series={chartSeries} type="area" height={300} width="100%" />
									) : (
										<div className="flex-col flex h-[300px] items-center justify-center gap-2">
											<p className="text-[13px] text-panel-text-muted">
												{t("noData")}
											</p>
										</div>
									)}
								</Suspense>
							</motion.div>
						</div>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
};

const average = (values: number[]) =>
	values.length
		? values.reduce((total, value) => total + value, 0) / values.length
		: 0;
const peak = (values: number[]) => (values.length ? Math.max(...values) : 0);

const ResourceCard: FC<{
	label: string;
	icon: ReactNode;
	value: string;
	totalValue?: string;
	percent: number;
	metaUnit?: string;
	metaValue?: string | number;
	subMeta?: ReactNode;
	footerLeft?: string;
	footerRight?: string;
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
	subMeta,
	footerLeft,
	footerRight,
	onHistory,
	historyLabel,
	isRTL = false,
}) => {
	const { colorMode } = useColorMode();
	const safe = clampPercent(percent);
	const accent = "var(--rb-panel-accent)";
	const criticalColor = safe >= 90 ? "#ef4444" : safe >= 75 ? "#f59e0b" : accent;

	return (
		// biome-ignore lint/a11y/useSemanticElements: role=group is the hook the group's styles use for the card's hover styles
		<div role="group" className="bg-panel-surface border border-panel-border! rounded-[20px] p-4 sm:p-5 relative overflow-hidden flex flex-col justify-between shadow-[inset_0_1px_1px_0_rgba(255,_255,_255,_0.05),_0_8px_24px_-6px_rgba(0,_0,_0,_0.12)] [transition:border-color_0.25s_ease,_background-color_0.25s_ease,_box-shadow_0.25s_ease] hover:md:border-panel-border-strong! hover:md:bg-panel-elevated hover:md:shadow-[inset_0_1px_1px_0_rgba(255,_255,_255,_0.08),_0_12px_32px_-4px_rgba(0,_0,_0,_0.22)]">
			<div>
				<div className="flex justify-between items-center mb-3">
					<div className="flex flex-row gap-2.5 items-center">
						<div className="flex w-[32px] h-[32px] items-center justify-center rounded-[9px] bg-panel-elevated text-panel-text-secondary shrink-0">
							{icon}
						</div>
						<p className="text-[13px] font-semibold text-panel-text-secondary truncate">
							{label}
						</p>
					</div>
					{onHistory && (
						<Button onClick={onHistory} variant="ghost" size="xs" className={cn("after:content-[''] after:absolute after:top-[-10px] after:bottom-[-10px] after:left-[-10px] after:right-[-10px]", cn("h-[22px] px-2 text-[11px] rounded-full bg-panel-elevated [transition:all_0.2s_ease] [[role=group]:hover_&]:md:bg-panel-surface hover:md:bg-panel-border! hover:md:text-panel-text! active:bg-panel-border-strong! focus-visible:[outline:2px_solid_var(--rb-panel-accent)] focus-visible:[outline-offset:2px] relative", colorMode === "light" ? "text-panel-text-secondary" : "text-panel-text-muted", colorMode === "light" ? "font-semibold" : "font-medium", colorMode === "light" ? "[[role=group]:hover_&]:md:text-panel-text" : "[[role=group]:hover_&]:md:text-panel-text-secondary"))}>
							<span className="hidden sm:inline">{historyLabel}</span>
							<Clock className="size-3.5 sm:hidden" aria-hidden="true" />
						</Button>
					)}
				</div>

				<div className="flex-nowrap flex items-baseline gap-1.5 mb-1 justify-start">
					{totalValue ? (
						<div dir="ltr" className="flex items-baseline gap-1.5 [unicode-bidi:isolate]">
							<p className="text-[20px] sm:text-[22px] font-extrabold text-panel-text tracking-[-0.02em] leading-[1.1] [font-variant-numeric:tabular-nums]">
								{value}
							</p>
							<p className="text-[13px] font-semibold text-panel-text-muted [font-variant-numeric:tabular-nums]">
								/ {totalValue}
							</p>
						</div>
					) : (
						<div className="flex-wrap flex items-baseline gap-1.5">
							<p dir="ltr" className="text-[20px] sm:text-[22px] font-extrabold text-panel-text tracking-[-0.02em] leading-[1.1] [font-variant-numeric:tabular-nums] [unicode-bidi:isolate]">
								{value}
							</p>
							{metaValue !== undefined && metaUnit && (
								<div dir={isRTL ? "rtl" : "ltr"} className="flex items-center gap-1 [unicode-bidi:isolate]">
									<p dir="ltr" className="text-[13px] font-semibold text-panel-text-muted [font-variant-numeric:tabular-nums] [unicode-bidi:isolate]">
										{metaValue}
									</p>
									<p className="text-[12px] font-semibold text-panel-text-muted">
										{metaUnit}
									</p>
								</div>
							)}
						</div>
					)}
				</div>
				{subMeta && (
					<div className="mt-0.5">
						{subMeta}
					</div>
				)}
			</div>

			<div className="mt-3">
				<div className="flex justify-between items-center mb-1.5">
					<p dir="ltr" className="text-[11px] font-semibold text-panel-text-muted [unicode-bidi:isolate] [font-variant-numeric:tabular-nums]">
						{formatPercent(safe, false)}
					</p>
				</div>
				<div className="h-1 w-full overflow-hidden ${cls}"><div className="h-full rounded-full [transition:width_0.6s_ease,_background-color_0.4s_ease]" style={{ width: `${safe}%`, backgroundColor: criticalColor }} /></div>
				{(footerLeft || footerRight) && (
					<div dir={isRTL ? "rtl" : "ltr"} className="flex justify-between items-center mt-2 text-[11px] font-medium text-panel-text-muted [unicode-bidi:isolate] [font-variant-numeric:tabular-nums]">
						<p className="truncate">{footerLeft}</p>
						<p className="truncate">{footerRight}</p>
					</div>
				)}
			</div>
		</div>
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
	const accentColor = "text-[var(--rb-panel-accent)]";
	return (
		<div className="flex items-center justify-between py-2.5 border-b border-panel-border! last:border-b-0 gap-3">
			<div className="flex flex-row items-center gap-3 min-w-0! flex-nowrap">
				{tagColor && (
					<div style={{ backgroundColor: tagColor, boxShadow: `0 0 6px ${tagColor}88` }} className="shrink-0 w-[7px] h-[7px] rounded-full me-[3px]" />
				)}
				<p className={cn("text-[13px] font-semibold truncate", dimLabel ? "text-panel-text-muted" : "text-panel-text-secondary")}>
					{label}
				</p>
				{tag && (
					<span dir="ltr" className="flex items-center justify-center text-[10px] px-1.5 py-0.5 rounded-md bg-panel-elevated text-panel-text-muted font-semibold [transition:all_0.25s_ease] [[role=group]:hover_&]:md:bg-panel-surface [[role=group]:hover_&]:md:text-panel-text-secondary">
						<span dir="ltr" className="[font-variant-numeric:tabular-nums]">
							{tag.endsWith("%") ? `${tag.slice(0, -1)}%` : tag}
						</span>
					</span>
				)}
			</div>
			<div className="flex flex-col items-end gap-0 shrink-0">
				<p dir="ltr" className={cn("text-[13px] font-bold [font-variant-numeric:tabular-nums] [unicode-bidi:isolate]", accent ? (accentColor) : "text-panel-text")}>
					{typeof value === "number" ? formatNumberValue(value) : value}
				</p>
				{helper && (
					<p dir="ltr" className="text-[10px] text-panel-text-muted [font-variant-numeric:tabular-nums] [unicode-bidi:isolate]">
						{helper}
					</p>
				)}
			</div>
		</div>
	);
};

const SectionCard: FC<{
	children: ReactNode;
	title?: ReactNode;
	action?: ReactNode;
	noHover?: boolean;
	roleGroup?: boolean;
	/** Extra classes for the content area, e.g. to centre a short card. */
	contentClassName?: string;
}> = ({
	children,
	title,
	action,
	noHover = false,
	roleGroup = true,
	contentClassName,
}) => (
	<div role={roleGroup ? "group" : undefined} className={cn(noHover ? "" : "hover:md:border-panel-border-strong!" + " " + "hover:md:bg-panel-elevated" + " " + "hover:md:shadow-[inset_0_1px_1px_0_rgba(255,_255,_255,_0.08),_0_12px_32px_-4px_rgba(0,_0,_0,_0.22)]", "bg-panel-surface border border-panel-border! rounded-[20px] overflow-hidden shadow-[inset_0_1px_1px_0_rgba(255,_255,_255,_0.05),_0_8px_24px_-6px_rgba(0,_0,_0,_0.12)] [transition:border-color_0.25s_ease,_background-color_0.25s_ease,_box-shadow_0.25s_ease] flex h-full flex-col")}>
		{(title || action) && (
			<div className="flex px-4 sm:px-5 md:px-6 py-3.5 items-center justify-between border-b border-panel-border!">
				{title && (
					<div className="text-[13px] font-bold text-panel-text tracking-[-0.01em]">
						{title}
					</div>
				)}
				{action}
			</div>
		)}
		<div className={cn("flex-1 px-4 sm:px-5 md:px-6 py-4", contentClassName)}>
			{children}
		</div>
	</div>
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
				<AnimatePresence mode="wait" initial={false}>
					<motion.div
						key={activeKey}
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{
							opacity: { duration: 0.12, ease: "linear" },
						}}
					>
						{children}
					</motion.div>
				</AnimatePresence>
			</div>
		</motion.div>
	);
};

const SpeedItem: FC<{
	icon: ReactNode;
	label: string;
	value: string;
}> = ({ icon, label, value }) => {
	return (
		<div className="flex items-center justify-between gap-3">
			<div className="flex flex-row items-center gap-2.5 text-panel-text-muted">
				<div className="flex w-[28px] h-[28px] items-center justify-center rounded-[8px] bg-panel-elevated shrink-0">
					{icon}
				</div>
				<p className="text-[13px] font-semibold text-panel-text-secondary">
					{label}
				</p>
			</div>
			<p dir="ltr" className="text-[13px] font-bold tracking-[-0.01em] text-panel-text [font-variant-numeric:tabular-nums] [unicode-bidi:isolate]">
				{value}
			</p>
		</div>
	);
};

export const Statistics: FC<ComponentPropsWithoutRef<"div">> = (props) => {
	const { version } = useDashboard();
	const { userData } = useGetUser();
	const { t, i18n } = useTranslation();
	const isRTL = i18n.dir(i18n.language) === "rtl";

	const { data: rawSystemData } = useQuery<SystemStats>({
		queryKey: StatisticsQueryKey,
		queryFn: () => fetch("/system"),
	});

	// v5 removed onSuccess from useQuery: the side effect follows the data.
	const fetchedVersion = rawSystemData?.version;
	useEffect(() => {
		if (fetchedVersion && version !== fetchedVersion) {
			useDashboard.setState({ version: fetchedVersion });
		}
	}, [fetchedVersion, version]);

	const { data: maintenanceInfo } = useQuery<MaintenanceInfo>({ queryKey: ["dashboard-maintenance-info"], queryFn: () => fetch<MaintenanceInfo>("/maintenance/info", { timeout: 8000 }), refetchOnWindowFocus: false,
			staleTime: 5 * 60 * 1000,
			retry: false, });

	const { data: myUsersData } = useQuery<UsersListResponse>({ queryKey: ["dashboard-my-users-stats", userData.username], queryFn: () =>
			fetch<UsersListResponse>("/users", {
				query: { admin: userData.username, limit: 1000 },
			}), enabled: Boolean(userData.username),
			staleTime: 10_000,
			refetchInterval: 15_000, });

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
	const [bandwidthScope, setBandwidthScope] = useState<"master" | "total">("total");
	const { colorMode } = useColorMode();

	const canSeeGlobal = userData.role === AdminRole.Sudo || userData.role === AdminRole.FullAccess;
	const showTotalBandwidth = canSeeGlobal && bandwidthScope === "total";
	const diagnosticsQuery = useSystemDiagnostics(canSeeGlobal);
	const criticalIssues = dashboardDiagnostics(diagnosticsQuery.data || [], diagnosticsQuery.isSuccess ? undefined : systemData || undefined);
	const hasXrayError = criticalIssues.some((issue) =>
		issue.resource_type === "node" || issue.resource_type === "node_service" && issue.resource === "xray",
	);

	const openHistory = (payload: HistoryModalPayload) => {
		setHistoryInterval(HISTORY_INTERVALS[0].seconds);
		setHistoryPayload(payload);
	};

	if (!systemData) {
		return (
			<div dir={isRTL ? "rtl" : "ltr"} className="flex flex-col gap-4 md:gap-5 w-full">
				{canSeeGlobal && <SystemDiagnostics issues={criticalIssues} criticalOnly />}
				<div className={"max-md:[&_>_div:last-child]:w-full max-md:[&_>_div:last-child]:justify-start flex items-center justify-between px-1 flex-wrap gap-3"}>
					<div className={"flex-col items-start max-md:flex-row max-md:items-center min-[768px]:max-[991px]:[body:has([data-sidebar-collapsed='true'])_&]:flex-row min-[768px]:max-[991px]:[body:has([data-sidebar-collapsed='true'])_&]:items-center min-[768px]:max-[991px]:[body:not(:has([data-sidebar-collapsed='true']))_&]:flex-col min-[768px]:max-[991px]:[body:not(:has([data-sidebar-collapsed='true']))_&]:items-start lg:flex-col lg:items-start flex-wrap flex gap-2.5 md:gap-1"}>
						<div className="w-[140px] sm:w-[170px] h-[24px] bg-panel-surface rounded-[8px] border border-panel-border! shimmer-box" />
						<div className="flex flex-row items-center gap-1.5">
							<div className="w-[65px] h-[18px] bg-panel-surface rounded-full border border-panel-border! shimmer-box" />
							<div className="w-[85px] h-[18px] bg-panel-surface rounded-full border border-panel-border! shimmer-box" />
							<div className="w-[75px] h-[18px] bg-panel-surface rounded-full border border-panel-border! shimmer-box" />
						</div>
					</div>
					<div className="w-full sm:w-auto shrink-0">
						<div className="flex-row hidden sm:flex gap-2 items-center justify-end">
							<div className="w-[118px] h-[32px] bg-panel-surface rounded-full border border-panel-border! shimmer-box" />
							<div className="w-[100px] h-[32px] bg-panel-surface rounded-full border border-panel-border! shimmer-box" />
							<div className="w-[114px] h-[32px] bg-panel-surface rounded-full border border-panel-border! shimmer-box" />
						</div>
						<div className="flex-col flex sm:hidden gap-2 w-full">
							<div className="w-full h-[32px] bg-panel-surface rounded-full border border-panel-border! shimmer-box" />
							<div className="flex gap-2 w-full items-center">
								<div className="flex-[1_1_50%] h-[32px] bg-panel-surface rounded-full border border-panel-border! shimmer-box" />
								<div className="flex-[1_1_50%] h-[32px] bg-panel-surface rounded-full border border-panel-border! shimmer-box" />
							</div>
						</div>
					</div>
				</div>

				<div className={"min-[768px]:max-[910px]:[body:not(:has([data-sidebar-collapsed='true']))_&]:grid-cols-[1fr]! grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4"}>
					{[1, 2, 3, 4].map((i) => (
						<div key={i} className="bg-panel-surface rounded-[20px] border border-panel-border! p-4 sm:p-5 flex flex-col justify-between shadow-[inset_0_1px_1px_0_rgba(255,_255,_255,_0.05),_0_8px_24px_-6px_rgba(0,_0,_0,_0.12)] shimmer-box">
							<div>
								<div className="flex justify-between items-center mb-3">
									<div className="flex flex-row gap-2.5 items-center">
										<div className="w-[32px] h-[32px] rounded-[9px] bg-panel-elevated shrink-0" />
										<div className="w-[90px] h-[16px] rounded-md bg-panel-elevated" />
									</div>
									{i <= 2 && <div className="w-[75px] h-[22px] rounded-full bg-panel-elevated" />}
								</div>
								<div className="flex items-baseline gap-1.5 mb-1">
									<div className="w-[65px] h-[24px] rounded-md bg-panel-elevated" />
									<div className={cn("h-[16px] rounded-md bg-panel-elevated", i === 1 ? "w-[45px]" : "w-[60px]")} />
								</div>
								{i === 1 && (
									<div className="mt-0.5">
										<div className="w-[150px] h-[14px] rounded-md bg-panel-elevated" />
									</div>
								)}
							</div>
							<div className="mt-3">
								<div className="flex justify-between items-center mb-1.5">
									<div className="w-[35px] h-[13px] rounded-xs bg-panel-elevated" />
								</div>
								<div className="w-full h-[4px] rounded-full bg-panel-elevated" />
								<div className="flex justify-between items-center mt-2.5 pt-2.5 border-t border-panel-border!">
									<div className="w-[80px] h-[14px] rounded-xs bg-panel-elevated" />
									<div className="w-[70px] h-[14px] rounded-xs bg-panel-elevated" />
								</div>
							</div>
						</div>
					))}
				</div>

				<div className={"min-[768px]:max-[910px]:[body:not(:has([data-sidebar-collapsed='true']))_&]:grid-cols-[1fr]! grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4"}>
					<div className="bg-panel-surface rounded-[20px] border border-panel-border! overflow-hidden shadow-[inset_0_1px_1px_0_rgba(255,_255,_255,_0.05),_0_8px_24px_-6px_rgba(0,_0,_0,_0.12)] shimmer-box">
						<div className="flex px-4 sm:px-5 md:px-6 py-3.5 justify-between items-center border-b border-panel-border!">
							<div className="flex flex-row items-center gap-2.5">
								<div className="w-[26px] h-[26px] rounded-[7px] bg-panel-elevated" />
								<div className="w-[110px] h-[16px] rounded-md bg-panel-elevated" />
							</div>
							<div className="w-[75px] h-[22px] rounded-full bg-panel-elevated" />
						</div>
						<div className="p-4 sm:p-5 md:p-6">
							<div className="flex flex-col gap-3">
								<div className="flex justify-between items-center gap-3">
									<div className="flex flex-row items-center gap-2.5">
										<div className="w-[28px] h-[28px] rounded-[8px] bg-panel-elevated shrink-0" />
										<div className="w-[85px] h-[15px] rounded-md bg-panel-elevated" />
									</div>
									<div className="w-[80px] h-[16px] rounded-md bg-panel-elevated" />
								</div>
								<div className="flex justify-between items-center gap-3">
									<div className="flex flex-row items-center gap-2.5">
										<div className="w-[28px] h-[28px] rounded-[8px] bg-panel-elevated shrink-0" />
										<div className="w-[90px] h-[15px] rounded-md bg-panel-elevated" />
									</div>
									<div className="w-[80px] h-[16px] rounded-md bg-panel-elevated" />
								</div>
							</div>
						</div>
					</div>

					<div className="bg-panel-surface rounded-[20px] border border-panel-border! overflow-hidden shadow-[inset_0_1px_1px_0_rgba(255,_255,_255,_0.05),_0_8px_24px_-6px_rgba(0,_0,_0,_0.12)] shimmer-box">
						<div className="flex px-4 sm:px-5 md:px-6 py-3.5 justify-between items-center border-b border-panel-border!">
							<div className="flex flex-row items-center gap-2.5">
								<div className="w-[26px] h-[26px] rounded-[7px] bg-panel-elevated" />
								<div className="w-[90px] h-[16px] rounded-md bg-panel-elevated" />
							</div>
						</div>
						<div className="p-4 sm:p-5 md:p-6">
							<div className="flex flex-col gap-3">
								<div className="flex justify-between items-center gap-3">
									<div className="flex flex-row items-center gap-2.5">
										<div className="w-[28px] h-[28px] rounded-[8px] bg-panel-elevated shrink-0" />
										<div className="w-[95px] h-[15px] rounded-md bg-panel-elevated" />
									</div>
									<div className="w-[110px] h-[16px] rounded-md bg-panel-elevated" />
								</div>
								<div className="flex justify-between items-center gap-3">
									<div className="flex flex-row items-center gap-2.5">
										<div className="w-[28px] h-[28px] rounded-[8px] bg-panel-elevated shrink-0" />
										<div className="w-[90px] h-[15px] rounded-md bg-panel-elevated" />
									</div>
									<div className="w-[95px] h-[16px] rounded-md bg-panel-elevated" />
								</div>
							</div>
						</div>
					</div>
				</div>

				<div className="bg-panel-surface rounded-[20px] border border-panel-border! overflow-hidden shadow-[inset_0_1px_1px_0_rgba(255,_255,_255,_0.05),_0_8px_24px_-6px_rgba(0,_0,_0,_0.12)] shimmer-box">
					<div className="flex px-4 sm:px-5 md:px-6 py-3.5 justify-between items-center border-b border-panel-border!">
						<div className="flex flex-row items-center gap-2.5">
							<div className="w-[26px] h-[26px] rounded-[7px] bg-panel-elevated" />
							<div className="w-[110px] h-[16px] rounded-md bg-panel-elevated" />
						</div>
						<div className="w-[75px] h-[22px] rounded-full bg-panel-elevated" />
					</div>
					<div className="p-4 sm:p-5 md:p-6">
						<div className="grid grid-cols-2 gap-3 md:gap-4">
							{[1, 2].map((i) => (
								<div key={i} className="bg-panel-surface rounded-[20px] border border-panel-border! p-4 sm:p-5 flex flex-col justify-between shadow-[inset_0_1px_1px_0_rgba(255,_255,_255,_0.05),_0_8px_24px_-6px_rgba(0,_0,_0,_0.12)]">
									<div>
										<div className="flex justify-between items-center mb-3">
											<div className="flex flex-row gap-2.5 items-center">
												<div className="w-[32px] h-[32px] rounded-[9px] bg-panel-elevated shrink-0" />
												<div className={cn("h-[16px] rounded-md bg-panel-elevated", i === 1 ? "w-[120px]" : "w-[130px]")} />
											</div>
										</div>
										<div className="flex items-baseline gap-1.5 mb-1">
											<div className="w-[55px] h-[24px] rounded-md bg-panel-elevated" />
											<div className="w-[45px] h-[16px] rounded-md bg-panel-elevated" />
										</div>
									</div>
									<div className="mt-3">
										<div className="flex justify-between items-center mb-1.5">
											<div className="w-[32px] h-[13px] rounded-xs bg-panel-elevated" />
										</div>
										<div className="w-full h-[4px] rounded-full bg-panel-elevated" />
										<div className="flex justify-between items-center mt-2.5 pt-2.5 border-t border-panel-border!">
											<div className="w-[75px] h-[14px] rounded-xs bg-panel-elevated" />
											<div className="w-[70px] h-[14px] rounded-xs bg-panel-elevated" />
										</div>
									</div>
								</div>
							))}
						</div>
					</div>
				</div>

				<div className="bg-panel-surface rounded-[20px] border border-panel-border! overflow-hidden shadow-[inset_0_1px_1px_0_rgba(255,_255,_255,_0.05),_0_8px_24px_-6px_rgba(0,_0,_0,_0.12)] shimmer-box">
					<div className="flex px-4 sm:px-5 md:px-6 py-3.5 justify-between items-center border-b border-panel-border!">
						<div className="flex flex-row items-center gap-2.5">
							<div className="w-[26px] h-[26px] rounded-[7px] bg-panel-elevated" />
							<div className="w-[90px] h-[16px] rounded-md bg-panel-elevated" />
						</div>
						<div className="flex flex-row items-center gap-0.5 bg-panel-elevated p-0.5 rounded-[8px]">
							<div className="w-[65px] h-[22px] rounded-[6px] bg-panel-surface" />
							<div className="w-[60px] h-[22px] rounded-[6px] bg-transparent" />
						</div>
					</div>
					<div className="p-4 sm:p-5 md:p-6">
						<div className="flex flex-col gap-0">
							{[
								{ id: "skel-u-total", hasTag: false, hasHelper: false, labelW: "55px", valW: "35px" },
								{ id: "skel-u-active", hasTag: true, hasHelper: false, labelW: "55px", valW: "35px" },
								{ id: "skel-u-online", hasTag: true, hasHelper: true, labelW: "55px", valW: "35px" },
								{ id: "skel-u-onhold", hasTag: false, hasHelper: false, labelW: "65px", valW: "30px" },
								{ id: "skel-u-limited", hasTag: false, hasHelper: false, labelW: "70px", valW: "30px" },
								{ id: "skel-u-expired", hasTag: false, hasHelper: false, labelW: "75px", valW: "30px" },
							].map((row, idx) => (
								<div key={row.id} className={cn("flex justify-between items-center py-2.5 border-panel-border!", idx === 5 ? "border-b-0" : "border-b")}>
									<div className="flex flex-row items-center gap-3 min-w-0!">
										<div className="w-[7px] h-[7px] rounded-full bg-panel-elevated me-[3px] shrink-0" />
										<div style={{ width: row.labelW }} className="h-[14px] rounded-md bg-panel-elevated" />
										{row.hasTag && <div className="w-[36px] h-[18px] rounded-md bg-panel-elevated" />}
									</div>
									<div className="flex flex-col items-end gap-0.5 shrink-0">
										<div style={{ width: row.valW }} className="h-[16px] rounded-md bg-panel-elevated" />
										{row.hasHelper && <div className="w-[100px] h-[12px] rounded-xs bg-panel-elevated mt-0.5" />}
									</div>
								</div>
							))}
						</div>
					</div>
				</div>

				{canSeeGlobal && (
					<div className="bg-panel-surface rounded-[20px] border border-panel-border! overflow-hidden shadow-[inset_0_1px_1px_0_rgba(255,_255,_255,_0.05),_0_8px_24px_-6px_rgba(0,_0,_0,_0.12)] shimmer-box">
						<div className="flex px-4 sm:px-5 md:px-6 py-3.5 justify-between items-center border-b border-panel-border!">
							<div className="flex flex-row items-center gap-2.5">
								<div className="w-[26px] h-[26px] rounded-[7px] bg-panel-elevated" />
								<div className="w-[85px] h-[16px] rounded-md bg-panel-elevated" />
							</div>
						</div>
						<div className="p-4 sm:p-5 md:p-6">
							<div className="flex flex-col gap-0">
								{[
									{ id: "skel-a-total", labelW: "75px", valW: "40px" },
									{ id: "skel-a-full", labelW: "85px", valW: "40px" },
									{ id: "skel-a-sudo", labelW: "65px", valW: "40px" },
									{ id: "skel-a-standard", labelW: "80px", valW: "40px" },
									{ id: "skel-a-top", labelW: "75px", valW: "120px" },
								].map((row, idx) => (
									<div key={row.id} className={cn("flex justify-between items-center py-2.5 border-panel-border!", idx === 4 ? "border-b-0" : "border-b")}>
										<div className="flex flex-row items-center gap-3 min-w-0!">
											<div className="w-[7px] h-[7px] rounded-full bg-panel-elevated me-[3px] shrink-0" />
											<div style={{ width: row.labelW }} className="h-[14px] rounded-md bg-panel-elevated" />
										</div>
										<div style={{ width: row.valW }} className="h-[16px] rounded-md bg-panel-elevated" />
									</div>
								))}
							</div>
						</div>
					</div>
				)}
			</div>
		);
	}

	const activePercent =
		systemData.total_user > 0
			? formatPercent((systemData.users_active / systemData.total_user) * 100, isRTL)
			: formatPercent(0, isRTL);
	const onlinePercent =
		systemData.total_user > 0
			? formatPercent((systemData.online_users / systemData.total_user) * 100, isRTL)
			: formatPercent(0, isRTL);

	const myTotalUsers = myUsersData?.total ?? systemData.personal_usage?.total_users ?? 0;
	const myActiveUsers = myUsersData?.active_total ?? myUsersData?.status_breakdown?.active ?? myTotalUsers;
	const myOnlineUsers = myUsersData?.online_total ?? 0;

	const myActivePercent =
		myTotalUsers > 0
			? formatPercent((myActiveUsers / myTotalUsers) * 100, isRTL)
			: formatPercent(0, isRTL);
	const myOnlinePercent =
		myTotalUsers > 0
			? formatPercent((myOnlineUsers / myTotalUsers) * 100, isRTL)
			: formatPercent(0, isRTL);

	const myUsersList = myUsersData?.users ?? [];
	const myOnHoldUsers = myUsersData?.status_breakdown?.on_hold ?? myUsersList.filter((u) => u.status === "on_hold").length;
	const myLimitedUsers = myUsersData?.status_breakdown?.limited ?? myUsersList.filter((u) => u.status === "limited").length;
	const myExpiredUsers = myUsersData?.status_breakdown?.expired ?? myUsersList.filter((u) => u.status === "expired").length;
	const myOnlineUploadSpeed = myUsersList.reduce((sum, u) => sum + (Number(u.upload_speed) || 0), 0);
	const myOnlineDownloadSpeed = myUsersList.reduce((sum, u) => sum + (Number(u.download_speed) || 0), 0);
	const myActiveUsersUsedTraffic = myUsersList.reduce((sum, u) => sum + (Number(u.used_traffic) || 0), 0);

	const panelInfo = maintenanceInfo?.panel;
	const exactVersion =
		panelInfo?.tag ||
		panelInfo?.update?.current ||
		(systemData.channel?.toLowerCase() === "dev" ? "dev" : systemData.version) ||
		"-";

	return (
		<div dir={isRTL ? "rtl" : "ltr"} {...props} className="flex flex-col gap-4 md:gap-5 w-full">
			{canSeeGlobal && <SystemDiagnostics issues={criticalIssues} criticalOnly />}
			<div className="flex items-center justify-between flex-wrap gap-3 px-1">
				<div className={"flex-col items-start max-md:flex-row max-md:items-center min-[768px]:max-[991px]:[body:has([data-sidebar-collapsed='true'])_&]:flex-row min-[768px]:max-[991px]:[body:has([data-sidebar-collapsed='true'])_&]:items-center min-[768px]:max-[991px]:[body:not(:has([data-sidebar-collapsed='true']))_&]:flex-col min-[768px]:max-[991px]:[body:not(:has([data-sidebar-collapsed='true']))_&]:items-start lg:flex-col lg:items-start flex-wrap flex gap-2.5 md:gap-1"}>
					<p className="text-[18px] md:text-[20px] font-bold text-panel-text tracking-[-0.02em]">
						{t("dashboard.system.overview")}
					</p>
					<div className="flex-row flex items-center gap-2">
						<div style={{
								animation: systemData.xray_running && !hasXrayError ? "livePulse 3.5s ease-in-out infinite" : "none",
								boxShadow: systemData.xray_running && !hasXrayError
									? "0 0 5px rgba(34, 197, 94, 0.4)"
									: "0 0 5px rgba(239, 68, 68, 0.4)",
							}} className={cn("w-[7px] h-[7px] rounded-full", systemData.xray_running && !hasXrayError ? "bg-[#22c55e]" : "bg-[#ef4444]")} />
						<p className="text-[12px] text-panel-text-secondary font-semibold">
							{hasXrayError ? t("diagnostics.statusError") : systemData.xray_running ? t("dashboard.system.statusRunning") : t("dashboard.system.statusStopped")}
						</p>
						{systemData.os && (
							<div className="flex flex-row gap-1.5 items-center text-panel-text-secondary text-[12px] font-semibold">
								<span>·</span>
								<span dir="ltr" className="[unicode-bidi:isolate]">
									{systemData.os}
								</span>
							</div>
						)}
						{exactVersion && exactVersion !== "-" && (
							<div className="flex flex-row gap-1.5 items-center text-panel-text-secondary text-[12px] font-semibold">
								<span>·</span>
								<span dir="ltr" className="[unicode-bidi:isolate]">
									{exactVersion}
								</span>
							</div>
						)}
					</div>
				</div>
				<DashboardMaintenanceControls channel={systemData.channel} version={systemData.version} />
			</div>

			<div className={"min-[768px]:max-[910px]:[body:not(:has([data-sidebar-collapsed='true']))_&]:grid-cols-[1fr]! grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4"}>
				<ResourceCard
					label={t("dashboard.system.cpuUsage")}
					icon={<Cpu className="w-[16px]" />}
					value={formatPercent(systemData.cpu_usage, false)}
					percent={systemData.cpu_usage}
					metaValue={formatNumberValue(systemData.cpu_cores)}
					metaUnit={t("dashboard.system.core")}
					subMeta={
						systemData.load_avg && systemData.load_avg.length >= 3 ? (
							<div dir={isRTL ? "rtl" : "ltr"} className="flex items-center gap-1.5 text-[11px] font-medium text-panel-text-muted">
								<span>{t("loadAverage")}:</span>
								<span dir="ltr" className="[font-variant-numeric:tabular-nums] [unicode-bidi:isolate]">
									{systemData.load_avg.slice(0, 3).map((v) => v.toFixed(2)).join(" · ")}
								</span>
							</div>
						) : undefined
					}
					footerLeft={`${t("dashboard.system.average")}: ${formatPercent(average(systemData.cpu_history.map((e) => e.value)), isRTL)}`}
					footerRight={`${t("dashboard.system.peak")}: ${formatPercent(peak(systemData.cpu_history.map((e) => e.value)), isRTL)}`}
					historyLabel={t("dashboard.system.viewHistory")}
					isRTL={isRTL}
					onHistory={() =>
						openHistory({
							type: "cpu",
							title: t("dashboard.system.cpuUsage"),
							metricLabel: t("dashboard.system.cpuUsage"),
							entries: systemData.cpu_history,
						})
					}
				/>
				<ResourceCard
					label={t("dashboard.system.memoryUsage")}
					icon={<Server className="w-[16px]" />}
					value={formatBytes(systemData.memory.current, 1)}
					totalValue={formatBytes(systemData.memory.total, 1)}
					percent={systemData.memory.percent}
					footerLeft={`${t("dashboard.system.average")}: ${formatPercent(average(systemData.memory_history.map((e) => e.value)), isRTL)}`}
					footerRight={`${t("dashboard.system.peak")}: ${formatPercent(peak(systemData.memory_history.map((e) => e.value)), isRTL)}`}
					historyLabel={t("dashboard.system.viewHistory")}
					isRTL={isRTL}
					onHistory={() =>
						openHistory({
							type: "memory",
							title: t("dashboard.system.memoryUsage"),
							metricLabel: t("dashboard.system.memoryUsage"),
							entries: systemData.memory_history,
						})
					}
				/>
				<ResourceCard
					label={t("dashboard.system.swapUsage")}
					icon={<Database className="w-[16px]" />}
					value={formatBytes(systemData.swap.current, 1)}
					totalValue={formatBytes(systemData.swap.total, 1)}
					percent={systemData.swap.percent}
					footerLeft={`${t("dashboard.system.average")}: ${formatPercent(average(systemData.swap_history.map((e) => e.value)), isRTL)}`}
					footerRight={`${t("dashboard.system.peak")}: ${formatPercent(peak(systemData.swap_history.map((e) => e.value)), isRTL)}`}
					isRTL={isRTL}
				/>
				<ResourceCard
					label={t("dashboard.system.diskUsage")}
					icon={<Database className="w-[16px]" />}
					value={formatBytes(systemData.disk.current, 1)}
					totalValue={formatBytes(systemData.disk.total, 1)}
					percent={systemData.disk.percent}
					footerLeft={`${t("dashboard.system.free")}: ${formatBytes(Math.max(0, systemData.disk.total - systemData.disk.current), 1)}`}
					footerRight={`${t("dashboard.system.average")}: ${formatPercent(average(systemData.disk_history.map((e) => e.value)), isRTL)}`}
					isRTL={isRTL}
				/>
			</div>

			<div className={"min-[768px]:max-[910px]:[body:not(:has([data-sidebar-collapsed='true']))_&]:grid-cols-[1fr]! grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4"}>
				<SectionCard
					title={
						<div className="flex flex-row items-center gap-2.5">
							<div className="flex w-[26px] h-[26px] items-center justify-center rounded-[7px] bg-panel-elevated text-panel-text-secondary">
								<Signal className="w-[14px]" />
							</div>
							<span>{t("dashboard.system.bandwidthSpeed")}</span>
						</div>
					}
					action={
						<div className="flex flex-row items-center gap-2">
							{canSeeGlobal ? (
								<div className="flex flex-row items-center gap-0.5 bg-panel-elevated p-0.5 rounded-[8px] relative [transition:all_0.25s_ease]">
									<div className="relative">
										{bandwidthScope === "master" && (
											<motion.div
												layoutId="bandwidthScopeTabPill"
												style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: "6px", backgroundColor: "var(--rb-panel-accent)", border: "1px solid var(--rb-panel-accent)", boxShadow: "0 1px 3px rgba(0,0,0,0.12)", zIndex: 1 }}
												transition={{ type: "tween", ease: "easeInOut", duration: 0.25 }}
											/>
										)}
										<Button onClick={() => setBandwidthScope("master")} variant="ghost" size="xs" className={cn("h-[22px] px-2.5 rounded-[6px] text-[11px] font-semibold bg-transparent! relative z-[2] [transition:all_0.2s_ease] focus-visible:[outline:2px_solid_var(--rb-panel-accent)] focus-visible:[outline-offset:2px]", bandwidthScope === "master" ? "text-white" : "text-panel-text")}>
											{t("dashboard.system.bandwidthScope.master")}
										</Button>
									</div>
									<div className="relative">
										{bandwidthScope === "total" && (
											<motion.div
												layoutId="bandwidthScopeTabPill"
												style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: "6px", backgroundColor: "var(--rb-panel-accent)", border: "1px solid var(--rb-panel-accent)", boxShadow: "0 1px 3px rgba(0,0,0,0.12)", zIndex: 1 }}
												transition={{ type: "tween", ease: "easeInOut", duration: 0.25 }}
											/>
										)}
										<Button onClick={() => setBandwidthScope("total")} title={t("dashboard.system.bandwidthScope.totalHint")} variant="ghost" size="xs" className={cn("h-[22px] px-2.5 rounded-[6px] text-[11px] font-semibold bg-transparent! relative z-[2] [transition:all_0.2s_ease] focus-visible:[outline:2px_solid_var(--rb-panel-accent)] focus-visible:[outline-offset:2px]", bandwidthScope === "total" ? "text-white" : "text-panel-text")}>
											{t("dashboard.system.bandwidthScope.total")}
										</Button>
									</div>
								</div>
							) : null}
							{!showTotalBandwidth ? (
								<Button onClick={() =>
										openHistory({
											type: "network",
											title: t("dashboard.system.bandwidthSpeed"),
											networkEntries: systemData.network_history,
										})
									} variant="ghost" size="xs" className={cn("after:content-[''] after:absolute after:top-[-10px] after:bottom-[-10px] after:left-[-10px] after:right-[-10px]", cn("h-[22px] px-2.5 text-[11px] rounded-full bg-panel-elevated [transition:all_0.2s_ease] [[role=group]:hover_&]:md:bg-panel-surface hover:md:bg-panel-border! hover:md:text-panel-text! active:bg-panel-border-strong! focus-visible:[outline:2px_solid_var(--rb-panel-accent)] focus-visible:[outline-offset:2px] relative", colorMode === "light" ? "text-panel-text-secondary" : "text-panel-text-muted", colorMode === "light" ? "font-semibold" : "font-medium", colorMode === "light" ? "[[role=group]:hover_&]:md:text-panel-text" : "[[role=group]:hover_&]:md:text-panel-text-secondary"))}>
									{t("dashboard.system.viewHistory")}
								</Button>
							) : null}
						</div>
					}
				>
					<div className="flex flex-col gap-3">
						<SpeedItem
							icon={<Download className="w-[13px]" />}
							label={t("dashboard.system.incomingSpeed")}
							value={`${formatBytes(showTotalBandwidth ? (systemData.total_incoming_bandwidth_speed ?? 0) : systemData.incoming_bandwidth_speed)}/s`}
						/>
						<SpeedItem
							icon={<Upload className="w-[13px]" />}
							label={t("dashboard.system.outgoingSpeed")}
							value={`${formatBytes(showTotalBandwidth ? (systemData.total_outgoing_bandwidth_speed ?? 0) : systemData.outgoing_bandwidth_speed)}/s`}
						/>
					</div>
				</SectionCard>

				<SectionCard
					title={
						<div className="flex flex-row items-center gap-2.5">
							<div className="flex w-[26px] h-[26px] items-center justify-center rounded-[7px] bg-panel-elevated text-panel-text-secondary">
								<Clock className="w-[14px]" />
							</div>
							<span>{t("dashboard.system.uptime")}</span>
						</div>
					}
				>
					<div className="flex h-full flex-col justify-between gap-3">
						<div className="flex items-center justify-between gap-3">
							<div className="flex flex-row items-center gap-2.5 text-panel-text-muted">
								<div className="flex w-[28px] h-[28px] items-center justify-center rounded-[8px] bg-panel-elevated shrink-0">
									<Server className="w-[13px]" />
								</div>
								<p className="text-[13px] font-semibold text-panel-text-secondary">
									{t("dashboard.system.systemUptime")}
								</p>
							</div>
							{formatLocalizedDuration(systemData.uptime_seconds, t, isRTL)}
						</div>
						<div className="flex items-center justify-between gap-3">
							<div className="flex flex-row items-center gap-2.5 text-panel-text-muted">
								<div className="flex w-[28px] h-[28px] items-center justify-center rounded-[8px] bg-panel-elevated shrink-0">
									<Database className="w-[13px]" />
								</div>
								<p className="text-[13px] font-semibold text-panel-text-secondary">
									{t("dashboard.system.panelUptime")}
								</p>
							</div>
							{formatLocalizedDuration(systemData.panel_uptime_seconds, t, isRTL)}
						</div>
					</div>
				</SectionCard>
			</div>

			<SectionCard
				noHover
				roleGroup={false}
				title={
					<div className="flex flex-row items-center gap-2.5">
						<div className="flex w-[26px] h-[26px] items-center justify-center rounded-[7px] bg-panel-elevated text-panel-text-secondary">
							<Cpu className="w-[14px]" />
						</div>
						<span>{t("dashboard.system.panelUsage")}</span>
					</div>
				}
				action={
					<Button onClick={() =>
							openHistory({
								type: "panel",
								title: t("dashboard.system.panelUsage"),
								cpuEntries: systemData.panel_cpu_history,
								memoryEntries: systemData.panel_memory_history,
							})
						} variant="ghost" size="xs" className={cn("after:content-[''] after:absolute after:top-[-10px] after:bottom-[-10px] after:left-[-10px] after:right-[-10px]", cn("h-[22px] px-2.5 text-[11px] rounded-full bg-panel-elevated [transition:all_0.2s_ease] hover:bg-panel-border! hover:text-panel-text! active:bg-panel-border-strong! focus-visible:[outline:2px_solid_var(--rb-panel-accent)] focus-visible:[outline-offset:2px] relative", colorMode === "light" ? "text-panel-text-secondary" : "text-panel-text-muted", colorMode === "light" ? "font-semibold" : "font-medium"))}>
						{t("dashboard.system.viewHistory")}
					</Button>
				}
			>
				<div className="grid grid-cols-2 gap-3 md:gap-4">
					<ResourceCard
						label={`${t("dashboard.system.cpuUsage")} (Panel)`}
						icon={<Cpu className="w-[16px]" />}
						value={formatPercent(systemData.panel_cpu_percent, false)}
						percent={systemData.panel_cpu_percent}
						metaValue={formatNumberValue(systemData.app_threads)}
						metaUnit={t("dashboard.system.thread")}
						footerLeft={`${t("dashboard.system.average")}: ${formatPercent(average(systemData.panel_cpu_history.map((e) => e.value)), isRTL)}`}
						footerRight={`${t("dashboard.system.peak")}: ${formatPercent(peak(systemData.panel_cpu_history.map((e) => e.value)), isRTL)}`}
						isRTL={isRTL}
					/>
					<ResourceCard
						label={`${t("dashboard.system.memoryUsage")} (Panel)`}
						icon={<Server className="w-[16px]" />}
						value={formatBytes(systemData.app_memory, 1)}
						totalValue={formatBytes(systemData.memory.total, 1)}
						percent={systemData.panel_memory_percent}
						footerLeft={`${t("dashboard.system.average")}: ${formatPercent(average(systemData.panel_memory_history.map((e) => e.value)), isRTL)}`}
						footerRight={`${t("dashboard.system.peak")}: ${formatPercent(peak(systemData.panel_memory_history.map((e) => e.value)), isRTL)}`}
						isRTL={isRTL}
					/>
				</div>
			</SectionCard>

			<SectionCard
				title={
					<div className="flex flex-row items-center gap-2.5">
						<div className="flex w-[26px] h-[26px] items-center justify-center rounded-[7px] bg-panel-elevated text-panel-text-secondary">
							<Users className="w-[14px]" />
						</div>
						<span>{t("dashboard.users")}</span>
					</div>
				}
				action={
					canSeeGlobal ? (
						<div className="flex flex-row items-center gap-0.5 bg-panel-elevated p-0.5 rounded-[8px] relative [transition:all_0.25s_ease] [[role=group]:hover_&]:md:bg-panel-surface">
							<div className="relative">
								{userTab === "all" && (
									<motion.div
										layoutId="usersOverviewTabPill"
										style={{
											position: "absolute",
											top: 0,
											left: 0,
											right: 0,
											bottom: 0,
											borderRadius: "6px",
											backgroundColor: "var(--rb-panel-accent)",
											border: "1px solid var(--rb-panel-accent)",
											boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
											zIndex: 1,
										}}
										transition={{
											type: "tween",
											ease: "easeInOut",
											duration: 0.25,
										}}
									/>
								)}
								<Button onClick={() => setUserTab("all")} variant="ghost" size="xs" className={cn("h-[22px] px-2.5 rounded-[6px] text-[11px] font-semibold bg-transparent! relative z-[2] [transition:all_0.2s_ease] focus-visible:[outline:2px_solid_var(--rb-panel-accent)] focus-visible:[outline-offset:2px]", userTab === "all" ? "text-white" : "text-panel-text", userTab === "all" ? "hover:md:text-white" : "hover:md:text-panel-text")}>
									{t("dashboard.users.allUsers")}
								</Button>
							</div>
							<div className="relative">
								{userTab === "mine" && (
									<motion.div
										layoutId="usersOverviewTabPill"
										style={{
											position: "absolute",
											top: 0,
											left: 0,
											right: 0,
											bottom: 0,
											borderRadius: "6px",
											backgroundColor: "var(--rb-panel-accent)",
											border: "1px solid var(--rb-panel-accent)",
											boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
											zIndex: 1,
										}}
										transition={{
											type: "tween",
											ease: "easeInOut",
											duration: 0.25,
										}}
									/>
								)}
								<Button onClick={() => setUserTab("mine")} variant="ghost" size="xs" className={cn("h-[22px] px-2.5 rounded-[6px] text-[11px] font-semibold bg-transparent! relative z-[2] [transition:all_0.2s_ease] focus-visible:[outline:2px_solid_var(--rb-panel-accent)] focus-visible:[outline-offset:2px]", userTab === "mine" ? "text-white" : "text-panel-text", userTab === "mine" ? "hover:md:text-white" : "hover:md:text-panel-text")}>
									{t("dashboard.users.myUsers")}
								</Button>
							</div>
						</div>
					) : undefined
				}
			>
				<AnimatedHeightWrapper activeKey={userTab}>
					{canSeeGlobal && userTab === "all" ? (
						<div className="flex flex-col gap-0">
							<StatRow label={t("dashboard.users.total")} value={systemData.total_user} tagColor="#3b82f6" />
							<StatRow label={t("dashboard.users.active")} value={systemData.users_active} tag={activePercent} tagColor="#22c55e" />
							<StatRow
								label={t("dashboard.users.online")}
								value={systemData.online_users}
								tag={onlinePercent}
								tagColor="#06b6d4"
								helper={
									systemData.online_users_upload_speed || systemData.online_users_download_speed
										? `↑ ${formatBytes(systemData.online_users_upload_speed)}/s · ↓ ${formatBytes(systemData.online_users_download_speed)}/s`
										: undefined
								}
							/>
							<StatRow label={t("dashboard.users.onHold")} value={systemData.users_on_hold} tagColor="#a855f7" />
							<StatRow label={t("dashboard.users.limited")} value={systemData.users_limited} tagColor="#f59e0b" />
							<StatRow label={t("dashboard.users.expired")} value={systemData.users_expired} tagColor="#f97316" />
						</div>
					) : (
						<div className="flex flex-col gap-0">
							<StatRow label={t("dashboard.users.total")} value={myTotalUsers} tagColor="#3b82f6" />
							<StatRow label={t("dashboard.users.active")} value={myActiveUsers} tag={myActivePercent} tagColor="#22c55e" />
							<StatRow
								label={t("dashboard.users.online")}
								value={myOnlineUsers}
								tag={myOnlinePercent}
								tagColor="#06b6d4"
								helper={
									myOnlineUploadSpeed || myOnlineDownloadSpeed
										? `↑ ${formatBytes(myOnlineUploadSpeed)}/s · ↓ ${formatBytes(myOnlineDownloadSpeed)}/s`
										: undefined
								}
							/>
							<StatRow label={t("dashboard.users.onHold")} value={myOnHoldUsers} tagColor="#a855f7" />
							<StatRow label={t("dashboard.users.limited")} value={myLimitedUsers} tagColor="#f59e0b" />
							<StatRow label={t("dashboard.users.expired")} value={myExpiredUsers} tagColor="#f97316" />
							<StatRow
								label={t("dashboard.users.currentUserUsage")}
								value={formatBytes(myActiveUsersUsedTraffic, 1)}
								tagColor="#3b82f6"
							/>
							{systemData.personal_usage?.reset_bytes ? (
								<StatRow
									label={t("dashboard.users.resetData")}
									value={formatBytes(systemData.personal_usage.reset_bytes, 1)}
									tagColor="#f59e0b"
								/>
							) : null}
						</div>
					)}
				</AnimatedHeightWrapper>
			</SectionCard>

			{canSeeGlobal && systemData.admin_overview && (
				<SectionCard
					title={
						<div className="flex flex-row items-center gap-2.5">
							<div className="flex w-[26px] h-[26px] items-center justify-center rounded-[7px] bg-panel-elevated text-panel-text-secondary">
								<ShieldCheck className="w-[14px]" />
							</div>
							<span>{t("dashboard.admins")}</span>
						</div>
					}
				>
					<div className="flex flex-col gap-0">
						<StatRow label={t("dashboard.admins.total")} value={systemData.admin_overview.total_admins} tagColor="#3b82f6" />
						<StatRow label={t("dashboard.admins.fullAccess")} value={systemData.admin_overview.full_access_admins} tagColor="#f59e0b" />
						<StatRow label={t("dashboard.admins.sudo")} value={systemData.admin_overview.sudo_admins} tagColor="#a855f7" />
						<StatRow label={t("dashboard.admins.standard")} value={systemData.admin_overview.standard_admins} tagColor="#22c55e" />
						{systemData.admin_overview.top_admin_username && (
							<StatRow
								label={t("dashboard.admins.topAdmin")}
								value={`${systemData.admin_overview.top_admin_username} · ${formatBytes(systemData.admin_overview.top_admin_usage)}`}
								dimLabel
								accent
							/>
						)}
					</div>
				</SectionCard>
			)}

			<HistoryModal
				open={Boolean(historyPayload)}
				onClose={() => setHistoryPayload(null)}
				payload={historyPayload}
				intervalSeconds={historyInterval}
				onIntervalChange={setHistoryInterval}
				t={t}
				isRTL={isRTL}
			/>
		</div>
	);
};
