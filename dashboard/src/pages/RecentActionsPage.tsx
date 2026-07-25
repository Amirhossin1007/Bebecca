import {
	Alert,
	AlertIcon,
	Badge,
	Box,
	Button,
	Divider,
	HStack,
	SimpleGrid,
	Spinner,
	Stack,
	Text,
	VStack,
} from "@chakra-ui/react";
import { ArrowPathIcon, ArrowUturnLeftIcon } from "@heroicons/react/24/outline";
import { JsonEditor } from "components/JsonEditor";
import { PageHeader } from "components/ui";
import dayjs from "dayjs";
import useGetUser from "hooks/useGetUser";
import { type FC, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { fetch } from "service/http";
import { AdminRole, AdminSudoScope } from "types/Admin";

type RecentAction = {
	id: number;
	action_type: string;
	resource_type: string;
	resource_key: string;
	actor_username: string;
	auth_source: string;
	summary: string;
	rollback_status: "available" | "undone" | "expired" | "conflict" | "unsupported";
	created_at: string;
	snapshot_expires_at?: string | null;
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

const changedPaths = (before: unknown, after: unknown, path = "", output: string[] = []) => {
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
		const keys = Array.from(new Set([...Object.keys(left), ...Object.keys(right)])).sort();
		for (const key of keys) changedPaths(left[key], right[key], `${path}/${key}`, output);
		return output;
	}
	output.push(path || "/");
	return output;
};

export const RecentActionsPage: FC = () => {
	const { t } = useTranslation();
	const queryClient = useQueryClient();
	const { userData, getUserIsSuccess } = useGetUser();
	const canView =
		getUserIsSuccess &&
		(userData.role === AdminRole.FullAccess ||
			(userData.role === AdminRole.Sudo &&
				Boolean(userData.permissions?.sudo?.[AdminSudoScope.Xray])));
	const [beforeID, setBeforeID] = useState<number | null>(null);
	const [selectedID, setSelectedID] = useState<number | null>(null);

	const actionsQuery = useQuery(
		["recent-actions", beforeID],
		() =>
			fetch<RecentActionsResponse>(
				beforeID ? `/core/recent-actions?before_id=${beforeID}` : "/core/recent-actions",
			),
		{ enabled: canView, staleTime: 15_000, refetchOnWindowFocus: false },
	);
	const detailQuery = useQuery(
		["recent-action", selectedID],
		() => fetch<RecentActionDetail>(`/core/recent-actions/${selectedID}`),
		{ enabled: canView && selectedID !== null, refetchOnWindowFocus: false },
	);
	const rollbackMutation = useMutation(
		(id: number) => fetch(`/core/recent-actions/${id}/rollback`, { method: "POST" }),
		{
			onSuccess: async () => {
				await queryClient.invalidateQueries("recent-actions");
				if (selectedID !== null) {
					await queryClient.invalidateQueries(["recent-action", selectedID]);
				}
			},
		},
	);

	if (!canView) {
		return (
			<Box p={{ base: 4, md: 6 }}>
				<Alert status="error" borderRadius="md">
					<AlertIcon />
					{t("recentActions.noPermission")}
				</Alert>
			</Box>
		);
	}

	const actions = actionsQuery.data?.actions ?? [];
	const detail = detailQuery.data;
	const configChanges = detail?.config_changes ?? [];
	const diffPaths = configChanges.length > 0
		? configChanges.map((change) => `${change.target_id}:${change.path || "/"}`)
		: detail?.snapshot_available
		? changedPaths(detail.before, detail.after)
		: [];
	const rollbackError = rollbackMutation.error as { data?: { detail?: string; conflict_paths?: string[] }; message?: string } | null;
	const rollbackErrorDetail = rollbackError?.data?.detail || rollbackError?.message;
	const rollbackConflictPaths = rollbackError?.data?.conflict_paths ?? [];
	const rollback = (action: RecentAction) => {
		if (!window.confirm(t("recentActions.rollbackConfirm"))) return;
		rollbackMutation.mutate(action.id);
	};

	return (
		<Box p={{ base: 4, md: 6 }}>
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

			{actionsQuery.isLoading ? (
				<HStack justify="center" py={16}>
					<Spinner />
				</HStack>
			) : actionsQuery.isError ? (
				<Alert status="error" mt={6} borderRadius="md">
					<AlertIcon />
					{t("recentActions.loadFailed")}
				</Alert>
			) : (
				<Stack mt={6} spacing={3}>
					{actions.length === 0 && (
						<Alert status="info" borderRadius="md">
							<AlertIcon />
							{t("recentActions.empty")}
						</Alert>
					)}
					{actions.map((action) => (
						<Box
							key={action.id}
							bg="panel.surface"
							borderWidth="1px"
							borderColor="panel.border"
							borderRadius="md"
							p={4}
						>
							<Stack direction={{ base: "column", md: "row" }} justify="space-between" spacing={3}>
								<VStack align="start" spacing={1} minW={0}>
									<HStack flexWrap="wrap">
										<Badge colorScheme={statusTone(action.rollback_status)}>
											{t(`recentActions.status.${action.rollback_status}`)}
										</Badge>
										<Badge variant="subtle">{action.action_type}</Badge>
									</HStack>
									<Text fontWeight="semibold">{action.summary}</Text>
									<Text color="panel.textSecondary" fontSize="sm">
										{t("recentActions.actor", { username: action.actor_username })} · {dayjs(action.created_at).format("YYYY-MM-DD HH:mm")}
									</Text>
								</VStack>
								<HStack alignSelf={{ base: "start", md: "center" }}>
									<Button size="sm" variant="outline" onClick={() => setSelectedID(action.id)}>
										{t("recentActions.details")}
									</Button>
									{action.rollback_status === "available" && (
										<Button
											size="sm"
											colorScheme="orange"
											leftIcon={<ArrowUturnLeftIcon width={16} />}
											onClick={() => rollback(action)}
											isLoading={rollbackMutation.isLoading && rollbackMutation.variables === action.id}
										>
											{t("recentActions.rollback")}
										</Button>
									)}
								</HStack>
							</Stack>
						</Box>
					))}
					{actionsQuery.data?.next_before_id && (
						<Button variant="outline" onClick={() => setBeforeID(actionsQuery.data?.next_before_id ?? null)}>
							{t("recentActions.loadMore")}
						</Button>
					)}
				</Stack>
			)}

			{selectedID !== null && (
				<Box mt={8} bg="panel.surface" borderWidth="1px" borderColor="panel.border" borderRadius="md" p={4}>
					<HStack justify="space-between" mb={4}>
						<Text fontWeight="semibold">{t("recentActions.changePreview")}</Text>
						<Button size="sm" variant="ghost" onClick={() => setSelectedID(null)}>{t("close")}</Button>
					</HStack>
					{detailQuery.isLoading ? (
						<HStack justify="center" py={10}><Spinner /></HStack>
					) : detailQuery.isError ? (
						<Alert status="error"><AlertIcon />{t("recentActions.loadFailed")}</Alert>
					) : detail?.snapshot_available ? (
						<Stack spacing={4}>
							{diffPaths.length > 0 && (
								<Box>
									<Text fontSize="sm" color="panel.textSecondary" mb={2}>{t("recentActions.changedPaths")}</Text>
									<HStack spacing={2} flexWrap="wrap">
										{diffPaths.map((path) => <Badge key={path} colorScheme="orange">{path}</Badge>)}
									</HStack>
								</Box>
							)}
							{configChanges.length > 0 ? (
								<Stack spacing={4} maxH="900px" overflowY="auto">
									{configChanges.map((change, index) => (
										<Box key={`${change.target_id}-${change.path}-${index}`} borderWidth="1px" borderColor="panel.border" borderRadius="md" p={3}>
											<Text fontSize="sm" color="panel.textSecondary" mb={3}>{change.target_id}:{change.path || "/"}</Text>
											<SimpleGrid columns={{ base: 1, xl: 2 }} spacing={4}>
												<Box>
													<Text fontWeight="medium" mb={2}>{t("recentActions.before")}</Text>
													<JsonEditor json={change.before_exists ? change.before : null} onChange={() => undefined} readOnly showToolbar={false} minHeight="180px" />
												</Box>
												<Box>
													<Text fontWeight="medium" mb={2}>{t("recentActions.after")}</Text>
													<JsonEditor json={change.after_exists ? change.after : null} onChange={() => undefined} readOnly showToolbar={false} minHeight="180px" />
												</Box>
											</SimpleGrid>
										</Box>
									))}
								</Stack>
							) : (
								<SimpleGrid columns={{ base: 1, xl: 2 }} spacing={4}>
									<Box>
										<Text fontWeight="medium" mb={2}>{t("recentActions.before")}</Text>
										<JsonEditor json={detail.before} onChange={() => undefined} readOnly showToolbar={false} minHeight="440px" />
									</Box>
									<Box>
										<Text fontWeight="medium" mb={2}>{t("recentActions.after")}</Text>
										<JsonEditor json={detail.after} onChange={() => undefined} readOnly showToolbar={false} minHeight="440px" />
									</Box>
								</SimpleGrid>
							)}
						</Stack>
					) : (
						<Alert status="info"><AlertIcon />{t("recentActions.snapshotExpired")}</Alert>
					)}
					{rollbackMutation.isError && <><Divider my={4} /><Alert status="error"><AlertIcon /><Stack spacing={2}><Text>{rollbackErrorDetail || t("recentActions.rollbackFailed")}</Text>{rollbackConflictPaths.length > 0 && <HStack spacing={2} flexWrap="wrap">{rollbackConflictPaths.map((path) => <Badge key={path} colorScheme="red">{path}</Badge>)}</HStack>}</Stack></Alert></>}
				</Box>
			)}
		</Box>
	);
};
