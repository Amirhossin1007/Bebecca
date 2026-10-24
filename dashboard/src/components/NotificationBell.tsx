import { Button } from "components/ui/button";
import { Badge } from "components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "components/ui/popover";
import { Bell } from "lucide-react";

import { cn } from "lib/cn";
import dayjs from "dayjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import type { NotificationItem } from "types/Notification";
import { getNotifications, markNotificationsRead } from "service/notifications";

export const NotificationBell = () => {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const inbox = useQuery({ queryKey: ["notifications", "bell"], queryFn: () => getNotifications({ limit: 6 }), refetchInterval: 30000 });
	const markAll = useMutation({ mutationFn: () => markNotificationsRead({ all: true }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }), });
	const markOne = useMutation({ mutationFn: (id: number) => markNotificationsRead({ ids: [id] }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }), });
	const unread = inbox.data?.unread ?? 0;
	const items = inbox.data?.items ?? [];

	const openItem = (item: NotificationItem) => {
		if (item.read_at === null) {
			markOne.mutate(item.id);
		}
		navigate("/notifications");
	};

	return (
		<Popover>
			<PopoverTrigger asChild>
				<div className="relative inline-flex">
					<Button aria-label={t("notifications.bell.label")} variant="outline" size="sm" className={cn("size-[34px] p-0 rounded-full md:rounded-[12px] border-panel-border! bg-panel-surface text-panel-text shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:bg-panel-elevated hover:border-panel-border-strong! transition-colors")}>{<Bell className="w-[18px] h-[18px]" />}</Button>
					{unread > 0 && (
						<Badge className={cn("bg-destructive/10 text-destructive", "absolute top--1 right--1 rounded-full text-[0.625rem] px-1.5")}>
							{unread > 99 ? "99+" : unread}
						</Badge>
					)}
				</div>
			</PopoverTrigger>
			<PopoverContent className="w-[340px] max-h-[420px] overflow-y-auto rounded-[14px] border border-panel-border! bg-panel-surface text-panel-text shadow-xl backdrop-blur-md z-[9999]">
				<div className="p-3">
					<div className="flex flex-row items-center gap-2 justify-between mb-2">
						<p className="font-semibold text-panel-text">{t("notifications.bell.label")}</p>
						{unread > 0 && (
							<Button onClick={() => markAll.mutate()} variant="ghost" size="xs" loading={markAll.isPending} className="text-panel-accent hover:text-panel-accent-hover hover:bg-panel-elevated">
								{t("notifications.inbox.markAllRead")}
							</Button>
						)}
					</div>
					{items.length === 0 ? (
						<p className="text-[0.875rem] text-panel-text-muted">
							{t("notifications.bell.empty")}
						</p>
					) : (
						<div className="flex flex-col gap-2">
							{items.map((item) => (
								<button type="button" key={item.id} onClick={() => openItem(item)} className={cn("text-start p-2.5 rounded-[10px] border border-panel-border! bg-panel-elevated/40 hover:bg-panel-elevated transition-colors", item.read_at === null ? "opacity-100 font-medium" : "opacity-70")}>
									<p className="text-[0.875rem] font-semibold truncate text-panel-text">
										{item.title}
									</p>
									<p className="text-[0.75rem] line-clamp-2 text-panel-text-secondary">
										{item.body}
									</p>
									<p className="text-[0.625rem] text-panel-text-muted mt-1">
										{dayjs.unix(item.created_at).format("YYYY-MM-DD HH:mm")}
									</p>
								</button>
							))}
						</div>
					)}
					<Button onClick={() => navigate("/notifications")} variant="outline" size="sm" className="mt-3 w-full rounded-[10px] border-panel-border! text-panel-text hover:bg-panel-elevated">
						{t("notifications.bell.viewAll")}
					</Button>
				</div>
			</PopoverContent>
		</Popover>
	);
};
