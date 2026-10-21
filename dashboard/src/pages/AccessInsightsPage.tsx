import { cn } from "lib/cn";
import type { SortingState } from "@tanstack/react-table";
import { buildSortOptions, DataTableSortMenu } from "components/ui/DataTableSortMenu";
import { Badge } from "components/shadcn/badge";
import { Button, ButtonGroup } from "components/shadcn/button";
import { Alert, AlertIcon } from "components/shadcn/alert";
import { Switch } from "components/shadcn/selection";
import { Progress } from "components/shadcn/feedback";
import { ArrowPathIcon, EyeIcon } from "@heroicons/react/24/outline";
import { OperatorIdentity } from "components/OperatorIdentity";
import { PanelSelect as Select } from "components/common/PanelSelect";
import { SearchInput } from "components/common/SearchInput";
import { AppDialog } from "components/dialogs/AppDialog";
import {
	DataTable,
	PageLoadingSkeleton,
	type DataTableColumn,
	ResourceListCard,
	ResourceRefreshButton,
} from "components/ui";
import dayjs from "dayjs";
import useGetUser from "hooks/useGetUser";
import {
	type FC,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useTranslation } from "react-i18next";
import { fetch } from "service/http";
import type {
	AccessInsightClient,
	AccessInsightsResponse,
} from "types/AccessInsights";
import { filterAccessInsightItems } from "utils/accessInsights";
import { formatBytes } from "utils/formatByte";
import {
	addSearchMatchQuery,
	DEFAULT_SEARCH_MATCH_OPTIONS,
} from "utils/searchMatch";

const PAGE_SIZE = 30;
const REFRESH_INTERVAL = 15_000;

const uniqueStrings = (values: string[]) =>
	Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));

const protocolColor = (protocol: string) => {
	switch (protocol.toLowerCase()) {
		case "openvpn":
			return "green";
		case "wireguard":
			return "cyan";
		case "l2tp/ipsec":
			return "orange";
		case "ikev2":
			return "purple";
		case "cisco anyconnect":
			return "red";
		default:
			return "blue";
	}
};

const AccessInsightsPage: FC = () => {
	const { t, i18n } = useTranslation();
	const isRTL = i18n.dir(i18n.language) === "rtl";
	const { userData, getUserIsSuccess } = useGetUser();
	const canView =
		getUserIsSuccess && Boolean(userData.permissions?.sections.xray);
	const [data, setData] = useState<AccessInsightsResponse | null>(null);
	const [search, setSearch] = useState("");
	const [searchQuery, setSearchQuery] = useState("");
	const [searchMatch, setSearchMatch] = useState(DEFAULT_SEARCH_MATCH_OPTIONS);
	const [protocolFilter, setProtocolFilter] = useState("");
	const [nodeFilter, setNodeFilter] = useState("");
	const [page, setPage] = useState(0);
	const [loading, setLoading] = useState(false);
	const [autoRefresh, setAutoRefresh] = useState(false);
	const [error, setError] = useState("");
	const [selectedClient, setSelectedClient] =
		useState<AccessInsightClient | null>(null);
	const requestAbortRef = useRef<AbortController | null>(null);

	const load = useCallback(async () => {
		if (!canView) return;
		requestAbortRef.current?.abort();
		const abortController = new AbortController();
		requestAbortRef.current = abortController;
		setLoading(true);
		setError("");
		try {
			const query = new URLSearchParams({
				limit: "500",
				window_seconds: "300",
			});
			if (searchQuery) query.set("search", searchQuery);
			addSearchMatchQuery(query, searchMatch);
			const response = await fetch<AccessInsightsResponse>(
				`/core/access/insights/multi-node?${query.toString()}`,
				{ signal: abortController.signal },
			);
			if (!abortController.signal.aborted) setData(response);
		} catch (requestError: any) {
			if (abortController.signal.aborted) return;
			setError(
				requestError?.data?.detail ||
					requestError?.message ||
					t("pages.accessInsights.errors.loadFailed"),
			);
		} finally {
			if (requestAbortRef.current === abortController) {
				requestAbortRef.current = null;
				setLoading(false);
			}
		}
	}, [canView, searchQuery, searchMatch, t]);

	useEffect(
		() => () => {
			requestAbortRef.current?.abort();
		},
		[],
	);

	useEffect(() => {
		const timer = window.setTimeout(() => setSearchQuery(search.trim()), 250);
		return () => window.clearTimeout(timer);
	}, [search]);

	useEffect(() => {
		void load();
	}, [load]);

	useEffect(() => {
		if (!autoRefresh || !canView) return;
		const timer = window.setInterval(() => {
			if (document.visibilityState === "visible" && navigator.onLine)
				void load();
		}, REFRESH_INTERVAL);
		return () => window.clearInterval(timer);
	}, [autoRefresh, canView, load]);

	const items = data?.items || [];
	const protocolOptions = useMemo(
		() =>
			uniqueStrings(
				items.flatMap((item) =>
					item.platforms.map((platform) => platform.platform),
				),
			).sort(),
		[items],
	);
	const nodeOptions = useMemo(
		() => uniqueStrings(items.flatMap((item) => item.nodes || [])).sort(),
		[items],
	);
	const filteredItems = useMemo(
		() =>
			filterAccessInsightItems(items, {
				node: nodeFilter,
				protocol: protocolFilter,
			}),
		[items, nodeFilter, protocolFilter],
	);
	const totalIPs = useMemo(
		() =>
			new Set(
				filteredItems.flatMap((item) => uniqueStrings(item.sources || [])),
			).size,
		[filteredItems],
	);
	const totalNodes = useMemo(
		() => new Set(filteredItems.flatMap((item) => item.nodes || [])).size,
		[filteredItems],
	);
	const protocolTotals = useMemo(() => {
		const totals = new Map<string, number>();
		filteredItems.forEach((item) => {
			item.platforms.forEach((platform) => {
				totals.set(
					platform.platform,
					(totals.get(platform.platform) || 0) + platform.connections,
				);
			});
		});
		return Array.from(totals.entries()).sort(
			(left, right) => right[1] - left[1],
		);
	}, [filteredItems]);
	const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
	const visibleItems = filteredItems.slice(
		page * PAGE_SIZE,
		(page + 1) * PAGE_SIZE,
	);

	useEffect(() => {
		setPage((current) => Math.min(current, totalPages - 1));
	}, [totalPages]);

	const [accessSorting, setAccessSorting] = useState<SortingState>([]);
	const columns = useMemo<DataTableColumn<AccessInsightClient>[]>(
		() => [
			{
				id: "user",
				header: t("user"),
				accessor: "user_label",
				isPrimary: true,
				priority: "primary",
				width: "190px",
				minWidth: "160px",
				mobilePriority: 0,
				cell: (client) => (
					<div className="flex flex-col items-start gap-0.5 min-w-0!">
						<p className="font-semibold truncate max-w-full">
							{client.user_label}
						</p>
						<p className="text-[0.75rem] text-panel-text-muted">
							{t("pages.accessInsights.connections")}: {client.connections}
						</p>
					</div>
				),
			},
			{
				id: "ips",
				header: t("pages.accessInsights.ips"),
				accessor: (client) => client.sources?.join(", ") || "",
				priority: "high",
				width: "270px",
				minWidth: "230px",
				multiline: true,
				mobilePriority: 1,
				mobileSummary: true,
				cell: (client) => {
					const operatorByIP = new Map(
						(client.operators || []).map((operator) => [operator.ip, operator]),
					);
					const sources = uniqueStrings(client.sources || []);
					return (
						<div className="flex flex-col items-stretch gap-2 min-w-0!">
							{sources.slice(0, 3).map((ip) => {
								const operator = operatorByIP.get(ip);
								const nodes = uniqueStrings(client.source_nodes?.[ip] || []);
								return (
									<div key={ip} className="flex flex-row items-center gap-2 min-w-0!">
										<div className="min-w-[112px]!">
											<p dir="ltr" className="font-mono text-[0.75rem] font-semibold">
												{ip}
											</p>
											{nodes.length ? (
												<p className="text-[0.75rem] text-panel-text-muted truncate">
													{nodes.join(", ")}
												</p>
											) : null}
										</div>
										<OperatorIdentity
											shortName={operator?.short_name}
											owner={operator?.owner}
											compact
										/>
									</div>
								);
							})}
							{sources.length > 3 ? (
								<p className="text-[0.75rem] text-panel-text-muted">
									+{sources.length - 3}
								</p>
							) : null}
						</div>
					);
				},
			},
			{
				id: "protocols",
				header: t("pages.accessInsights.protocols"),
				accessor: (client) =>
					client.platforms.map((item) => item.platform).join(", "),
				priority: "high",
				width: "210px",
				minWidth: "170px",
				mobilePriority: 2,
				cell: (client) => (
					<div className="flex flex-row items-center gap-1.5 flex-wrap">
						{client.platforms.map((protocol) => (
							<Badge key={protocol.platform} colorScheme={protocolColor(protocol.platform)} className="rounded-md">
								{protocol.platform} · {protocol.connections}
							</Badge>
						))}
					</div>
				),
			},
			{
				id: "last_seen",
				header: t("pages.accessInsights.lastSeen"),
				accessor: "last_seen",
				priority: "medium",
				width: "155px",
				minWidth: "145px",
				mobilePriority: 3,
				cell: (client) => (
					<p dir="ltr" className="text-[0.75rem] whitespace-nowrap">
						{dayjs(client.last_seen).format("YYYY-MM-DD HH:mm:ss")}
					</p>
				),
			},
			{
				id: "details",
				header: t("details"),
				priority: "medium",
				width: "92px",
				minWidth: "86px",
				mobilePriority: 4,
				cell: (client) => (
					<Button size="xs" variant="ghost" onClick={() => setSelectedClient(client)}>{<EyeIcon className="w-15" />}
						{t("details")}
					</Button>
				),
			},
		],
		[t],
	);

	if (!getUserIsSuccess) {
		return <PageLoadingSkeleton />;
	}

	if (!canView) {
		return (
			<div className="p-6">
				<Alert status="warning" className="rounded-md">
					<AlertIcon />
					{t("pages.accessInsights.noPermission")}
				</Alert>
			</div>
		);
	}

	const pagination =
		totalPages > 1 ? (
			<div className="flex flex-row items-center gap-2 justify-between w-full">
				<p className="text-[0.875rem] text-panel-text-muted">
					{page + 1} / {totalPages}
				</p>
				<ButtonGroup size="sm" isAttached variant="outline">
					<Button variant="solid" size="md" onClick={() => setPage((current) => Math.max(0, current - 1))} disabled={page === 0}>
						{t("previous")}
					</Button>
					<Button variant="solid" size="md" onClick={() =>
							setPage((current) => Math.min(totalPages - 1, current + 1))
						} disabled={page >= totalPages - 1}>
						{t("next")}
					</Button>
				</ButtonGroup>
			</div>
		) : null;
	const selectedSources = uniqueStrings(selectedClient?.sources || []);
	const selectedOperatorByIP = new Map(
		(selectedClient?.operators || []).map((operator) => [
			operator.ip,
			operator,
		]),
	);
	const selectedLimit = Number(selectedClient?.data_limit || 0);
	const selectedUsage = Number(selectedClient?.used_traffic || 0);
	const selectedRemaining =
		selectedLimit > 0 ? Math.max(selectedLimit - selectedUsage, 0) : null;
	const selectedUsagePercent =
		selectedLimit > 0
			? Math.min((selectedUsage / selectedLimit) * 100, 100)
			: 0;

	return (
		<div dir={isRTL ? "rtl" : "ltr"} data-dir={isRTL ? "rtl" : "ltr"} className="flex flex-col gap-5 items-stretch">
			<div className="flex flex-col gap-3">
				<ResourceListCard
					title={t("pages.accessInsights.onlineSessions")}
					summaryItems={[
						{
							label: t("pages.accessInsights.onlineUsers"),
							value: data?.online_total ?? 0,
							colorScheme: "green",
						},
						{
							label: t("pages.accessInsights.uniqueIps"),
							value: totalIPs,
							colorScheme: "blue",
						},
						{
							label: t("pages.accessInsights.activeNodes"),
							value: totalNodes,
							colorScheme: "cyan",
						},
					]}
					actions={
						<div className="flex flex-row items-center gap-3 justify-between xl:justify-end">
							<div className="flex flex-row items-center gap-2">
								<Switch checked={autoRefresh} onChange={(event) => setAutoRefresh(event.target.checked)} aria-label={t("pages.accessInsights.autoRefresh")} />
								<p className="text-[0.875rem]">
									{t("pages.accessInsights.autoRefresh")}
								</p>
							</div>
							<ResourceRefreshButton
								aria-label={t("refresh")}
								label={t("refresh")}
								icon={<ArrowPathIcon className="w-18" />}
								onClick={() => void load()}
								loading={loading}
							/>
						</div>
					}
					footerActions={
						protocolTotals.length ? (
							<div className="flex flex-row items-center gap-1.5 flex-wrap">
								{protocolTotals.map(([protocol, count]) => (
									<Badge key={protocol} colorScheme={protocolColor(protocol)} className="rounded-md">
										{protocol} · {count}
									</Badge>
								))}
							</div>
						) : undefined
					}
				>
					<div className="flex flex-col lg:flex-row gap-2 w-full max-w-[760px]">
						<SearchInput containerProps={{ className: "flex-1" }} value={search} onChange={(event) => {
								setSearch(event.target.value);
								setPage(0);
							}} placeholder={t("pages.accessInsights.liveSearch")} matchOptions={searchMatch} onMatchOptionsChange={(options) => {
								setSearchMatch(options);
								setPage(0);
							}} />
						<DataTableSortMenu
							options={buildSortOptions(columns, visibleItems)}
							sorting={accessSorting}
							onSortingChange={setAccessSorting}
						/>
						<Select value={protocolFilter} onChange={(event) => {
								setProtocolFilter(event.target.value);
								setPage(0);
							}} aria-label={t("pages.accessInsights.allProtocols")} className="w-full md:w-[180px]">
							<option value="">{t("pages.accessInsights.allProtocols")}</option>
							{protocolOptions.map((protocol) => (
								<option key={protocol} value={protocol}>
									{protocol}
								</option>
							))}
						</Select>
						<Select value={nodeFilter} onChange={(event) => {
								setNodeFilter(event.target.value);
								setPage(0);
							}} aria-label={t("pages.accessInsights.allNodes")} className="w-full md:w-[180px]">
							<option value="">{t("pages.accessInsights.allNodes")}</option>
							{nodeOptions.map((node) => (
								<option key={node} value={node}>
									{node}
								</option>
							))}
						</Select>
					</div>
				</ResourceListCard>

				<DataTable
					ariaLabel={t("pages.accessInsights.onlineSessions")}
					data={visibleItems}
					columns={columns}
					sorting={accessSorting}
					onSortingChange={setAccessSorting}
					showSortMenu={false}
					getRowId={(client) => client.user_key}
					loading={loading}
					loadingRows={8}
					error={error || undefined}
					emptyState={
						<p className="text-[0.875rem] text-panel-text-muted text-center">
							{t("pages.accessInsights.noData")}
						</p>
					}
					pagination={pagination}
					mobileBreakpoint="md"
					dir={isRTL ? "rtl" : "ltr"}
					tableProps={{
						className: cn(isRTL ? "rb-rtl-table" : undefined, "w-full [table-layout:fixed] [&_th]:px-2 [&_td]:px-2 [&_th]:py-2.5 [&_td]:py-2.5 [&_th]:align-middle [&_td]:align-middle xl:[&_th]:px-2.5 xl:[&_td]:px-2.5") }}
				/>
			</div>

			<AppDialog open={selectedClient !== null} onClose={() => setSelectedClient(null)} isCentered size="xl" title={`${t("details")}: ${selectedClient?.user_label || ""}`} contentProps={{ className: "max-h-[min(760px,_calc(100dvh_-_2rem))]" }} bodyProps={{ className: "pb-6" }}>
				{selectedClient ? (
					<div className="flex flex-col gap-5">
						<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
							<div>
								<p className="text-[0.75rem] text-panel-text-muted">
									{t("status")}
								</p>
								<Badge colorScheme={
										selectedClient.user_status === "active" ? "green" : "gray"
									} className="mt-1">
									{t(`status.${selectedClient.user_status || "active"}`, {
										defaultValue: selectedClient.user_status || "-",
									})}
								</Badge>
							</div>
							<div>
								<p className="text-[0.75rem] text-panel-text-muted">
									{t("service")}
								</p>
								<p className="mt-1 text-[0.875rem] font-semibold truncate">
									{selectedClient.service_name || "-"}
								</p>
							</div>
							<div>
								<p className="text-[0.75rem] text-panel-text-muted">
									{t("pages.accessInsights.connections")}
								</p>
								<p className="mt-1 text-[0.875rem] font-semibold">
									{selectedClient.connections}
								</p>
							</div>
							<div>
								<p className="text-[0.75rem] text-panel-text-muted">
									{t("expire")}
								</p>
								<p dir="ltr" className="mt-1 text-[0.875rem] font-semibold">
									{selectedClient.expire
										? dayjs
												.unix(selectedClient.expire)
												.format("YYYY-MM-DD HH:mm")
										: t("admins.expireNotSet")}
								</p>
							</div>
						</div>

						<div>
							<div className="flex flex-row items-center gap-2 justify-between mb-2">
								<p className="text-[0.875rem] font-semibold">
									{t("dataUsage")}
								</p>
								<p dir="ltr" className="text-[0.75rem] text-panel-text-muted">
									{formatBytes(selectedUsage)} /{" "}
									{selectedLimit > 0
										? formatBytes(selectedLimit)
										: t("unlimited")}
								</p>
							</div>
							<Progress value={selectedUsagePercent} isAnimated={false} size="sm" colorScheme={selectedUsagePercent >= 90 ? "red" : "green"} className="rounded-full" />
							<p dir="ltr" className="mt-2 text-[0.75rem] text-panel-text-muted">
								{t("remaining")}:{" "}
								{selectedRemaining === null
									? t("unlimited")
									: formatBytes(selectedRemaining)}
							</p>
						</div>

						<hr className="w-full border-0 border-b border-panel-border! opacity-60" />
						<div>
							<div className="flex flex-row items-center gap-2 justify-between mb-2">
								<p className="text-[0.875rem] font-semibold">
									{t("pages.accessInsights.ips")}
								</p>
								<Badge variant="subtle">{selectedSources.length}</Badge>
							</div>
							<div className="flex flex-col items-stretch gap-0 max-h-[320px] overflow-y-auto">
								{selectedSources.map((ip) => {
									const operator = selectedOperatorByIP.get(ip);
									const nodes = uniqueStrings(
										selectedClient.source_nodes?.[ip] || [],
									);
									return (
										<div key={ip} className="flex flex-row gap-2 py-2 border-b border-panel-border! items-center">
											<div className="min-w-[132px]! md:min-w-[180px]!">
												<p dir="ltr" className="font-mono text-[0.75rem] font-semibold">
													{ip}
												</p>
												{nodes.length ? (
													<p className="text-[0.75rem] text-panel-text-muted truncate">
														{nodes.join(", ")}
													</p>
												) : null}
											</div>
											<OperatorIdentity
												shortName={operator?.short_name}
												owner={operator?.owner}
												compact
											/>
										</div>
									);
								})}
							</div>
						</div>
					</div>
				) : null}
			</AppDialog>
		</div>
	);
};

export default AccessInsightsPage;
