import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "components/ui/badge";
import { Button } from "components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "components/ui/popover";
import dayjs from "dayjs";
import { cn } from "lib/cn";
import { Bell } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { getNotifications, markNotificationsRead } from "service/notifications";
import type { NotificationItem } from "types/Notification";

export const NotificationBell = () => {
	const { t, i18n } = useTranslation();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const isRTL = i18n.dir(i18n.language) === "rtl";

	const inbox = useQuery({
		queryKey: ["notifications", "bell"],
		queryFn: () => getNotifications({ limit: 6 }),
		refetchInterval: 30000,
	});

	const markAll = useMutation({
		mutationFn: () => markNotificationsRead({ all: true }),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: ["notifications"] }),
	});

	const markOne = useMutation({
		mutationFn: (id: number) => markNotificationsRead({ ids: [id] }),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: ["notifications"] }),
	});

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
					<Button
						type="button"
						aria-label={t("notifications.bell.label")}
						variant="outline"
						size="sm"
						className="h-[34px] w-[34px] p-0 rounded-full md:rounded-[12px] border border-panel-border! bg-panel-surface text-panel-text shadow-xs md:hover:bg-panel-elevated md:hover:border-panel-border-strong! transition-colors cursor-pointer shrink-0"
					>
						<Bell className="w-[18px] h-[18px]" />
					</Button>
					{unread > 0 && (
						<Badge className="bg-destructive text-white absolute -top-1 -end-1 rounded-full text-[10px] px-1.5 py-0 min-w-4 h-4 flex items-center justify-center border border-panel-surface pointer-events-none">
							{unread > 99 ? "99+" : unread}
						</Badge>
					)}
				</div>
			</PopoverTrigger>
			<PopoverContent
				align={isRTL ? "start" : "end"}
				className="w-[340px] max-h-[420px] overflow-y-auto rounded-[14px] border border-panel-border! bg-panel-surface text-panel-text shadow-xl z-50 p-3"
			>
				<div className="flex flex-row items-center gap-2 justify-between mb-2">
					<span className="font-semibold text-panel-text text-sm">
						{t("notifications.bell.label")}
					</span>
					{unread > 0 && (
						<Button
							type="button"
							onClick={() => markAll.mutate()}
							variant="ghost"
							size="xs"
							disabled={markAll.isPending}
							className="text-panel-accent md:hover:text-panel-accent-hover md:hover:bg-panel-elevated text-xs h-7 px-2"
						>
							{t("notifications.inbox.markAllRead")}
						</Button>
					)}
				</div>
				{items.length === 0 ? (
					<p className="text-sm text-panel-text-muted py-4 text-center">
						{t("notifications.bell.empty")}
					</p>
				) : (
					<div className="flex flex-col gap-2">
						{items.map((item) => (
							<button
								type="button"
								key={item.id}
								onClick={() => openItem(item)}
								className={cn(
									"text-start p-2.5 rounded-[10px] border border-panel-border! bg-panel-elevated/40 md:hover:bg-panel-elevated transition-colors cursor-pointer",
									item.read_at === null ? "opacity-100 font-medium" : "opacity-70",
								)}
							>
								<p className="text-sm font-semibold truncate text-panel-text">
									{item.title}
								</p>
								<p className="text-xs line-clamp-2 text-panel-text-secondary mt-0.5">
									{item.body}
								</p>
								<span
									dir="ltr"
									style={{ unicodeBidi: "isolate" }}
									className="text-[10px] text-panel-text-muted mt-1 block tabular-nums"
								>
									{dayjs.unix(item.created_at).format("YYYY-MM-DD HH:mm")}
								</span>
							</button>
						))}
					</div>
				)}
				<Button
					type="button"
					onClick={() => navigate("/notifications")}
					variant="outline"
					size="sm"
					className="mt-3 w-full rounded-[10px] border border-panel-border! text-panel-text md:hover:bg-panel-elevated h-8 text-xs font-medium"
				>
					{t("notifications.bell.viewAll")}
				</Button>
			</PopoverContent>
		</Popover>
	);
};
