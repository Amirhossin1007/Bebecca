import { useColorMode } from "lib/color-mode";
import { Tag } from "components/shadcn/badge";
import { Button } from "components/shadcn/button";
import { cn } from "lib/cn";
import {
	PanelSelect as Select,
	type PanelSelectProps as SelectProps,
} from "components/common/PanelSelect";
import { SearchInput } from "components/common/SearchInput";
import { ResourceListCard } from "components/ui";
import { useNodesQuery } from "contexts/NodesContext";
import useGetUser from "hooks/useGetUser";
import React, {
	type FC,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useTranslation } from "react-i18next";
import useWebSocket from "react-use-websocket";
import { fetch } from "service/http";
import type { RawInbound } from "utils/inbounds";
import { DEFAULT_SEARCH_MATCH_OPTIONS, matchesSearch } from "utils/searchMatch";
import { getAPIWebSocketURL } from "utils/websocket";

const MAX_NUMBER_OF_LOGS = 500;
const LOG_FLUSH_INTERVAL = 100;

type LogEntry = {
	id: number;
	message: string;
};

const getWebsocketUrl = (nodeID: string) => {
	if (!nodeID) return null;
	return getAPIWebSocketURL(`/node/${nodeID}/logs`, { interval: 1 });
};

interface XrayLogsPageProps {
	showTitle?: boolean;
}

const CompactLogSelect = (props: SelectProps) => (
	<Select size="sm" {...props} className="h-[36px] rounded-[4px] border-panel-border! bg-panel-input text-panel-text focus-visible:border-panel-accent! focus-visible:shadow-[0_0_0_1px_var(--rb-panel-accent)]" />
);

export const XrayLogsPage: FC<XrayLogsPageProps> = ({ showTitle = true }) => {
	const { t } = useTranslation();
	const { userData, getUserIsSuccess } = useGetUser();
	const canViewXrayLogs =
		getUserIsSuccess && Boolean(userData.permissions?.sections.xray);
	const { data: nodes } = useNodesQuery({ enabled: canViewXrayLogs });
	const [selectedNode, setNode] = useState<string>("");
	const [logs, setLogs] = useState<LogEntry[]>([]);
	const pendingLogs = useRef<LogEntry[]>([]);
	const flushTimer = useRef<number | null>(null);
	const nextLogID = useRef(0);
	const [searchFilter, setSearchFilter] = useState<string>("");
	const [searchMatch, setSearchMatch] = useState(DEFAULT_SEARCH_MATCH_OPTIONS);
	const [selectedInbound, setSelectedInbound] = useState<string>("");
	const [inbounds, setInbounds] = useState<RawInbound[]>([]);
	const [inboundsLoading, setInboundsLoading] = useState(false);
	const logsDiv = useRef<HTMLDivElement | null>(null);
	const [autoScroll, setAutoScroll] = useState(true);
	const autoScrollRef = useRef(true);
	const { colorMode } = useColorMode();

	// Fetch inbounds list
	useEffect(() => {
		if (!canViewXrayLogs) return;
		setInboundsLoading(true);
		fetch<RawInbound[]>("/inbounds/full")
			.then((data) => {
				setInbounds(data || []);
			})
			.catch((err) => {
				console.error("Failed to fetch inbounds:", err);
				setInbounds([]);
			})
			.finally(() => {
				setInboundsLoading(false);
			});
	}, [canViewXrayLogs]);

	const handleLog = (id: string) => {
		if (id === selectedNode) return;
		setNode(id);
		pendingLogs.current = [];
		setLogs([]);
	};

	useEffect(() => {
		if (!nodes?.length) {
			if (selectedNode) {
				setNode("");
				setLogs([]);
			}
			return;
		}
		if (
			!selectedNode ||
			!nodes.some((node) => String(node.id) === selectedNode)
		) {
			setNode(String(nodes[0].id));
			setLogs([]);
		}
	}, [nodes, selectedNode]);

	const flushLogs = useCallback(() => {
		flushTimer.current = null;
		const batch = pendingLogs.current;
		pendingLogs.current = [];
		if (batch.length === 0) return;
		setLogs((current) => [...current, ...batch].slice(-MAX_NUMBER_OF_LOGS));
		window.requestAnimationFrame(() => {
			if (autoScrollRef.current && logsDiv.current) {
				logsDiv.current.scrollTop = logsDiv.current.scrollHeight;
			}
		});
	}, []);

	const appendLog = useCallback(
		(line: string) => {
			pendingLogs.current.push({ id: nextLogID.current++, message: line });
			if (flushTimer.current === null) {
				flushTimer.current = window.setTimeout(flushLogs, LOG_FLUSH_INTERVAL);
			}
		},
		[flushLogs],
	);

	const clearLogs = useCallback(() => {
		pendingLogs.current = [];
		setLogs([]);
	}, []);

	useEffect(() => {
		return () => {
			if (flushTimer.current !== null) {
				window.clearTimeout(flushTimer.current);
			}
		};
	}, []);

	const socketUrl = useMemo(
		() => (canViewXrayLogs ? getWebsocketUrl(selectedNode) : null),
		[canViewXrayLogs, selectedNode],
	);

	const { readyState } = useWebSocket(
		socketUrl,
		{
			onMessage: (e: any) => {
				appendLog(e.data ?? "");
			},
			shouldReconnect: () => Boolean(socketUrl),
			reconnectAttempts: 10,
			reconnectInterval: 1000,
		},
		Boolean(socketUrl),
	);

	useEffect(() => {
		const element = logsDiv.current;
		if (!element) return;
		const handleScroll = () => {
			const threshold = 32;
			const isAtBottom =
				element.scrollHeight - element.scrollTop - element.clientHeight <=
				threshold;
			autoScrollRef.current = isAtBottom;
			setAutoScroll(isAtBottom);
		};
		element.addEventListener("scroll", handleScroll);
		handleScroll();
		return () => {
			element.removeEventListener("scroll", handleScroll);
		};
	}, []);

	const logPalette = useMemo(() => {
		const isDark = colorMode === "dark";
		return {
			error: {
				bg: isDark ? "rgba(239, 68, 68, 0.2)" : "rgba(254, 226, 226, 0.8)",
				color: isDark ? "#fca5a5" : "#dc2626",
				border: isDark ? "#ef4444" : "#dc2626",
			},
			warn: {
				bg: isDark ? "rgba(234, 179, 8, 0.2)" : "rgba(254, 243, 199, 0.8)",
				color: isDark ? "#fde047" : "#ca8a04",
				border: isDark ? "#eab308" : "#facc15",
			},
			success: {
				bg: isDark ? "rgba(34, 197, 94, 0.2)" : "rgba(209, 250, 229, 0.8)",
				color: isDark ? "#86efac" : "#16a34a",
				border: isDark ? "#22c55e" : "#22c55e",
			},
			info: {
				bg: isDark ? "rgba(59, 130, 246, 0.2)" : "rgba(219, 234, 254, 0.85)",
				color: isDark ? "#93c5fd" : "#2563eb",
				border: isDark ? "#3b82f6" : "#3b82f6",
			},
			debug: {
				bg: isDark ? "rgba(148, 163, 184, 0.16)" : "rgba(241, 245, 249, 0.8)",
				color: isDark ? "#cbd5e1" : "#475569",
				border: isDark ? "#94a3b8" : "#94a3b8",
			},
			default: {
				bg: isDark ? "rgba(51, 65, 85, 0.1)" : "rgba(248, 250, 252, 0.8)",
				color: isDark ? "#e2e8f0" : "#64748b",
				border: isDark ? "#475569" : "#cbd5e1",
			},
		};
	}, [colorMode]);

	const badgeColor = "text-panel-text-muted";
	const socketColorScheme =
		readyState === 1 ? "green" : readyState === 0 ? "yellow" : "gray";
	const socketStatusLabel = useMemo(() => {
		if (readyState === 0) return t("core.socket.connecting");
		if (readyState === 1) return t("core.socket.connected");
		if (readyState === 2 || readyState === 3) return t("core.socket.closed");
		return t("core.socket.not_connected");
	}, [readyState, t]);

	// Get selected inbound tag
	const selectedInboundTag = useMemo(() => {
		if (!selectedInbound) return null;
		const inbound = inbounds.find((inv) => inv.tag === selectedInbound);
		return inbound?.tag || null;
	}, [selectedInbound, inbounds]);

	// Filter logs based on search and inbound
	const filteredLogs = useMemo(() => {
		let filtered = logs;

		// Filter by inbound tag if selected
		if (selectedInboundTag) {
			filtered = filtered.filter((log) => {
				const logLower = log.message.toLowerCase();
				return logLower.includes(selectedInboundTag.toLowerCase());
			});
		}

		// Filter by search text if provided
		if (searchFilter.trim()) {
			filtered = filtered.filter((log) =>
				matchesSearch(log.message, searchFilter, searchMatch),
			);
		}

		return filtered;
	}, [logs, searchFilter, searchMatch, selectedInboundTag]);

	const classifyLog = (message: string) => {
		const lowerMessage = message.toLowerCase();
		// Prefer explicit Xray level markers when present: [Info], [Warning], [Error], ...
		const explicitMatch = message.match(
			/\[(debug|info|warning|warn|error|fatal|panic|critical)\]/i,
		);
		if (explicitMatch?.[1]) {
			const explicit = explicitMatch[1].toLowerCase();
			if (["error", "fatal", "panic", "critical"].includes(explicit)) {
				return "error" as const;
			}
			if (["warning", "warn"].includes(explicit)) {
				return "warn" as const;
			}
			if (explicit === "debug") {
				return "debug" as const;
			}
			return "info" as const;
		}

		// Startup banners and successful starts should be green/success.
		if (
			/^xray\s+\d+/i.test(message) ||
			/unified platform for anti-censorship/i.test(lowerMessage) ||
			/core:\s*xray.*started/i.test(lowerMessage)
		) {
			return "success" as const;
		}

		// Check for error patterns first (most critical)
		if (/error|failed|exception|fatal|panic|critical/i.test(lowerMessage)) {
			return "error" as const;
		}
		// Check for warning patterns
		if (/warn|warning|deprecated/i.test(lowerMessage)) {
			return "warn" as const;
		}
		// Check for success/info patterns
		if (/success|connected|started|stopped/i.test(lowerMessage)) {
			return "success" as const;
		}
		if (/info|information/i.test(lowerMessage)) {
			return "info" as const;
		}
		// Check for debug patterns
		if (/debug|trace|verbose/i.test(lowerMessage)) {
			return "debug" as const;
		}
		return "default" as const;
	};

	if (!canViewXrayLogs) {
		return (
			<div className="flex flex-col gap-4 items-stretch">
				{showTitle && (
					<h1 className="font-semibold text-[1.5rem]">
						{t("xrayLogs.title")}
					</h1>
				)}
				<p className="text-[0.875rem] text-gray-500 dark:text-gray-400">
					{t("xrayLogs.noPermission")}
				</p>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-4 items-stretch">
			<ResourceListCard
				title={t("xrayLogs.stream")}
				summaryItems={[
					{ label: t("total"), value: logs.length },
					{
						label: t("xrayLogs.visible"),
						value: filteredLogs.length,
						colorScheme: searchFilter || selectedInbound ? "blue" : "gray",
					},
					{
						label: t("xrayLogs.socket"),
						value: socketStatusLabel,
						colorScheme: socketColorScheme,
					},
				]}
				actions={
					<div className="flex flex-row items-center gap-2 flex-wrap justify-end">
						<Tag size="sm" colorScheme={autoScroll ? "green" : "gray"} variant="subtle">
							{autoScroll ? t("core.autoScrollOn") : t("core.autoScrollOff")}
						</Tag>
						<Button size="sm" variant="outline" disabled={logs.length === 0} onClick={clearLogs} className="h-[36px] px-3">
							{t("clear")}
						</Button>
					</div>
				}
			>
				<div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center flex-wrap">
					<CompactLogSelect onChange={(e) => handleLog(e.target.value)} value={selectedNode} disabled={!nodes?.length} className="w-full sm:w-[220px]">
						{nodes?.length ? (
							nodes.map((node) => (
								<option key={node.id} value={String(node.id)}>
									{node.name || node.address}
								</option>
							))
						) : (
							<option value="">{t("nodes.noNodes")}</option>
						)}
					</CompactLogSelect>
					<CompactLogSelect onChange={(e) => setSelectedInbound(e.target.value)} value={selectedInbound} disabled={inboundsLoading || inbounds.length === 0} className="w-full sm:w-[220px]">
						<option value="">{t("xrayLogs.allInbounds")}</option>
						{inbounds.map((inbound) => (
							<option key={inbound.tag} value={inbound.tag}>
								{inbound.tag} ({inbound.protocol})
							</option>
						))}
					</CompactLogSelect>
					<SearchInput containerProps={{ className: "max-w-full md:max-w-[420px] flex-[1_1_100%] md:flex-[1_1_280px] bg-panel-input" }} placeholder={t("xrayLogs.searchPlaceholder")} value={searchFilter} onChange={(e) => setSearchFilter(e.target.value)} matchOptions={searchMatch} onMatchOptionsChange={setSearchMatch} onClear={() => {
										setSearchFilter("");
										setSelectedInbound("");
									}} className="h-[36px] rounded-[4px] border-panel-border! bg-panel-input" />
				</div>
			</ResourceListCard>
			<div ref={logsDiv} className="border border-panel-border! bg-panel-surface rounded-[6px] min-h-[200px] max-h-[500px] p-3 overflow-y-auto font-mono text-[0.875rem]">
				<div className="flex flex-col items-stretch gap-2">
					{filteredLogs.length === 0 ? (
						<div className={cn("text-center py-8 text-[0.875rem]", badgeColor)}>
							{searchFilter
								? t("xrayLogs.noMatchingLogs")
								: t("xrayLogs.noLogs")}
						</div>
					) : (
						filteredLogs.map(({ id, message }) => {
							const level = classifyLog(message);
							const palette = logPalette[level] ?? logPalette.default;
							// Highlight search term in the log message
							const highlightMessage = searchFilter
								? (() => {
										const parts = message.split(
											new RegExp(
												`(${searchFilter.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
												searchMatch.matchCase ? "g" : "gi",
											),
										);
										const partsWithKeys = parts.map((part, idx) => ({
											part,
											key: `${id}-part-${idx}`,
										}));
										return partsWithKeys.map(({ part, key: partKey }) => {
											if (
												matchesSearch(part, searchFilter, {
													...searchMatch,
													matchWholeWord: false,
												})
											) {
												return (
													<span key={partKey} className="bg-yellow-300 text-black px-1 rounded-xs font-semibold dark:bg-yellow-500 dark:text-black">
														{part}
													</span>
												);
											}
											return (
												<React.Fragment key={partKey}>{part}</React.Fragment>
											);
										});
									})()
								: message;
							return (
								<div key={id} style={{ backgroundColor: palette.bg, color: palette.color, borderLeftColor: palette.border }} className="border-l-[3px] px-3 py-2 rounded-[4px]">
									<pre className="m-0 whitespace-pre-wrap [word-break:break-word]">
										{highlightMessage}
									</pre>
								</div>
							);
						})
					)}
				</div>
			</div>
		</div>
	);
};

export default XrayLogsPage;
