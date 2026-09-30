import {
	Activity,
	AlertTriangle,
	ArrowDownToLine,
	ArrowUpToLine,
	Clock,
	Cpu,
	Database,
	HardDrive,
	Loader2,
	Server,
	ShieldCheck,
	Users,
} from "lucide-react";
import {
	Area,
	AreaChart,
	CartesianGrid,
	Tooltip as RechartsTooltip,
	XAxis,
	YAxis,
} from "recharts";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { type ChartConfig, ChartContainer } from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import { useDashboard } from "contexts/DashboardContext";
import { AnimatePresence, motion } from "framer-motion";
import useGetUser from "hooks/useGetUser";
import type { TFunction } from "i18next";
import {
	type FC,
	type ReactNode,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "react-query";
import { useNavigate } from "react-router-dom";
import { fetch } from "service/http";
import { AdminRole } from "types/Admin";
import type { SystemStats } from "types/System";
import type { UsersListResponse } from "types/User";
import { formatBytes, numberWithCommas } from "utils/formatByte";
import { mergeLiveSystemStats } from "utils/systemMetrics";
import { getAPIWebSocketURL } from "utils/websocket";
import { DashboardMaintenanceControls } from "./DashboardMaintenanceControls";

export const StatisticsQueryKey = "statistics-query-key";

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
		<span
			className="text-[13px] font-bold tracking-tight text-foreground"
			dir={isRTL ? "rtl" : "ltr"}
			style={{ unicodeBidi: "isolate", fontVariantNumeric: "tabular-nums" }}
		>
			{text}
		</span>
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
				if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
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
	isOpen: boolean;
	onClose: () => void;
	payload: HistoryModalPayload | null;
	intervalSeconds: number;
	onIntervalChange: (value: number) => void;
	t: TFunction;
	isRTL?: boolean;
}> = ({ isOpen, onClose, payload, intervalSeconds, onIntervalChange, t, isRTL = false }) => {
	const [isSwitchingInterval, setIsSwitchingInterval] = useState(false);
	const tabRefs = useRef<(HTMLDivElement | null)[]>([]);
	const [pillStyle, setPillStyle] = useState<{ left: number; width: number }>({ left: 4, width: 0 });

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

	const { formattedChartData, seriesKeys } = useMemo(() => {
		if (!payload) return { formattedChartData: [], seriesKeys: [] };

		if (payload.type === "network" && payload.networkEntries) {
			const filtered = payload.networkEntries.filter((e) => e.timestamp >= cutoff);
			const rawData = filtered.length >= 1 ? filtered : payload.networkEntries;
			const finalData = expandShortData(rawData);
			const formatted = finalData.map((e) => ({
				timestamp: e.timestamp * 1000,
				timeStr: new Date(e.timestamp * 1000).toLocaleTimeString([], {
					hour12: false,
					hour: "2-digit",
					minute: "2-digit",
					second: intervalSeconds === 120 ? "2-digit" : undefined,
				}),
				incoming: e.incoming,
				outgoing: e.outgoing,
			}));
			return {
				formattedChartData: formatted,
				seriesKeys: [
					{ key: "incoming", label: t("dashboard.system.networkIncoming"), color: "#3b82f6" },
					{ key: "outgoing", label: t("dashboard.system.networkOutgoing"), color: "#10b981" },
				],
			};
		}

		if (payload.type === "panel") {
			const filteredCpu = (payload.cpuEntries || []).filter((e) => e.timestamp >= cutoff);
			const filteredMem = (payload.memoryEntries || []).filter((e) => e.timestamp >= cutoff);
			const rawCpu = filteredCpu.length >= 1 ? filteredCpu : payload.cpuEntries || [];
			const rawMem = filteredMem.length >= 1 ? filteredMem : payload.memoryEntries || [];
			const finalCpu = expandShortData(rawCpu);
			const finalMem = expandShortData(rawMem);

			const timeMap = new Map<number, { cpu?: number; memory?: number }>();
			for (const c of finalCpu) {
				timeMap.set(c.timestamp, { ...timeMap.get(c.timestamp), cpu: c.value });
			}
			for (const m of finalMem) {
				timeMap.set(m.timestamp, { ...timeMap.get(m.timestamp), memory: m.value });
			}

			const sortedTimestamps = Array.from(timeMap.keys()).sort((a, b) => a - b);
			const formatted = sortedTimestamps.map((ts) => ({
				timestamp: ts * 1000,
				timeStr: new Date(ts * 1000).toLocaleTimeString([], {
					hour12: false,
					hour: "2-digit",
					minute: "2-digit",
					second: intervalSeconds === 120 ? "2-digit" : undefined,
				}),
				cpu: timeMap.get(ts)?.cpu ?? 0,
				memory: timeMap.get(ts)?.memory ?? 0,
			}));

			return {
				formattedChartData: formatted,
				seriesKeys: [
					{ key: "cpu", label: `${t("dashboard.system.cpuUsage")} (Panel CPU %)`, color: "var(--primary)" },
					{ key: "memory", label: `${t("dashboard.system.memoryUsage")} (Panel RAM %)`, color: "#8b5cf6" },
				],
			};
		}

		if (payload.entries) {
			const filtered = payload.entries.filter((e) => e.timestamp >= cutoff);
			const rawEntries = filtered.length >= 1 ? filtered : payload.entries;
			const finalEntries = expandShortData(rawEntries);
			const formatted = finalEntries.map((e) => ({
				timestamp: e.timestamp * 1000,
				timeStr: new Date(e.timestamp * 1000).toLocaleTimeString([], {
					hour12: false,
					hour: "2-digit",
					minute: "2-digit",
					second: intervalSeconds === 120 ? "2-digit" : undefined,
				}),
				value: e.value,
			}));
			return {
				formattedChartData: formatted,
				seriesKeys: [
					{
						key: "value",
						label: payload.metricLabel ?? payload.title,
						color: "var(--primary)",
					},
				],
			};
		}

		return { formattedChartData: [], seriesKeys: [] };
	}, [payload, cutoff, intervalSeconds, t]);

	const hasEnoughPoints = formattedChartData.length >= 2;
	const isNetwork = payload?.type === "network";

	const chartConfig = useMemo(() => {
		const cfg: ChartConfig = {};
		for (const s of seriesKeys) {
			cfg[s.key] = {
				label: s.label,
				color: s.color,
			};
		}
		return cfg;
	}, [seriesKeys]);

	return (
		<Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="max-w-2xl overflow-hidden rounded-xl border border-border bg-card p-0 shadow-2xl">
				<DialogHeader className="flex flex-row items-center justify-between border-b border-border px-5 py-4">
					<DialogTitle className="text-sm font-bold text-foreground">
						{t("dashboard.history.modalTitle", { metric: payload?.title ?? "" })}
					</DialogTitle>
				</DialogHeader>

				<div className="flex flex-col space-y-4 p-5">
					{hasEnoughPoints && (
						<div
							className="relative inline-flex max-w-full items-center overflow-x-auto rounded-full bg-secondary p-1"
							style={{ scrollbarWidth: "none" }}
						>
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
									className="absolute bottom-1 top-1 z-0 rounded-full bg-card shadow-sm pointer-events-none"
								/>
							)}
							{HISTORY_INTERVALS.map((interval, idx) => {
								const isAvailable = idx === 0 || availableSpan >= interval.seconds * 0.5;
								const isActive = intervalSeconds === interval.seconds;
								return (
									<div
										key={interval.seconds}
										ref={(el) => {
											tabRefs.current[idx] = el;
										}}
										className="relative z-10 inline-flex flex-1 sm:flex-none items-center justify-center"
									>
										<Button
											variant="ghost"
											size="xs"
											className={cn(
												"h-6.5 w-full rounded-full px-3 text-[11px] font-semibold transition-all duration-200",
												isActive ? "text-foreground font-bold" : "text-muted-foreground",
												!isAvailable && "opacity-40 cursor-not-allowed",
											)}
											onClick={() => {
												if (isAvailable && intervalSeconds !== interval.seconds) {
													setIsSwitchingInterval(true);
													onIntervalChange(interval.seconds);
													setTimeout(() => setIsSwitchingInterval(false), 200);
												}
											}}
										>
											{t(interval.labelKey)}
										</Button>
									</div>
								);
							})}
						</div>
					)}

					<div className="relative min-h-[300px] w-full" dir="ltr">
						<AnimatePresence>
							{isSwitchingInterval && (
								<motion.div
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									exit={{ opacity: 0 }}
									transition={{ duration: 0.15 }}
									className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-background/70"
								>
									<Loader2 className="h-6 w-6 animate-spin text-primary" />
								</motion.div>
							)}
						</AnimatePresence>

						{hasEnoughPoints ? (
							<ChartContainer config={chartConfig} className="h-[300px] w-full aspect-auto">
								<AreaChart data={formattedChartData as any} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
									<defs>
										{seriesKeys.map((s) => (
											<linearGradient key={s.key} id={`fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
												<stop offset="5%" stopColor={s.color} stopOpacity={0.3} />
												<stop offset="95%" stopColor={s.color} stopOpacity={0.02} />
											</linearGradient>
										))}
									</defs>
									<CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.4} />
									<XAxis
										dataKey="timeStr"
										tickLine={false}
										axisLine={false}
										tickMargin={8}
										tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
									/>
									<YAxis
										tickLine={false}
										axisLine={false}
										tickMargin={8}
										tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
										tickFormatter={(val: number) => {
											if (isNetwork) return formatBytes(val, 0);
											return `${Math.round(val)}%`;
										}}
									/>
									<RechartsTooltip
										content={({ active, payload: activePayload }) => {
											if (!active || !activePayload || !activePayload.length) return null;
											const dataItem = activePayload[0]?.payload;
											return (
												<div
													className="rounded-lg border border-border bg-card p-2.5 shadow-xl text-xs"
													dir={isRTL ? "rtl" : "ltr"}
												>
													<div className="border-b border-border pb-1 mb-1.5 text-[10px] font-semibold text-muted-foreground">
														{dataItem?.timeStr}
													</div>
													<div className="flex flex-col space-y-1">
														{activePayload.map((entry: any) => {
															const formattedVal = isNetwork
																? `${formatBytes(Number(entry.value), 2)}/s`
																: `${Math.round(Number(entry.value) * 10) / 10}%`;
															return (
																<div key={entry.dataKey} className="flex items-center justify-between gap-3">
																	<div className="flex items-center gap-1.5">
																		<span
																			className="h-2 w-2 rounded-full flex-shrink-0"
																			style={{ backgroundColor: entry.color }}
																		/>
																		<span className="text-muted-foreground">
																			{chartConfig[entry.dataKey]?.label ?? entry.dataKey}
																		</span>
																	</div>
																	<span
																		className="font-bold tabular-nums text-foreground"
																		dir="ltr"
																	>
																		{formattedVal}
																	</span>
																</div>
															);
														})}
													</div>
												</div>
											);
										}}
									/>
									{seriesKeys.map((s) => (
										<Area
											key={s.key}
											type="monotone"
											dataKey={s.key}
											stroke={s.color}
											strokeWidth={2}
											fillOpacity={1}
											fill={`url(#fill-${s.key})`}
										/>
									))}
								</AreaChart>
							</ChartContainer>
						) : (
							<div className="flex h-[300px] w-full flex-col items-center justify-center gap-2">
								<span className="text-xs text-muted-foreground">{t("noData")}</span>
							</div>
						)}
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
	const safe = clampPercent(percent);
	const criticalColorClass = safe >= 90 ? "bg-destructive" : safe >= 75 ? "bg-amber-500" : "bg-primary";

	return (
		<Card className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-border bg-card p-4 sm:p-5 transition-all duration-200 md:hover:border-border/80 md:hover:bg-secondary/40 shadow-sm">
			<div>
				<div className="flex items-center justify-between mb-3">
					<div className="flex items-center gap-2.5">
						<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-secondary text-muted-foreground">
							{icon}
						</div>
						<span className="truncate text-xs font-semibold text-muted-foreground">
							{label}
						</span>
					</div>
					{onHistory && (
						<Button
							variant="ghost"
							size="xs"
							className="h-6 rounded-full bg-secondary px-2.5 text-[11px] font-semibold text-muted-foreground md:group-hover:bg-card md:hover:text-foreground md:hover:bg-border/60 transition-all duration-200 active:scale-95"
							onClick={onHistory}
						>
							{historyLabel}
						</Button>
					)}
				</div>

				<div className="flex items-baseline gap-1.5 mb-1 flex-wrap">
					{totalValue ? (
						<div
							className="flex items-baseline gap-1.5"
							dir="ltr"
							style={{ unicodeBidi: "isolate" }}
						>
							<span className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground tabular-nums leading-none">
								{value}
							</span>
							<span className="text-xs font-semibold text-muted-foreground tabular-nums">
								/ {totalValue}
							</span>
						</div>
					) : (
						<div className="flex items-baseline gap-1.5 flex-wrap">
							<span
								className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground tabular-nums leading-none"
								dir="ltr"
								style={{ unicodeBidi: "isolate" }}
							>
								{value}
							</span>
							{metaValue !== undefined && metaUnit && (
								<div
									className="flex items-center gap-1"
									dir={isRTL ? "rtl" : "ltr"}
									style={{ unicodeBidi: "isolate" }}
								>
									<span
										className="text-xs font-semibold text-muted-foreground tabular-nums"
										dir="ltr"
										style={{ unicodeBidi: "isolate" }}
									>
										{metaValue}
									</span>
									<span className="text-[11px] font-semibold text-muted-foreground">
										{metaUnit}
									</span>
								</div>
							)}
						</div>
					)}
				</div>
				{subMeta && <div className="mt-1">{subMeta}</div>}
			</div>

			<div className="mt-3">
				<div className="flex items-center justify-between mb-1.5">
					<span
						className="text-[11px] font-semibold text-muted-foreground tabular-nums"
						dir="ltr"
						style={{ unicodeBidi: "isolate" }}
					>
						{formatPercent(safe, false)}
					</span>
				</div>
				<Progress value={safe} indicatorClassName={criticalColorClass} className="h-1.5" />
				{(footerLeft || footerRight) && (
					<div
						className="flex items-center justify-between mt-2.5 text-[11px] font-medium text-muted-foreground"
						dir={isRTL ? "rtl" : "ltr"}
						style={{ unicodeBidi: "isolate", fontVariantNumeric: "tabular-nums" }}
					>
						<span className="truncate">{footerLeft}</span>
						<span className="truncate">{footerRight}</span>
					</div>
				)}
			</div>
		</Card>
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
	return (
		<div className="flex items-center justify-between py-2.5 border-b border-border last:border-b-0 gap-3">
			<div className="flex items-center gap-2.5 min-w-0 flex-nowrap">
				{tagColor && (
					<span
						className="h-2 w-2 shrink-0 rounded-full"
						style={{ backgroundColor: tagColor, boxShadow: `0 0 6px ${tagColor}88` }}
					/>
				)}
				<span
					className={cn(
						"truncate text-xs font-semibold",
						dimLabel ? "text-muted-foreground" : "text-foreground/80",
					)}
				>
					{label}
				</span>
				{tag && (
					<span
						className="inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[10px] font-semibold bg-secondary text-muted-foreground"
						dir="ltr"
					>
						<span dir="ltr" style={{ fontVariantNumeric: "tabular-nums" }}>
							{tag.endsWith("%") ? `${tag.slice(0, -1)}%` : tag}
						</span>
					</span>
				)}
			</div>
			<div className="flex flex-col items-end shrink-0">
				<span
					className={cn(
						"text-xs font-bold tabular-nums",
						accent ? "text-primary" : "text-foreground",
					)}
					dir="ltr"
					style={{ fontVariantNumeric: "tabular-nums", unicodeBidi: "isolate" }}
				>
					{typeof value === "number" ? formatNumberValue(value) : value}
				</span>
				{helper && (
					<span
						className="text-[10px] font-medium text-muted-foreground tabular-nums mt-0.5"
						dir="ltr"
						style={{ fontVariantNumeric: "tabular-nums", unicodeBidi: "isolate" }}
					>
						{helper}
					</span>
				)}
			</div>
		</div>
	);
};

const SectionCard: FC<{
	title: ReactNode;
	action?: ReactNode;
	children: ReactNode;
	noHover?: boolean;
	roleGroup?: boolean;
}> = ({ title, action, children }) => {
	return (
		<Card className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-sm transition-all duration-200">
			<CardHeader className="flex flex-row items-center justify-between p-0 pb-3 border-b border-border">
				<CardTitle className="text-xs font-bold text-foreground">
					{title}
				</CardTitle>
				{action && <div>{action}</div>}
			</CardHeader>
			<CardContent className="p-0 pt-3">{children}</CardContent>
		</Card>
	);
};

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
				duration: 0.5,
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
			<div className="flex items-center gap-2.5 text-muted-foreground">
				<div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-secondary">
					{icon}
				</div>
				<span className="text-xs font-semibold text-muted-foreground">
					{label}
				</span>
			</div>
			<span
				className="text-xs font-bold tracking-tight text-foreground tabular-nums"
				dir="ltr"
				style={{ fontVariantNumeric: "tabular-nums", unicodeBidi: "isolate" }}
			>
				{value}
			</span>
		</div>
	);
};

export const Statistics: FC<{ className?: string }> = ({ className }) => {
	const navigate = useNavigate();
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
				query: { admin: userData.username, limit: 1000 },
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

	if (!systemData) {
		return (
			<div className={cn("flex flex-col space-y-5 w-full", className)} dir={isRTL ? "rtl" : "ltr"}>
				<div className="flex flex-wrap items-center justify-between gap-3 px-1">
					<div className="flex flex-col items-start gap-1">
						<Skeleton className="h-6 w-36 rounded-md" />
						<div className="flex items-center gap-1.5">
							<Skeleton className="h-4 w-16 rounded-full" />
							<Skeleton className="h-4 w-20 rounded-full" />
							<Skeleton className="h-4 w-16 rounded-full" />
						</div>
					</div>
					<div className="flex items-center gap-2">
						<Skeleton className="h-8 w-28 rounded-full" />
						<Skeleton className="h-8 w-24 rounded-full" />
					</div>
				</div>

				<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
					{[1, 2, 3, 4].map((i) => (
						<Card key={i} className="flex flex-col justify-between p-5 rounded-xl border border-border bg-card">
							<div>
								<div className="flex items-center justify-between mb-3">
									<div className="flex items-center gap-2.5">
										<Skeleton className="h-8 w-8 rounded-md" />
										<Skeleton className="h-4 w-24 rounded" />
									</div>
								</div>
								<div className="flex items-baseline gap-1.5 mb-1">
									<Skeleton className="h-7 w-20 rounded" />
									<Skeleton className="h-4 w-12 rounded" />
								</div>
							</div>
							<div className="mt-3 space-y-2">
								<Skeleton className="h-1.5 w-full rounded-full" />
								<div className="flex justify-between pt-1">
									<Skeleton className="h-3 w-16 rounded" />
									<Skeleton className="h-3 w-16 rounded" />
								</div>
							</div>
						</Card>
					))}
				</div>

				<Card className="rounded-xl border border-border bg-card p-5">
					<div className="flex items-center justify-between pb-3 border-b border-border">
						<Skeleton className="h-5 w-24 rounded" />
						<Skeleton className="h-6 w-32 rounded-full" />
					</div>
					<div className="divide-y divide-border pt-2 space-y-3">
						{[1, 2, 3, 4, 5].map((idx) => (
							<div key={idx} className="flex items-center justify-between pt-3">
								<Skeleton className="h-4 w-28 rounded" />
								<Skeleton className="h-4 w-16 rounded" />
							</div>
						))}
					</div>
				</Card>
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
		<div className={cn("flex flex-col space-y-5 w-full", className)} dir={isRTL ? "rtl" : "ltr"}>
			<div className="flex flex-wrap items-center justify-between gap-3 px-1">
				<div className="flex flex-col items-start gap-1">
					<span className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
						{t("dashboard.system.overview")}
					</span>
					<div className="flex items-center gap-2 flex-row">
						<span
							className={cn(
								"h-2 w-2 rounded-full",
								systemData.xray_running ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" : "bg-destructive shadow-[0_0_6px_rgba(239,68,68,0.5)]",
							)}
						/>
						<span className="text-xs font-semibold text-muted-foreground">
							{systemData.xray_running ? t("dashboard.system.statusRunning") : t("dashboard.system.statusStopped")}
						</span>
						{systemData.os && (
							<div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
								<span>·</span>
								<span dir="ltr" style={{ unicodeBidi: "isolate" }}>
									{systemData.os}
								</span>
							</div>
						)}
						{exactVersion && exactVersion !== "-" && (
							<div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
								<span>·</span>
								<span dir="ltr" style={{ unicodeBidi: "isolate" }}>
									{exactVersion}
								</span>
							</div>
						)}
					</div>
				</div>
				<DashboardMaintenanceControls channel={systemData.channel} version={systemData.version} />
			</div>

			<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
				<ResourceCard
					label={t("dashboard.system.cpuUsage")}
					icon={<Cpu className="h-4 w-4" />}
					value={formatPercent(systemData.cpu_usage, false)}
					percent={systemData.cpu_usage}
					metaValue={formatNumberValue(systemData.cpu_cores)}
					metaUnit={t("dashboard.system.core")}
					subMeta={
						systemData.load_avg && systemData.load_avg.length >= 3 ? (
							<div
								className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground"
								dir={isRTL ? "rtl" : "ltr"}
							>
								<span>{t("loadAverage")}:</span>
								<span dir="ltr" style={{ fontVariantNumeric: "tabular-nums", unicodeBidi: "isolate" }}>
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
					icon={<Server className="h-4 w-4" />}
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
					icon={<Database className="h-4 w-4" />}
					value={formatBytes(systemData.swap.current, 1)}
					totalValue={formatBytes(systemData.swap.total, 1)}
					percent={systemData.swap.percent}
					footerLeft={`${t("dashboard.system.average")}: ${formatPercent(average(systemData.swap_history.map((e) => e.value)), isRTL)}`}
					footerRight={`${t("dashboard.system.peak")}: ${formatPercent(peak(systemData.swap_history.map((e) => e.value)), isRTL)}`}
					isRTL={isRTL}
				/>
				<ResourceCard
					label={t("dashboard.system.diskUsage")}
					icon={<HardDrive className="h-4 w-4" />}
					value={formatBytes(systemData.disk.current, 1)}
					totalValue={formatBytes(systemData.disk.total, 1)}
					percent={systemData.disk.percent}
					footerLeft={`${t("dashboard.system.free")}: ${formatBytes(Math.max(0, systemData.disk.total - systemData.disk.current), 1)}`}
					footerRight={`${t("dashboard.system.average")}: ${formatPercent(average(systemData.disk_history.map((e) => e.value)), isRTL)}`}
					isRTL={isRTL}
				/>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
				<SectionCard
					title={
						<div className="flex items-center gap-2.5">
							<div className="flex h-6.5 w-6.5 items-center justify-center rounded-md bg-secondary text-muted-foreground">
								<Activity className="h-3.5 w-3.5" />
							</div>
							<span>{t("dashboard.system.bandwidthSpeed")}</span>
						</div>
					}
					action={
						<Button
							variant="ghost"
							size="xs"
							className="h-6 rounded-full bg-secondary px-2.5 text-[11px] font-semibold text-muted-foreground md:hover:bg-border/60 transition-all duration-200"
							onClick={() =>
								openHistory({
									type: "network",
									title: t("dashboard.system.bandwidthSpeed"),
									networkEntries: systemData.network_history,
								})
							}
						>
							{t("dashboard.system.viewHistory")}
						</Button>
					}
				>
					<div className="flex flex-col space-y-3">
						<SpeedItem
							icon={<ArrowDownToLine className="h-3.5 w-3.5" />}
							label={t("dashboard.system.incomingSpeed")}
							value={`${formatBytes(systemData.incoming_bandwidth_speed)}/s`}
						/>
						<SpeedItem
							icon={<ArrowUpToLine className="h-3.5 w-3.5" />}
							label={t("dashboard.system.outgoingSpeed")}
							value={`${formatBytes(systemData.outgoing_bandwidth_speed)}/s`}
						/>
					</div>
				</SectionCard>

				<SectionCard
					title={
						<div className="flex items-center gap-2.5">
							<div className="flex h-6.5 w-6.5 items-center justify-center rounded-md bg-secondary text-muted-foreground">
								<Clock className="h-3.5 w-3.5" />
							</div>
							<span>{t("dashboard.system.uptime")}</span>
						</div>
					}
				>
					<div className="flex flex-col space-y-3">
						<div className="flex items-center justify-between gap-3">
							<div className="flex items-center gap-2.5 text-muted-foreground">
								<div className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary flex-shrink-0">
									<Server className="h-3.5 w-3.5" />
								</div>
								<span className="text-xs font-semibold text-muted-foreground">
									{t("dashboard.system.systemUptime")}
								</span>
							</div>
							{formatLocalizedDuration(systemData.uptime_seconds, t, isRTL)}
						</div>
						<div className="flex items-center justify-between gap-3">
							<div className="flex items-center gap-2.5 text-muted-foreground">
								<div className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary flex-shrink-0">
									<Database className="h-3.5 w-3.5" />
								</div>
								<span className="text-xs font-semibold text-muted-foreground">
									{t("dashboard.system.panelUptime")}
								</span>
							</div>
							{formatLocalizedDuration(systemData.panel_uptime_seconds, t, isRTL)}
						</div>
					</div>
				</SectionCard>
			</div>

			{(systemData.last_xray_error || systemData.last_telegram_error) && (
				<div className="flex flex-col space-y-3">
					{systemData.last_xray_error && (
						<div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-destructive">
							<div className="flex items-center gap-2 mb-2">
								<AlertTriangle className="h-4 w-4" />
								<span className="text-xs font-bold">{t("dashboard.system.coreError")}</span>
							</div>
							<p className="text-xs font-mono break-all opacity-90 leading-relaxed">
								{systemData.last_xray_error}
							</p>
						</div>
					)}
					{systemData.last_telegram_error && (
						<div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-500">
							<div className="flex items-center justify-between mb-2 flex-wrap gap-2">
								<div className="flex items-center gap-2">
									<AlertTriangle className="h-4 w-4" />
									<span className="text-xs font-bold">{t("dashboard.system.telegramError")}</span>
								</div>
								<Button
									variant="ghost"
									size="xs"
									className="h-6 rounded-full px-2.5 text-[11px] font-semibold text-amber-500 hover:bg-amber-500/20"
									onClick={() => navigate("/settings#telegram")}
								>
									{t("dashboard.system.goToTelegramSettings")}
								</Button>
							</div>
							<p className="text-xs font-mono break-all opacity-90 leading-relaxed">
								{systemData.last_telegram_error}
							</p>
						</div>
					)}
				</div>
			)}

			<SectionCard
				noHover
				roleGroup={false}
				title={
					<div className="flex items-center gap-2.5">
						<div className="flex h-6.5 w-6.5 items-center justify-center rounded-md bg-secondary text-muted-foreground">
							<Cpu className="h-3.5 w-3.5" />
						</div>
						<span>{t("dashboard.system.panelUsage")}</span>
					</div>
				}
				action={
					<Button
						variant="ghost"
						size="xs"
						className="h-6 rounded-full bg-secondary px-2.5 text-[11px] font-semibold text-muted-foreground md:hover:bg-border/60 transition-all duration-200"
						onClick={() =>
							openHistory({
								type: "panel",
								title: t("dashboard.system.panelUsage"),
								cpuEntries: systemData.panel_cpu_history,
								memoryEntries: systemData.panel_memory_history,
							})
						}
					>
						{t("dashboard.system.viewHistory")}
					</Button>
				}
			>
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
					<ResourceCard
						label={`${t("dashboard.system.cpuUsage")} (Panel)`}
						icon={<Cpu className="h-4 w-4" />}
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
						icon={<Server className="h-4 w-4" />}
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
					<div className="flex items-center gap-2.5">
						<div className="flex h-6.5 w-6.5 items-center justify-center rounded-md bg-secondary text-muted-foreground">
							<Users className="h-3.5 w-3.5" />
						</div>
						<span>{t("dashboard.users")}</span>
					</div>
				}
				action={
					canSeeGlobal ? (
						<div className="relative inline-flex items-center rounded-lg bg-secondary p-0.5">
							<div className="relative">
								{userTab === "all" && (
									<motion.div
										layoutId="usersOverviewTabPill"
										className="absolute inset-0 rounded-md bg-primary shadow-sm z-0"
										transition={{
											type: "tween",
											ease: "easeInOut",
											duration: 0.25,
										}}
									/>
								)}
								<Button
									variant="ghost"
									size="xs"
									className={cn(
										"relative z-10 h-6 px-3 rounded-md text-[11px] font-semibold transition-colors",
										userTab === "all" ? "text-primary-foreground font-bold" : "text-muted-foreground",
									)}
									onClick={() => setUserTab("all")}
								>
									{t("dashboard.users.allUsers")}
								</Button>
							</div>
							<div className="relative">
								{userTab === "mine" && (
									<motion.div
										layoutId="usersOverviewTabPill"
										className="absolute inset-0 rounded-md bg-primary shadow-sm z-0"
										transition={{
											type: "tween",
											ease: "easeInOut",
											duration: 0.25,
										}}
									/>
								)}
								<Button
									variant="ghost"
									size="xs"
									className={cn(
										"relative z-10 h-6 px-3 rounded-md text-[11px] font-semibold transition-colors",
										userTab === "mine" ? "text-primary-foreground font-bold" : "text-muted-foreground",
									)}
									onClick={() => setUserTab("mine")}
								>
									{t("dashboard.users.myUsers")}
								</Button>
							</div>
						</div>
					) : undefined
				}
			>
				<AnimatedHeightWrapper activeKey={userTab}>
					{canSeeGlobal && userTab === "all" ? (
						<div className="flex flex-col">
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
						<div className="flex flex-col">
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
						<div className="flex items-center gap-2.5">
							<div className="flex h-6.5 w-6.5 items-center justify-center rounded-md bg-secondary text-muted-foreground">
								<ShieldCheck className="h-3.5 w-3.5" />
							</div>
							<span>{t("dashboard.admins")}</span>
						</div>
					}
				>
					<div className="flex flex-col">
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
				isOpen={Boolean(historyPayload)}
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