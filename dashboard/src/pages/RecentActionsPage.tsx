import {
	Alert,
	AlertIcon,
	Badge,
	Box,
	Button,
	Divider,
	HStack,
	Input,
	InputGroup,
	InputLeftElement,
	SimpleGrid,
	Spinner,
	Stack,
	Text,
	VStack,
} from "@chakra-ui/react";
import {
	ArrowPathIcon,
	ArrowUturnLeftIcon,
	EyeIcon,
	MagnifyingGlassIcon,
	PencilSquareIcon,
	PlusCircleIcon,
	TrashIcon,
} from "@heroicons/react/24/outline";
import { PanelSelect as Select } from "components/common/PanelSelect";
import { JsonEditor } from "components/JsonEditor";
import {
	DataTable,
	type DataTableColumn,
	type DataTableRowAction,
	PageHeader,
	ResourceListCard,
} from "components/ui";
import dayjs from "dayjs";
import useGetUser from "hooks/useGetUser";
import { type FC, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { fetch } from "service/http";
import { AdminRole, AdminSudoScope } from "types/Admin";
import { buildJsonDiff } from "utils/jsonDiff";

type RecentActionOperation = "created" | "deleted" | "updated";

type RecentActionPreview = {
	field?: string;
	before?: string;
	after?: string;
	operation?: RecentActionOperation;
	resource?: string;
};

type RecentAction = {
	id: number;
	action_type: string;
	resource_type: string;
	resource_key: string;
	actor_username: string;
	auth_source: string;
	summary: string;
	rollback_status:
		| "available"
		| "undone"
		| "expired"
		| "conflict"
		| "unsupported";
	created_at: string;
	snapshot_expires_at?: string | null;
	preview?: RecentActionPreview;
};

type RecentActionsResponse = {
	actions: RecentAction[];
	next_before_id?: number | null;
};

type RecentActionDetail = {
	action: RecentAction;
	snapshot_available: boolean;
	before?: unknown;
	after?: unknown;
	config_changes?: RecentActionConfigChange[];
	config_previews?: RecentActionConfigDisplay[];
};

type RecentActionConfigChange = {
	target_id: string;
	path: string;
	kind?: string;
	before?: unknown;
	after?: unknown;
	before_exists: boolean;
	after_exists: boolean;
};

type RecentActionConfigDisplay = RecentActionConfigChange & {
	changed_paths?: string[];
};

const statusTone = (status: RecentAction["rollback_status"]) => {
	switch (status) {
		case "available":
			return "green";
		case "undone":
			return "blue";
		case "conflict":
			return "red";
		case "expired":
			return "orange";
		default:
			return "gray";
	}
};

const actionOperation = (actionType: string) => {
	if (actionType.includes(".create")) return "created" as const;
	if (actionType.includes(".delete")) return "deleted" as const;
	return "updated" as const;
};

const actionLifecycle = (action: RecentAction) => {
	return {
		operation: action.preview?.operation ?? actionOperation(action.action_type),
		resource: action.preview?.resource ?? action.resource_type,
	};
};

const actionOperationVisual = (operation: RecentActionOperation) => {
	switch (operation) {
		case "created":
			return { color: "green.400", icon: <PlusCircleIcon width={18} /> };
		case "deleted":
			return { color: "red.400", icon: <TrashIcon width={18} /> };
		default:
			return { color: "blue.400", icon: <PencilSquareIcon width={18} /> };
	}
};

const recentActionResourceKeys = new Set([
	"host",
	"inbound",
	"outbound",
	"service",
	"xray_config",
	"routing",
	"routing_rule",
	"balancer",
	"dns",
	"dns_server",
	"dns_host",
	"log",
	"api",
	"policy",
	"stats",
	"transport",
	"reverse_proxy",
	"metrics",
	"observatory",
	"burst_observatory",
	"fake_dns",
	"services",
]);

const recentActionFieldKeys = new Set([
	"name",
	"tag",
	"protocol",
	"address",
	"port",
	"settings",
	"servers",
	"rules",
	"domains",
	"domain",
	"network",
	"security",
	"host",
	"path",
	"sni",
	"alpn",
	"fingerprint",
	"flow",
	"loglevel",
	"access",
	"error",
	"listen",
	"services",
	"strategy",
	"outboundTag",
	"inboundTag",
	"balancerTag",
	"domainStrategy",
	"queryStrategy",
	"clientIp",
	"expectIPs",
	"subjectSelector",
	"probeUrl",
	"probeInterval",
	"type",
	"request",
	"response",
	"header",
]);

const resourceTranslationKey = (resource: string) =>
	recentActionResourceKeys.has(resource)
		? `recentActions.resources.${resource}`
		: "recentActions.resources.configuration";

const changedFieldTranslationKey = (path?: string) => {
	const field = path?.split("/").filter(Boolean).at(-1);
	return field && recentActionFieldKeys.has(field)
		? `recentActions.fields.${field}`
		: undefined;
};

const configChangePaths = (change: RecentActionConfigDisplay) =>
	change.changed_paths ?? [change.path];

const actionTypeResource = (actionType: string) => {
	switch (actionType.split(".")[0]) {
		case "host":
		case "inbound":
		case "outbound":
		case "service":
			return actionType.split(".")[0];
		case "xray":
			return "xray_config";
		default:
			return "configuration";
	}
};

const changedPaths = (
	before: unknown,
	after: unknown,
	path = "",
	output: string[] = [],
) => {
	if (output.length >= 40) return output;
	if (Object.is(before, after)) return output;
	if (
		before &&
		after &&
		typeof before === "object" &&
		typeof after === "object" &&
		!Array.isArray(before) &&
		!Array.isArray(after)
	) {
		const left = before as Record<string, unknown>;
		const right = after as Record<string, unknown>;
		const keys = Array.from(
			new Set([...Object.keys(left), ...Object.keys(right)]),
		).sort();
		for (const key of keys)
			changedPaths(left[key], right[key], `${path}/${key}`, output);
		return output;
	}
	output.push(path || "/");
	return output;
};

const JsonDiffEditors: FC<{ before: unknown; after: unknown }> = ({
	before,
	after,
}) => {
	const { t } = useTranslation();
	const lines = useMemo(() => buildJsonDiff(before, after), [before, after]);
	const beforeChangedLines = useMemo(
		() =>
			lines.flatMap((line) =>
				line.type === "remove" && line.beforeLine ? [line.beforeLine] : [],
			),
		[lines],
	);
	const afterChangedLines = useMemo(
		() =>
			lines.flatMap((line) =>
				line.type === "add" && line.afterLine ? [line.afterLine] : [],
			),
		[lines],
	);
	const beforeHighlightRanges = useMemo(
		() =>
			lines.flatMap((line) =>
				line.type === "remove" &&
				line.beforeLine &&
				line.highlightStart !== undefined &&
				line.highlightEnd !== undefined
					? [
							{
								line: line.beforeLine,
								start: line.highlightStart,
								end: line.highlightEnd,
							},
						]
					: [],
			),
		[lines],
	);
	const afterHighlightRanges = useMemo(
		() =>
			lines.flatMap((line) =>
				line.type === "add" &&
				line.afterLine &&
				line.highlightStart !== undefined &&
				line.highlightEnd !== undefined
					? [
							{
								line: line.afterLine,
								start: line.highlightStart,
								end: line.highlightEnd,
							},
						]
					: [],
			),
		[lines],
	);

	return (
		<SimpleGrid columns={{ base: 1, xl: 2 }} spacing={4} dir="ltr">
			<Box minW={0}>
				<Text fontWeight="medium" mb={2}>
					{t("recentActions.before")}
				</Text>
				<Box h={{ base: "360px", xl: "440px" }}>
					<JsonEditor
						json={before}
						onChange={() => undefined}
						readOnly
						showToolbar={false}
						minHeight={0}
						highlightLines={beforeChangedLines}
						highlightVariant="removed"
						highlightRanges={beforeHighlightRanges}
					/>
				</Box>
			</Box>
			<Box minW={0}>
				<Text fontWeight="medium" mb={2}>
					{t("recentActions.after")}
				</Text>
				<Box h={{ base: "360px", xl: "440px" }}>
					<JsonEditor
						json={after}
						onChange={() => undefined}
						readOnly
						showToolbar={false}
						minHeight={0}
						highlightLines={afterChangedLines}
						highlightVariant="added"
						highlightRanges={afterHighlightRanges}
					/>
				</Box>
			</Box>
		</SimpleGrid>
	);
};

const ActionPreview: FC<{ preview?: RecentActionPreview }> = ({ preview }) => {
	const { t } = useTranslation();
	if (!preview || preview.operation) {
		return <Text color="panel.textMuted">—</Text>;
	}
	const field = changedFieldTranslationKey(preview.field);
	return (
		<VStack align="start" spacing={0.5} minW={0}>
			{field && (
				<Text fontSize="xs" color="panel.textMuted" noOfLines={1}>
					{t(field)}
				</Text>
			)}
			<HStack spacing={1.5} minW={0} maxW="full">
				<Text color="red.300" textDecoration="line-through" noOfLines={1}>
					{preview.before}
				</Text>
				<Text color="panel.textMuted">→</Text>
				<Text color="green.300" noOfLines={1}>
					{preview.after}
				</Text>
			</HStack>
		</VStack>
	);
};

export const RecentActionsPage: FC = () => {
	const { t, i18n } = useTranslation();
	const queryClient = useQueryClient();
	const { userData, getUserIsSuccess } = useGetUser();
	const canView =
		getUserIsSuccess &&
		(userData.role === AdminRole.FullAccess ||
			(userData.role === AdminRole.Sudo &&
				Boolean(userData.permissions?.sudo?.[AdminSudoScope.Xray])));
	const [beforeID, setBeforeID] = useState<number | null>(null);
	const [selectedID, setSelectedID] = useState<number | null>(null);
	const [search, setSearch] = useState("");
	const [actionType, setActionType] = useState("");
	const [resourceType, setResourceType] = useState("");
	const [status, setStatus] = useState("");

	const actionsQuery = useQuery(
		["recent-actions", beforeID],
		() =>
			fetch<RecentActionsResponse>(
				beforeID
					? `/core/recent-actions?limit=50&before_id=${beforeID}`
					: "/core/recent-actions?limit=50",
			),
		{ enabled: canView, staleTime: 15_000, refetchOnWindowFocus: false },
	);
	const detailQuery = useQuery(
		["recent-action", selectedID],
		() => fetch<RecentActionDetail>(`/core/recent-actions/${selectedID}`),
		{ enabled: canView && selectedID !== null, refetchOnWindowFocus: false },
	);
	const rollbackMutation = useMutation(
		(id: number) =>
			fetch(`/core/recent-actions/${id}/rollback`, { method: "POST" }),
		{
			onSuccess: async () => {
				await queryClient.invalidateQueries("recent-actions");
				if (selectedID !== null) {
					await queryClient.invalidateQueries(["recent-action", selectedID]);
				}
			},
		},
	);

	const actions = actionsQuery.data?.actions ?? [];
	const actionTypes = useMemo(
		() =>
			Array.from(new Set(actions.map((action) => action.action_type))).sort(),
		[actions],
	);
	const actionTypeLabel = (type: string) => {
		const resource = t(resourceTranslationKey(actionTypeResource(type)));
		return t(`recentActions.operations.${actionOperation(type)}`, { resource });
	};
	const resourceTypes = useMemo(
		() =>
			Array.from(new Set(actions.map((action) => action.resource_type))).sort(),
		[actions],
	);
	const filteredActions = useMemo(() => {
		const term = search.trim().toLowerCase();
		return actions.filter((action) => {
			if (actionType && action.action_type !== actionType) return false;
			if (resourceType && action.resource_type !== resourceType) return false;
			if (status && action.rollback_status !== status) return false;
			if (!term) return true;
			return [
				action.summary,
				action.action_type,
				action.resource_type,
				action.resource_key,
				action.actor_username,
				action.preview?.field,
				action.preview?.before,
				action.preview?.after,
				action.preview?.operation,
				action.preview?.resource,
			]
				.filter(Boolean)
				.join(" ")
				.toLowerCase()
				.includes(term);
		});
	}, [actionType, actions, resourceType, search, status]);

	const rollback = (action: RecentAction) => {
		if (!window.confirm(t("recentActions.rollbackConfirm"))) return;
		rollbackMutation.mutate(action.id);
	};
	const columns = useMemo<DataTableColumn<RecentAction>[]>(
		() => [
			{
				id: "action",
				header: t("recentActions.columns.action"),
				isPrimary: true,
				priority: "primary",
				minWidth: "190px",
				cell: (action) => {
					const lifecycle = actionLifecycle(action);
					const operation = lifecycle.operation;
					const resource = t(resourceTranslationKey(lifecycle.resource));
					const visual = actionOperationVisual(operation);
					return (
						<HStack align="start" spacing={2.5} minW={0}>
							<Box color={visual.color} mt={0.5} flexShrink={0}>
								{visual.icon}
							</Box>
							<VStack align="start" spacing={0} minW={0}>
								<Text fontWeight="semibold" noOfLines={1} maxW="full">
									{t(`recentActions.operations.${operation}`, { resource })}
								</Text>
							</VStack>
						</HStack>
					);
				},
			},
			{
				id: "resource",
				header: t("recentActions.columns.resource"),
				priority: "high",
				minWidth: "180px",
				cell: (action) => {
					const resourceType = actionLifecycle(action).resource;
					return (
						<VStack align="start" spacing={1} minW={0}>
							<Badge variant="subtle">
								{t(resourceTranslationKey(resourceType))}
							</Badge>
							<Text
								fontFamily="mono"
								fontSize="xs"
								color="panel.textMuted"
								noOfLines={1}
							>
								{action.resource_key}
							</Text>
						</VStack>
					);
				},
			},
			{
				id: "preview",
				header: t("recentActions.columns.preview"),
				priority: "high",
				minWidth: "220px",
				mobileSummary: true,
				cell: (action) => <ActionPreview preview={action.preview} />,
			},
			{
				id: "status",
				header: t("recentActions.columns.status"),
				priority: "medium",
				minWidth: "140px",
				cell: (action) => (
					<Badge colorScheme={statusTone(action.rollback_status)}>
						{t(`recentActions.status.${action.rollback_status}`)}
					</Badge>
				),
			},
			{
				id: "actor",
				header: t("recentActions.columns.actor"),
				priority: "medium",
				minWidth: "140px",
				cell: (action) => (
					<VStack align="start" spacing={0}>
						<Text fontWeight="medium">{action.actor_username}</Text>
						<Text fontSize="xs" color="panel.textMuted">
							{action.auth_source}
						</Text>
					</VStack>
				),
			},
			{
				id: "created",
				header: t("recentActions.columns.time"),
				priority: "low",
				hideBelow: "xl",
				minWidth: "160px",
				accessor: "created_at",
				sortable: true,
				cell: (action) => (
					<Text fontSize="sm" dir="ltr">
						{dayjs(action.created_at).format("YYYY-MM-DD HH:mm")}
					</Text>
				),
			},
		],
		[t],
	);
	const rowActions = (
		action: RecentAction,
	): DataTableRowAction<RecentAction>[] => [
		{
			id: "details",
			label: t("recentActions.details"),
			icon: <EyeIcon width={16} />,
			onClick: () => setSelectedID(action.id),
		},
		...(action.rollback_status === "available"
			? [
					{
						id: "rollback",
						label: t("recentActions.rollback"),
						icon: <ArrowUturnLeftIcon width={16} />,
						isDanger: true,
						onClick: () => rollback(action),
					},
				]
			: []),
	];

	if (!canView) {
		return (
			<Alert status="error" borderRadius="md">
				<AlertIcon />
				{t("recentActions.noPermission")}
			</Alert>
		);
	}

	const detail = detailQuery.data;
	const configChanges = detail?.config_changes ?? [];
	const configPreviews = detail?.config_previews ?? [];
	const displayConfigChanges: RecentActionConfigDisplay[] =
		configPreviews.length > 0 ? configPreviews : configChanges;
	const diffPaths =
		displayConfigChanges.length > 0
			? displayConfigChanges.flatMap(configChangePaths)
			: detail?.snapshot_available
				? changedPaths(detail.before, detail.after)
				: [];
	const diffPathLabels = Array.from(
		new Set(
			diffPaths
				.map(changedFieldTranslationKey)
				.filter((key): key is string => Boolean(key)),
		),
	);
	const rollbackError = rollbackMutation.error as {
		data?: { detail?: string; conflict_paths?: string[] };
		message?: string;
	} | null;
	const rollbackErrorDetail =
		rollbackError?.data?.detail || rollbackError?.message;
	const rollbackConflictPaths = rollbackError?.data?.conflict_paths ?? [];

	return (
		<VStack
			spacing={4}
			align="stretch"
			dir={i18n.dir(i18n.language)}
			pb={{ base: 8, md: 16 }}
		>
			<PageHeader
				title={t("recentActions.title")}
				description={t("recentActions.description")}
				actions={
					<Button
						leftIcon={<ArrowPathIcon width={16} />}
						variant="outline"
						onClick={() => void actionsQuery.refetch()}
						isLoading={actionsQuery.isFetching}
					>
						{t("recentActions.refresh")}
					</Button>
				}
			/>

			<ResourceListCard
				title={t("recentActions.title")}
				summaryItems={[
					{ label: t("total"), value: actions.length },
					{
						label: t("usersPage.filtered"),
						value: filteredActions.length,
						colorScheme: "green",
					},
				]}
			>
				<Stack
					direction={{ base: "column", xl: "row" }}
					spacing={2}
					align="stretch"
				>
					<InputGroup size="sm" w={{ base: "full", md: "300px" }}>
						<InputLeftElement pointerEvents="none">
							<MagnifyingGlassIcon width={16} />
						</InputLeftElement>
						<Input
							value={search}
							onChange={(event) => setSearch(event.target.value)}
							placeholder={t("recentActions.searchPlaceholder")}
							aria-label={t("recentActions.searchPlaceholder")}
						/>
					</InputGroup>
					<Select
						size="sm"
						value={actionType}
						onChange={(event) => setActionType(event.target.value)}
						aria-label={t("recentActions.filters.action")}
						w={{ base: "full", md: "190px" }}
					>
						<option value="">{t("recentActions.filters.allActions")}</option>
						{actionTypes.map((type) => (
							<option key={type} value={type}>
								{actionTypeLabel(type)}
							</option>
						))}
					</Select>
					<Select
						size="sm"
						value={resourceType}
						onChange={(event) => setResourceType(event.target.value)}
						aria-label={t("recentActions.filters.resource")}
						w={{ base: "full", md: "160px" }}
					>
						<option value="">{t("recentActions.filters.allResources")}</option>
						{resourceTypes.map((type) => (
							<option key={type} value={type}>
								{t(resourceTranslationKey(type))}
							</option>
						))}
					</Select>
					<Select
						size="sm"
						value={status}
						onChange={(event) => setStatus(event.target.value)}
						aria-label={t("recentActions.filters.status")}
						w={{ base: "full", md: "170px" }}
					>
						<option value="">{t("recentActions.filters.allStatuses")}</option>
						{["available", "undone", "expired", "conflict", "unsupported"].map(
							(value) => (
								<option key={value} value={value}>
									{t(`recentActions.status.${value}`)}
								</option>
							),
						)}
					</Select>
				</Stack>
			</ResourceListCard>

			<DataTable
				ariaLabel={t("recentActions.title")}
				data={filteredActions}
				columns={columns}
				getRowId={(action) => String(action.id)}
				isLoading={actionsQuery.isLoading}
				loadingRows={8}
				error={actionsQuery.isError ? t("recentActions.loadFailed") : undefined}
				emptyState={
					<Text fontSize="sm" color="panel.textMuted" textAlign="center">
						{actions.length
							? t("recentActions.noMatching")
							: t("recentActions.empty")}
					</Text>
				}
				rowActions={rowActions}
				renderRowActions={(action) => (
					<HStack spacing={2} justify="flex-end">
						<Button
							size="sm"
							variant="outline"
							leftIcon={<EyeIcon width={16} />}
							onClick={() => setSelectedID(action.id)}
						>
							{t("recentActions.details")}
						</Button>
						{action.rollback_status === "available" && (
							<Button
								size="sm"
								colorScheme="orange"
								leftIcon={<ArrowUturnLeftIcon width={16} />}
								onClick={() => rollback(action)}
								isLoading={
									rollbackMutation.isLoading &&
									rollbackMutation.variables === action.id
								}
							>
								{t("recentActions.rollback")}
							</Button>
						)}
					</HStack>
				)}
				actionsDisplay="inline"
				actionsColumnWidth="210px"
				actionsAlwaysVisible
				onRowClick={(action) => setSelectedID(action.id)}
				mobileBreakpoint="lg"
				pagination={
					actionsQuery.data?.next_before_id ? (
						<Button
							variant="outline"
							onClick={() =>
								setBeforeID(actionsQuery.data?.next_before_id ?? null)
							}
						>
							{t("recentActions.loadMore")}
						</Button>
					) : undefined
				}
			/>

			{selectedID !== null && (
				<Box
					bg="panel.surface"
					borderWidth="1px"
					borderColor="panel.border"
					borderRadius="md"
					p={4}
				>
					<HStack justify="space-between" mb={4}>
						<Text fontWeight="semibold">
							{t("recentActions.changePreview")}
						</Text>
						<Button
							size="sm"
							variant="ghost"
							onClick={() => setSelectedID(null)}
						>
							{t("close")}
						</Button>
					</HStack>
					{detailQuery.isLoading ? (
						<HStack justify="center" py={10}>
							<Spinner />
						</HStack>
					) : detailQuery.isError ? (
						<Alert status="error">
							<AlertIcon />
							{t("recentActions.loadFailed")}
						</Alert>
					) : detail?.snapshot_available ? (
						<Stack spacing={4}>
							{diffPathLabels.length > 0 && (
								<Box>
									<Text fontSize="sm" color="panel.textSecondary" mb={2}>
										{t("recentActions.changedPaths")}
									</Text>
									<HStack spacing={2} flexWrap="wrap">
										{diffPathLabels.map((label) => (
											<Badge key={label} colorScheme="orange">
												{t(label)}
											</Badge>
										))}
									</HStack>
								</Box>
							)}
							{displayConfigChanges.length > 0 ? (
								<Stack spacing={4}>
									{displayConfigChanges.map((change, index) => {
										const paths = configChangePaths(change);
										const labels = Array.from(
											new Set(
												paths
													.map(changedFieldTranslationKey)
													.filter((key): key is string => Boolean(key)),
											),
										);
										return (
											<Box
												key={`${change.target_id}-${change.path}-${index}`}
												borderWidth="1px"
												borderColor="panel.border"
												borderRadius="md"
												p={3}
											>
												{labels.length > 0 && (
													<Text
														fontSize="sm"
														color="panel.textSecondary"
														mb={3}
													>
														{labels.map((label) => t(label)).join(" · ")}
													</Text>
												)}
												<JsonDiffEditors
													before={
														change.before_exists ? change.before : undefined
													}
													after={change.after_exists ? change.after : undefined}
												/>
											</Box>
										);
									})}
								</Stack>
							) : (
								<JsonDiffEditors before={detail.before} after={detail.after} />
							)}
						</Stack>
					) : (
						<Alert status="info">
							<AlertIcon />
							{t("recentActions.snapshotExpired")}
						</Alert>
					)}
					{rollbackMutation.isError && (
						<>
							<Divider my={4} />
							<Alert status="error">
								<AlertIcon />
								<Stack spacing={2}>
									<Text>
										{rollbackErrorDetail || t("recentActions.rollbackFailed")}
									</Text>
									{rollbackConflictPaths.length > 0 && (
										<HStack spacing={2} flexWrap="wrap">
											{rollbackConflictPaths.map((path) => (
												<Badge key={path} colorScheme="red">
													{path}
												</Badge>
											))}
										</HStack>
									)}
								</Stack>
							</Alert>
						</>
					)}
				</Box>
			)}
		</VStack>
	);
};
