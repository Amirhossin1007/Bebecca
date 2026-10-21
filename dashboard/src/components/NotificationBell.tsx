import { Popover, PopoverBody, PopoverContent, PopoverTrigger } from "components/shadcn/popover";
import { Button, IconButton } from "components/shadcn/button";
import { Badge } from "components/shadcn/badge";
import { cn } from "lib/cn";
import { BellIcon } from "@heroicons/react/24/outline";
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
		<Popover placement="bottom-end" isLazy>
			<PopoverTrigger>
				<div className="relative inline-flex">
					<IconButton aria-label={t("notifications.bell.label")} size="sm" variant="ghost" className="rounded-full" >{<BellIcon className="w-[18px] h-[18px]" />}</IconButton>
					{unread > 0 && (
						<Badge colorScheme="red" className="absolute top--1 right--1 rounded-full text-[0.625rem] px-1.5">
							{unread > 99 ? "99+" : unread}
						</Badge>
					)}
				</div>
			</PopoverTrigger>
			<PopoverContent className="w-[340px] max-h-[420px] overflow-y-auto">
				<PopoverBody>
					<div className="flex flex-row items-center gap-2 justify-between mb-2">
						<p className="font-semibold">{t("notifications.bell.label")}</p>
						{unread > 0 && (
							<Button size="xs" variant="ghost" onClick={() => markAll.mutate()} loading={markAll.isPending}>
								{t("notifications.inbox.markAllRead")}
							</Button>
						)}
					</div>
					{items.length === 0 ? (
						<p className="text-[0.875rem] text-gray-500">
							{t("notifications.bell.empty")}
						</p>
					) : (
						<div className="flex flex-col gap-2">
							{items.map((item) => (
								<button type="button" key={item.id} onClick={() => openItem(item)} className={cn("text-start p-2 rounded-md border", item.read_at === null ? "opacity-100" : "opacity-70")}>
									<p className="text-[0.875rem] font-semibold truncate">
										{item.title}
									</p>
									<p className="text-[0.75rem] line-clamp-2">
										{item.body}
									</p>
									<p className="text-[0.625rem] text-gray-500">
										{dayjs.unix(item.created_at).format("YYYY-MM-DD HH:mm")}
									</p>
								</button>
							))}
						</div>
					)}
					<Button size="sm" variant="outline" onClick={() => navigate("/notifications")} className="mt-3 w-full">
						{t("notifications.bell.viewAll")}
					</Button>
				</PopoverBody>
			</PopoverContent>
		</Popover>
	);
};
