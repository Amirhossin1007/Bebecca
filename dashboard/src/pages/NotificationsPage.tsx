import { Button } from "components/shadcn/button";
import { Badge } from "components/shadcn/badge";
import { useToast } from "components/shadcn/toast";
import { FormControl, FormLabel } from "components/shadcn/field";
import { Input, Textarea } from "components/shadcn/input";
import { Checkbox, Radio, RadioGroup, Switch } from "components/shadcn/selection";
import { Tab, TabList, TabPanel, TabPanels, Tabs } from "components/shadcn/tabs";
import { cn } from "lib/cn";
import dayjs from "dayjs";
import { PageHeader } from "components/ui";
import useGetUser from "hooks/useGetUser";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
	const inbox = useQuery({ queryKey: ["notifications", "inbox"], queryFn: () =>
		getNotifications({ limit: 100 }) });
	const markAll = useMutation({ mutationFn: () => markNotificationsRead({ all: true }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }), });
	const markOne = useMutation({ mutationFn: (id: number) => markNotificationsRead({ ids: [id] }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }), });
	const items = inbox.data?.items ?? [];

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-row items-center gap-2 justify-between">
				<p className="text-gray-500 text-[0.875rem]">
					{t("notifications.inbox.summary", {
						unread: inbox.data?.unread ?? 0,
						total: inbox.data?.total ?? 0,
					})}
				</p>
				<Button size="sm" variant="outline" disabled={!inbox.data?.unread} loading={markAll.isPending} onClick={() => markAll.mutate()}>
					{t("notifications.inbox.markAllRead")}
				</Button>
			</div>
			{items.length === 0 && (
				<p className="text-gray-500">{t("notifications.inbox.empty")}</p>
			)}
			{items.map((item) => (
				<div key={item.id} className={cn("p-4 rounded-md border", item.read_at === null ? "border-blue-400!" : "")}>
					<div className="flex flex-row gap-2 justify-between items-start mb-1">
						<div className="flex flex-row items-center gap-2">
							<p className="font-semibold">{item.title}</p>
							{item.read_at === null && (
								<Badge colorScheme="blue">
									{t("notifications.inbox.unread")}
								</Badge>
							)}
						</div>
						<p className="text-[0.75rem] text-gray-500 whitespace-nowrap">
							{formatTime(item.created_at)}
						</p>
					</div>
					<p className="whitespace-pre-wrap text-[0.875rem]">
						{item.body}
					</p>
					<div className="flex flex-row items-center gap-2 justify-between mt-2">
						<p className="text-[0.75rem] text-gray-500">
							{t("notifications.inbox.from", {
								sender: item.sender_username,
							})}
						</p>
						{item.read_at === null && (
							<Button size="xs" variant="ghost" onClick={() => markOne.mutate(item.id)}>
								{t("notifications.inbox.markRead")}
							</Button>
						)}
					</div>
				</div>
			))}
		</div>
	);
};

const SendPanel = () => {
	const { t } = useTranslation();
	const toast = useToast();
	const queryClient = useQueryClient();
	const recipients = useQuery({ queryKey: ["notifications", "recipients"], queryFn: () =>
		getNotificationRecipients() });
	const sent = useQuery({ queryKey: ["notifications", "sent"], queryFn: () =>
		getSentNotifications() });
	const [title, setTitle] = useState("");
	const [body, setBody] = useState("");
	const [audience, setAudience] = useState<"all" | "selected">("all");
	const [selected, setSelected] = useState<number[]>([]);
	const mutation = useMutation({ mutationFn: sendNotification, onSuccess: (result) => {
			toast({
				status: "success",
				title: t("notifications.send.sent", { count: result.recipients }),
			});
			setTitle("");
			setBody("");
			setSelected([]);
			queryClient.invalidateQueries({ queryKey: ["notifications"] });
		},
		onError: (error) => {
			toast({
				status: "error",
				title: getAPIErrorMessage(error) ?? t("notifications.send.failed"),
			});
		}, });

	const toggle = (id: number) => {
		setSelected((current) =>
			current.includes(id)
				? current.filter((item) => item !== id)
				: [...current, id],
		);
	};

	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-col gap-4 max-w-[42rem]">
				<FormControl required>
					<FormLabel>{t("notifications.send.title")}</FormLabel>
					<Input value={title} onChange={(e) => setTitle(e.target.value)} />
				</FormControl>
				<FormControl required>
					<FormLabel>{t("notifications.send.body")}</FormLabel>
					<Textarea value={body} rows={4} onChange={(e) => setBody(e.target.value)} />
				</FormControl>
				<FormControl>
					<FormLabel>{t("notifications.send.audience")}</FormLabel>
					<RadioGroup value={audience} onChange={(value) => setAudience(value as "all" | "selected")}>
						<div className="flex flex-row gap-6">
							<Radio value="all">{t("notifications.send.audienceAll")}</Radio>
							<Radio value="selected">
								{t("notifications.send.audienceSelected")}
							</Radio>
						</div>
					</RadioGroup>
				</FormControl>
				{audience === "selected" && (
					<div className="flex flex-col gap-2 max-h-[240px] overflow-y-auto">
						{(recipients.data?.items ?? []).map((admin) => (
							<Checkbox key={admin.id} checked={selected.includes(admin.id)} onChange={() => toggle(admin.id)}>
								{admin.username}
								<span className="text-[0.75rem] text-gray-500 ms-2">
									{admin.role}
								</span>
							</Checkbox>
						))}
					</div>
				)}
				<div className="flex flex-row items-center gap-2">
					<Button size="md" colorScheme="blue" loading={mutation.isPending} disabled={
							!title.trim() ||
							!body.trim() ||
							(audience === "selected" && selected.length === 0)
						} onClick={() =>
							mutation.mutate({
								title,
								body,
								audience,
								admin_ids: selected,
							})
						}>
						{t("notifications.send.submit")}
					</Button>
				</div>
			</div>
			<hr className="w-full border-0 border-b border-panel-border! opacity-60" />
			<div className="flex flex-col gap-3">
				<p className="font-semibold">{t("notifications.send.history")}</p>
				{(sent.data?.items ?? []).length === 0 && (
					<p className="text-gray-500 text-[0.875rem]">
						{t("notifications.send.historyEmpty")}
					</p>
				)}
				{(sent.data?.items ?? []).map((item) => (
					<div key={item.id} className="p-3 rounded-md border">
						<div className="flex flex-row items-center gap-2 justify-between">
							<p className="font-medium">{item.title}</p>
							<p className="text-[0.75rem] text-gray-500">
								{formatTime(item.created_at)}
							</p>
						</div>
						<p className="text-[0.875rem] whitespace-pre-wrap">
							{item.body}
						</p>
						<p className="text-[0.75rem] text-gray-500 mt-1">
							{t("notifications.send.readCount", {
								read: item.read,
								total: item.recipients,
							})}
						</p>
					</div>
				))}
			</div>
		</div>
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
	const save = useMutation({ mutationFn: (payload: {
			enabled: boolean;
			threshold: number;
			title: string;
			body: string;
		}) => updateNotificationRule(rule.key, payload), onSuccess: () => {
				toast({ status: "success", title: t("notifications.rules.saved") });
				queryClient.invalidateQueries({ queryKey: ["notifications", "rules"] });
			},
			onError: (error) => {
				toast({
					status: "error",
					title: getAPIErrorMessage(error) ?? t("notifications.rules.failed"),
				});
			}, });

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
		<div className="p-4 rounded-md border">
			<div className="flex flex-row items-center gap-2 justify-between mb-3">
				<p className="font-semibold">
					{t(`notifications.rules.name.${rule.key}`)}
				</p>
				<div className="flex flex-row items-center gap-2">
					<p className="text-[0.875rem]">{t("notifications.rules.enabled")}</p>
					<Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
				</div>
			</div>
			<div className="flex flex-col gap-3">
				{rule.unit !== "none" && (
					<FormControl className="max-w-[200px]">
						<FormLabel>
							{t("notifications.rules.threshold")} (
							{rule.unit === "percent"
								? t("notifications.rules.unitPercent")
								: t("notifications.rules.unitDays")}
							)
						</FormLabel>
						<Input type="number" min={1} max={rule.unit === "percent" ? 100 : 365} value={threshold} onChange={(e) => setThreshold(e.target.value)} />
					</FormControl>
				)}
				<FormControl>
					<FormLabel>{t("notifications.send.title")}</FormLabel>
					<Input value={title} onChange={(e) => setTitle(e.target.value)} />
				</FormControl>
				<FormControl>
					<FormLabel>{t("notifications.send.body")}</FormLabel>
					<Textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
				</FormControl>
				<p className="text-[0.75rem] text-gray-500">
					{t("notifications.rules.placeholders", {
						list: rule.placeholders.map((item) => `{${item}}`).join(", "),
					})}
				</p>
				<p className="text-[0.75rem] text-gray-500">
					{t(
						rule.recipients === "admin"
							? "notifications.rules.recipientsAdmin"
							: "notifications.rules.recipientsOperators",
					)}
				</p>
				<div className="flex flex-row items-center gap-2">
					<Button size="sm" colorScheme="blue" loading={save.isPending} onClick={submit}>
						{t("notifications.rules.save")}
					</Button>
					<Button size="sm" variant="outline" onClick={resetToDefaults}>
						{t("notifications.rules.reset")}
					</Button>
				</div>
			</div>
		</div>
	);
};

const RulesPanel = () => {
	const { t } = useTranslation();
	const rules = useQuery({ queryKey: ["notifications", "rules"], queryFn: () =>
		getNotificationRules() });
	return (
		<div className="flex flex-col gap-4">
			<p className="text-gray-500 text-[0.875rem]">
				{t("notifications.rules.description")}
			</p>
			{(rules.data?.items ?? []).map((rule) => (
				<RuleEditor key={rule.key} rule={rule} />
			))}
		</div>
	);
};

export default function NotificationsPage() {
	const { t } = useTranslation();
	const { userData } = useGetUser();
	const canSend =
		userData.role === AdminRole.Sudo || userData.role === AdminRole.FullAccess;
	const isFullAccess = userData.role === AdminRole.FullAccess;

	return (
		<div className="flex flex-col gap-5">
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
					<TabPanel className="px-0">
						<InboxPanel />
					</TabPanel>
					{canSend && (
						<TabPanel className="px-0">
							<SendPanel />
						</TabPanel>
					)}
					{isFullAccess && (
						<TabPanel className="px-0">
							<RulesPanel />
						</TabPanel>
					)}
				</TabPanels>
			</Tabs>
		</div>
	);
}
