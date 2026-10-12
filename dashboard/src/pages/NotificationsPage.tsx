import {
	Badge,
	Box,
	Button,
	Checkbox,
	Divider,
	FormControl,
	FormLabel,
	HStack,
	Input,
	Radio,
	RadioGroup,
	Stack,
	Switch,
	Tab,
	TabList,
	TabPanel,
	TabPanels,
	Tabs,
	Text,
	Textarea,
	useToast,
} from "@chakra-ui/react";
import dayjs from "dayjs";
import { PageHeader } from "components/ui";
import useGetUser from "hooks/useGetUser";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { getAPIErrorMessage } from "service/http";
import {
	getNotificationRecipients,
	getNotificationRules,
	getNotifications,
	getSentNotifications,
	markNotificationsRead,
	sendNotification,
	updateNotificationRule,
} from "service/notifications";
import { AdminRole } from "types/Admin";
import type { NotificationRule } from "types/Notification";

const formatTime = (unix: number) =>
	dayjs.unix(unix).format("YYYY-MM-DD HH:mm");

const InboxPanel = () => {
	const { t } = useTranslation();
	const queryClient = useQueryClient();
	const inbox = useQuery(["notifications", "inbox"], () =>
		getNotifications({ limit: 100 }),
	);
	const markAll = useMutation(() => markNotificationsRead({ all: true }), {
		onSuccess: () => queryClient.invalidateQueries("notifications"),
	});
	const markOne = useMutation(
		(id: number) => markNotificationsRead({ ids: [id] }),
		{
			onSuccess: () => queryClient.invalidateQueries("notifications"),
		},
	);
	const items = inbox.data?.items ?? [];

	return (
		<Stack spacing={4}>
			<HStack justify="space-between">
				<Text color="gray.500" fontSize="sm">
					{t("notifications.inbox.summary", {
						unread: inbox.data?.unread ?? 0,
						total: inbox.data?.total ?? 0,
					})}
				</Text>
				<Button
					size="sm"
					variant="outline"
					isDisabled={!inbox.data?.unread}
					isLoading={markAll.isLoading}
					onClick={() => markAll.mutate()}
				>
					{t("notifications.inbox.markAllRead")}
				</Button>
			</HStack>
			{items.length === 0 && (
				<Text color="gray.500">{t("notifications.inbox.empty")}</Text>
			)}
			{items.map((item) => (
				<Box
					key={item.id}
					p={4}
					borderRadius="md"
					borderWidth="1px"
					borderColor={item.read_at === null ? "blue.400" : undefined}
				>
					<HStack justify="space-between" align="start" mb={1}>
						<HStack>
							<Text fontWeight="semibold">{item.title}</Text>
							{item.read_at === null && (
								<Badge colorScheme="blue">
									{t("notifications.inbox.unread")}
								</Badge>
							)}
						</HStack>
						<Text fontSize="xs" color="gray.500" whiteSpace="nowrap">
							{formatTime(item.created_at)}
						</Text>
					</HStack>
					<Text whiteSpace="pre-wrap" fontSize="sm">
						{item.body}
					</Text>
					<HStack justify="space-between" mt={2}>
						<Text fontSize="xs" color="gray.500">
							{t("notifications.inbox.from", {
								sender: item.sender_username,
							})}
						</Text>
						{item.read_at === null && (
							<Button
								size="xs"
								variant="ghost"
								onClick={() => markOne.mutate(item.id)}
							>
								{t("notifications.inbox.markRead")}
							</Button>
						)}
					</HStack>
				</Box>
			))}
		</Stack>
	);
};

const SendPanel = () => {
	const { t } = useTranslation();
	const toast = useToast();
	const queryClient = useQueryClient();
	const recipients = useQuery(["notifications", "recipients"], () =>
		getNotificationRecipients(),
	);
	const sent = useQuery(["notifications", "sent"], () =>
		getSentNotifications(),
	);
	const [title, setTitle] = useState("");
	const [body, setBody] = useState("");
	const [audience, setAudience] = useState<"all" | "selected">("all");
	const [selected, setSelected] = useState<number[]>([]);
	const mutation = useMutation(sendNotification, {
		onSuccess: (result) => {
			toast({
				status: "success",
				title: t("notifications.send.sent", { count: result.recipients }),
			});
			setTitle("");
			setBody("");
			setSelected([]);
			queryClient.invalidateQueries("notifications");
		},
		onError: (error) => {
			toast({
				status: "error",
				title: getAPIErrorMessage(error) ?? t("notifications.send.failed"),
			});
		},
	});

	const toggle = (id: number) => {
		setSelected((current) =>
			current.includes(id)
				? current.filter((item) => item !== id)
				: [...current, id],
		);
	};

	return (
		<Stack spacing={6}>
			<Stack spacing={4} maxW="2xl">
				<FormControl isRequired>
					<FormLabel>{t("notifications.send.title")}</FormLabel>
					<Input value={title} onChange={(e) => setTitle(e.target.value)} />
				</FormControl>
				<FormControl isRequired>
					<FormLabel>{t("notifications.send.body")}</FormLabel>
					<Textarea
						value={body}
						rows={4}
						onChange={(e) => setBody(e.target.value)}
					/>
				</FormControl>
				<FormControl>
					<FormLabel>{t("notifications.send.audience")}</FormLabel>
					<RadioGroup
						value={audience}
						onChange={(value) => setAudience(value as "all" | "selected")}
					>
						<Stack direction="row" spacing={6}>
							<Radio value="all">{t("notifications.send.audienceAll")}</Radio>
							<Radio value="selected">
								{t("notifications.send.audienceSelected")}
							</Radio>
						</Stack>
					</RadioGroup>
				</FormControl>
				{audience === "selected" && (
					<Stack spacing={2} maxH="240px" overflowY="auto">
						{(recipients.data?.items ?? []).map((admin) => (
							<Checkbox
								key={admin.id}
								isChecked={selected.includes(admin.id)}
								onChange={() => toggle(admin.id)}
							>
								{admin.username}
								<Text as="span" fontSize="xs" color="gray.500" ms={2}>
									{admin.role}
								</Text>
							</Checkbox>
						))}
					</Stack>
				)}
				<HStack>
					<Button
						colorScheme="blue"
						isLoading={mutation.isLoading}
						isDisabled={
							!title.trim() ||
							!body.trim() ||
							(audience === "selected" && selected.length === 0)
						}
						onClick={() =>
							mutation.mutate({
								title,
								body,
								audience,
								admin_ids: selected,
							})
						}
					>
						{t("notifications.send.submit")}
					</Button>
				</HStack>
			</Stack>
			<Divider />
			<Stack spacing={3}>
				<Text fontWeight="semibold">{t("notifications.send.history")}</Text>
				{(sent.data?.items ?? []).length === 0 && (
					<Text color="gray.500" fontSize="sm">
						{t("notifications.send.historyEmpty")}
					</Text>
				)}
				{(sent.data?.items ?? []).map((item) => (
					<Box key={item.id} p={3} borderRadius="md" borderWidth="1px">
						<HStack justify="space-between">
							<Text fontWeight="medium">{item.title}</Text>
							<Text fontSize="xs" color="gray.500">
								{formatTime(item.created_at)}
							</Text>
						</HStack>
						<Text fontSize="sm" whiteSpace="pre-wrap">
							{item.body}
						</Text>
						<Text fontSize="xs" color="gray.500" mt={1}>
							{t("notifications.send.readCount", {
								read: item.read,
								total: item.recipients,
							})}
						</Text>
					</Box>
				))}
			</Stack>
		</Stack>
	);
};

const RuleEditor = ({ rule }: { rule: NotificationRule }) => {
	const { t } = useTranslation();
	const toast = useToast();
	const queryClient = useQueryClient();
	const [enabled, setEnabled] = useState(rule.enabled);
	const [threshold, setThreshold] = useState(String(rule.threshold));
	const [title, setTitle] = useState(rule.title);
	const [body, setBody] = useState(rule.body);
	const save = useMutation(
		(payload: {
			enabled: boolean;
			threshold: number;
			title: string;
			body: string;
		}) => updateNotificationRule(rule.key, payload),
		{
			onSuccess: () => {
				toast({ status: "success", title: t("notifications.rules.saved") });
				queryClient.invalidateQueries(["notifications", "rules"]);
			},
			onError: (error) => {
				toast({
					status: "error",
					title: getAPIErrorMessage(error) ?? t("notifications.rules.failed"),
				});
			},
		},
	);

	const submit = () =>
		save.mutate({
			enabled,
			threshold: rule.unit === "none" ? 0 : Number(threshold),
			title,
			body,
		});

	const resetToDefaults = () => {
		setEnabled(rule.default_enabled);
		setThreshold(String(rule.default_threshold));
		setTitle(rule.default_title);
		setBody(rule.default_body);
		save.mutate({
			enabled: rule.default_enabled,
			threshold: rule.unit === "none" ? 0 : rule.default_threshold,
			title: rule.default_title,
			body: rule.default_body,
		});
	};

	return (
		<Box p={4} borderRadius="md" borderWidth="1px">
			<HStack justify="space-between" mb={3}>
				<Text fontWeight="semibold">
					{t(`notifications.rules.name.${rule.key}`)}
				</Text>
				<HStack>
					<Text fontSize="sm">{t("notifications.rules.enabled")}</Text>
					<Switch
						isChecked={enabled}
						onChange={(e) => setEnabled(e.target.checked)}
					/>
				</HStack>
			</HStack>
			<Stack spacing={3}>
				{rule.unit !== "none" && (
					<FormControl maxW="200px">
						<FormLabel>
							{t("notifications.rules.threshold")} (
							{rule.unit === "percent"
								? t("notifications.rules.unitPercent")
								: t("notifications.rules.unitDays")}
							)
						</FormLabel>
						<Input
							type="number"
							min={1}
							max={rule.unit === "percent" ? 100 : 365}
							value={threshold}
							onChange={(e) => setThreshold(e.target.value)}
						/>
					</FormControl>
				)}
				<FormControl>
					<FormLabel>{t("notifications.send.title")}</FormLabel>
					<Input value={title} onChange={(e) => setTitle(e.target.value)} />
				</FormControl>
				<FormControl>
					<FormLabel>{t("notifications.send.body")}</FormLabel>
					<Textarea
						rows={3}
						value={body}
						onChange={(e) => setBody(e.target.value)}
					/>
				</FormControl>
				<Text fontSize="xs" color="gray.500">
					{t("notifications.rules.placeholders", {
						list: rule.placeholders.map((item) => `{${item}}`).join(", "),
					})}
				</Text>
				<Text fontSize="xs" color="gray.500">
					{t(
						rule.recipients === "admin"
							? "notifications.rules.recipientsAdmin"
							: "notifications.rules.recipientsOperators",
					)}
				</Text>
				<HStack>
					<Button
						size="sm"
						colorScheme="blue"
						isLoading={save.isLoading}
						onClick={submit}
					>
						{t("notifications.rules.save")}
					</Button>
					<Button size="sm" variant="outline" onClick={resetToDefaults}>
						{t("notifications.rules.reset")}
					</Button>
				</HStack>
			</Stack>
		</Box>
	);
};

const RulesPanel = () => {
	const { t } = useTranslation();
	const rules = useQuery(["notifications", "rules"], () =>
		getNotificationRules(),
	);
	return (
		<Stack spacing={4}>
			<Text color="gray.500" fontSize="sm">
				{t("notifications.rules.description")}
			</Text>
			{(rules.data?.items ?? []).map((rule) => (
				<RuleEditor key={rule.key} rule={rule} />
			))}
		</Stack>
	);
};

export default function NotificationsPage() {
	const { t } = useTranslation();
	const { userData } = useGetUser();
	const canSend =
		userData.role === AdminRole.Sudo || userData.role === AdminRole.FullAccess;
	const isFullAccess = userData.role === AdminRole.FullAccess;

	return (
		<Stack spacing={5}>
			<PageHeader
				title={t("notifications.menu")}
				description={t("notifications.description")}
			/>
			<Tabs variant="enclosed" isLazy>
				<TabList>
					<Tab>{t("notifications.tabs.inbox")}</Tab>
					{canSend && <Tab>{t("notifications.tabs.send")}</Tab>}
					{isFullAccess && <Tab>{t("notifications.tabs.rules")}</Tab>}
				</TabList>
				<TabPanels>
					<TabPanel px={0}>
						<InboxPanel />
					</TabPanel>
					{canSend && (
						<TabPanel px={0}>
							<SendPanel />
						</TabPanel>
					)}
					{isFullAccess && (
						<TabPanel px={0}>
							<RulesPanel />
						</TabPanel>
					)}
				</TabPanels>
			</Tabs>
		</Stack>
	);
}
