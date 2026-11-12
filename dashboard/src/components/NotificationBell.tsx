import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "components/ui/popover";
import dayjs from "dayjs";
import { AnimatePresence, motion } from "framer-motion";
import { useDisclosure } from "hooks/useDisclosure";
import { useMediaQuery } from "hooks/useMediaQuery";
import { cn } from "lib/cn";
import {
	ArrowLeft,
	ArrowRight,
	Bell,
	CheckCheck,
	MailOpen,
	X,
} from "lucide-react";
import {
	createContext,
	type FC,
	type MouseEvent as ReactMouseEvent,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { getNotifications, markNotificationsRead } from "service/notifications";
import type { NotificationItem } from "types/Notification";

type NotificationContextValue = {
	unread: number;
	items: NotificationItem[];
	isOpen: boolean;
	onOpen: () => void;
	onClose: () => void;
	markAll: () => void;
	isMarkingAll: boolean;
	openItem: (item: NotificationItem) => void;
	incomingNotification: NotificationItem | null;
	dismissIncomingNotification: () => void;
};

const NotificationContext = createContext<NotificationContextValue | null>(
	null,
);

export const NotificationProvider: FC<{ children: ReactNode }> = ({
	children,
}) => {
	const { t, i18n } = useTranslation();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { isOpen, onOpen, onClose } = useDisclosure();
	const [incomingNotification, setIncomingNotification] =
		useState<NotificationItem | null>(null);
	const previousItemsRef = useRef<number[] | null>(null);
	const initialFetchDone = useRef(false);

	const inbox = useQuery({
		queryKey: ["notifications", "bell"],
		queryFn: () => getNotifications({ limit: 8 }),
		refetchInterval: 25000,
		refetchOnWindowFocus: true,
	});

	const markAllMutation = useMutation({
		mutationFn: () => markNotificationsRead({ all: true }),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: ["notifications"] }),
	});

	const markOneMutation = useMutation({
		mutationFn: (id: number) => markNotificationsRead({ ids: [id] }),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: ["notifications"] }),
	});

	const unread = inbox.data?.unread ?? 0;
	const items = inbox.data?.items ?? [];

	useEffect(() => {
		if (!inbox.data) return;
		const currentIds = items.map((item) => item.id);

		if (!initialFetchDone.current) {
			initialFetchDone.current = true;
			previousItemsRef.current = currentIds;
			return;
		}

		if (previousItemsRef.current) {
			const previousIds = new Set(previousItemsRef.current);
			const newItems = items.filter(
				(item) => !previousIds.has(item.id) && item.read_at === null,
			);
			if (newItems.length > 0) {
				setIncomingNotification(newItems[0]);
			}
		}

		previousItemsRef.current = currentIds;
	}, [inbox.data, items]);

	useEffect(() => {
		if (!incomingNotification) return;
		const timer = window.setTimeout(() => {
			setIncomingNotification(null);
		}, 7000);
		return () => window.clearTimeout(timer);
	}, [incomingNotification]);

	const markAll = useCallback(() => {
		markAllMutation.mutate();
	}, [markAllMutation]);

	const openItem = useCallback(
		(item: NotificationItem) => {
			if (item.read_at === null) {
				markOneMutation.mutate(item.id);
			}
			onClose();
			navigate("/notifications");
		},
		[markOneMutation, navigate, onClose],
	);

	const dismissIncomingNotification = useCallback(() => {
		setIncomingNotification(null);
	}, []);

	const isRTL = i18n.dir(i18n.language) === "rtl";

	const contextValue = useMemo(
		() => ({
			unread,
			items,
			isOpen,
			onOpen,
			onClose,
			markAll,
			isMarkingAll: markAllMutation.isPending,
			openItem,
			incomingNotification,
			dismissIncomingNotification,
		}),
		[
			unread,
			items,
			isOpen,
			onOpen,
			onClose,
			markAll,
			markAllMutation.isPending,
			openItem,
			incomingNotification,
			dismissIncomingNotification,
		],
	);

	return (
		<NotificationContext.Provider value={contextValue}>
			{children}
			{typeof document !== "undefined"
				? createPortal(
						<AnimatePresence>
							{incomingNotification ? (
								<div className="pointer-events-auto fixed top-4 end-4 z-[10010] w-full max-w-[min(380px,calc(100vw-32px))]">
									<motion.div
										initial={{ opacity: 0, y: -14, scale: 0.96 }}
										animate={{ opacity: 1, y: 0, scale: 1 }}
										exit={{ opacity: 0, y: -10, scale: 0.96 }}
										transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
									>
										<div
											dir={isRTL ? "rtl" : "ltr"}
											className="relative overflow-hidden rounded-[16px] border border-panel-accent! bg-panel-surface p-3.5 text-panel-text shadow-[0_12px_32px_rgba(0,0,0,0.24)]"
										>
											<div className="flex items-start gap-3">
												<div className="flex size-[34px] shrink-0 items-center justify-center rounded-[10px] bg-panel-accent text-white">
													<Bell className="size-4" />
												</div>
												<div className="flex min-w-0 flex-1 flex-col gap-1">
													<div className="flex items-center justify-between gap-2">
														<p className="truncate text-[13px] font-bold text-panel-text">
															{incomingNotification.title}
														</p>
														<button
															type="button"
															aria-label={t("cancel")}
															onClick={dismissIncomingNotification}
															className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-panel-text-muted transition-colors active:scale-[0.94] min-[769px]:hover:bg-panel-elevated min-[769px]:hover:text-panel-text"
														>
															<X className="size-3.5" />
														</button>
													</div>
													<p className="line-clamp-2 text-xs leading-relaxed text-panel-text-secondary">
														{incomingNotification.body}
													</p>
													<button
														type="button"
														onClick={() => {
															openItem(incomingNotification);
															dismissIncomingNotification();
														}}
														className="mt-1 self-start text-xs font-semibold text-panel-accent transition-opacity active:opacity-80 min-[769px]:hover:underline"
													>
														{t("notifications.bell.label")}
													</button>
												</div>
											</div>
										</div>
									</motion.div>
								</div>
							) : null}
						</AnimatePresence>,
						document.body,
					)
				: null}
		</NotificationContext.Provider>
	);
};

export const useNotificationCenter = () => {
	const context = useContext(NotificationContext);
	if (!context) {
		throw new Error(
			"useNotificationCenter must be used within NotificationProvider",
		);
	}
	return context;
};

interface NotificationListPanelProps {
	items: NotificationItem[];
	unread: number;
	isMarkingAll: boolean;
	isRTL: boolean;
	onMarkAll: () => void;
	onSelectItem: (item: NotificationItem) => void;
	onViewAll: () => void;
}

const NotificationListPanel: FC<NotificationListPanelProps> = ({
	items,
	unread,
	isMarkingAll,
	isRTL,
	onMarkAll,
	onSelectItem,
	onViewAll,
}) => {
	const { t } = useTranslation();
	const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

	return (
		<div
			dir={isRTL ? "rtl" : "ltr"}
			className="flex flex-col select-none text-panel-text"
		>
			<div className="flex items-center justify-between gap-2 border-b border-panel-border! px-2.5 pb-2">
				<div className="flex items-center gap-2">
					<span className="text-[13px] font-bold text-panel-text">
						{t("notifications.bell.label")}
					</span>
					{unread > 0 ? (
						<span
							dir="ltr"
							style={{ unicodeBidi: "isolate" }}
							className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-panel-accent px-1.5 text-[10px] font-bold text-white tabular-nums"
						>
							{unread > 99 ? "99+" : unread}
						</span>
					) : null}
				</div>
				{unread > 0 ? (
					<button
						type="button"
						disabled={isMarkingAll}
						onClick={(e: ReactMouseEvent) => {
							e.stopPropagation();
							onMarkAll();
						}}
						className="inline-flex items-center gap-1 rounded-[8px] px-2 py-1 text-[11px] font-semibold text-panel-text-secondary transition-[background-color,color,transform] duration-150 active:scale-[0.96] disabled:opacity-50 min-[769px]:hover:bg-panel-elevated min-[769px]:hover:text-panel-text"
					>
						<CheckCheck className="size-3.5 text-panel-accent" />
						<span>{t("notifications.inbox.markAllRead")}</span>
					</button>
				) : null}
			</div>

			<div className="max-h-[280px] overflow-y-auto overscroll-contain p-1.5">
				{items.length === 0 ? (
					<div className="flex flex-col items-center justify-center px-3 py-8 text-center">
						<div className="mb-2 flex size-[38px] items-center justify-center rounded-[12px] border border-panel-border! bg-panel-elevated text-panel-text-muted">
							<MailOpen className="size-[18px]" />
						</div>
						<p className="text-[13px] font-semibold text-panel-text">
							{t("notifications.bell.empty")}
						</p>
					</div>
				) : (
					<div className="flex flex-col gap-1.5">
						{items.slice(0, 5).map((item) => {
							const isUnread = item.read_at === null;
							return (
								<button
									key={item.id}
									type="button"
									onClick={(e: ReactMouseEvent) => {
										e.stopPropagation();
										onSelectItem(item);
									}}
									className={cn(
										"flex w-full flex-col gap-1 rounded-[12px] border p-2.5 text-start transition-[background-color,border-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.99] min-[769px]:hover:border-panel-border-strong! min-[769px]:hover:bg-panel-elevated",
										isUnread
											? "border-panel-border! border-s-[3px] border-s-panel-accent! bg-panel-elevated"
											: "border-panel-border! bg-panel-surface opacity-85",
									)}
								>
									<div className="flex items-center justify-between gap-2">
										<div className="flex min-w-0 items-center gap-1.5">
											{isUnread ? (
												<span className="size-1.5 shrink-0 rounded-full bg-panel-accent" />
											) : null}
											<span
												className={cn(
													"truncate text-xs text-panel-text",
													isUnread ? "font-bold" : "font-semibold",
												)}
											>
												{item.title}
											</span>
										</div>
										<span
											dir="ltr"
											style={{ unicodeBidi: "isolate" }}
											className="shrink-0 text-[10px] font-medium text-panel-text-muted tabular-nums"
										>
											{dayjs.unix(item.created_at).format("HH:mm · MM/DD")}
										</span>
									</div>
									<p className="line-clamp-2 text-[11px] leading-snug text-panel-text-secondary">
										{item.body}
									</p>
								</button>
							);
						})}
					</div>
				)}
			</div>

			<div className="border-t border-panel-border! p-1.5 pt-2">
				<Button
					type="button"
					variant="outline"
					size="xs"
					onClick={(e: ReactMouseEvent) => {
						e.stopPropagation();
						onViewAll();
					}}
					className="h-8 w-full justify-center gap-1.5 rounded-[10px] border-panel-border! bg-panel-surface text-xs font-semibold text-panel-text transition-[background-color,border-color,transform] duration-150 active:scale-[0.98] min-[769px]:hover:border-panel-border-strong! min-[769px]:hover:bg-panel-elevated"
				>
					<span>{t("notifications.bell.viewAll")}</span>
					<ArrowIcon className="size-3.5" />
				</Button>
			</div>
		</div>
	);
};

export interface NotificationMenuItemProps {
	onNavigate?: () => void;
	isOpen?: boolean;
	isPressing?: boolean;
	onToggle?: () => void;
	onClose?: () => void;
}

export const NotificationMenuItem: FC<NotificationMenuItemProps> = ({
	onNavigate,
	isOpen: controlledIsOpen,
	isPressing = false,
	onToggle: controlledOnToggle,
	onClose: controlledOnClose,
}) => {
	const { t, i18n } = useTranslation();
	const navigate = useNavigate();
	const localDisclosure = useDisclosure();
	const isDesktop = useMediaQuery("(min-width: 769px)");
	const isControlled = controlledIsOpen !== undefined;
	const isOpen = isControlled ? controlledIsOpen : localDisclosure.isOpen;
	const { unread, items, openItem, markAll, isMarkingAll } =
		useNotificationCenter();
	const isRTL = i18n.dir(i18n.language) === "rtl";

	const handleOpenChange = (nextOpen: boolean) => {
		if (isControlled) {
			if (nextOpen) controlledOnToggle?.();
			else controlledOnClose?.();
			return;
		}
		if (nextOpen) localDisclosure.onOpen();
		else localDisclosure.onClose();
	};

	return (
		<Popover open={isOpen} onOpenChange={handleOpenChange}>
			<PopoverTrigger asChild>
				<button
					type="button"
					data-submenu-trigger="true"
					onClick={(e: ReactMouseEvent) => {
						e.stopPropagation();
						if (controlledOnToggle) controlledOnToggle();
						else handleOpenChange(!isOpen);
					}}
					className={cn(
						"flex h-[38px] w-full items-center justify-between gap-2.5 rounded-[12px] px-3 text-[13px] font-medium text-panel-text transition-[background-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] outline-none select-none active:scale-[0.97] active:bg-panel-elevated focus-visible:bg-panel-elevated min-[769px]:hover:bg-panel-elevated",
						isPressing || isOpen ? "bg-panel-elevated" : "bg-transparent",
						isPressing && "scale-[0.97]",
					)}
				>
					<span className="flex min-w-0 items-center gap-2.5">
						<Bell className="size-4 shrink-0 text-panel-text" />
						<span className="truncate">{t("notifications.menu")}</span>
					</span>
					{unread > 0 ? (
						<span
							dir="ltr"
							style={{ unicodeBidi: "isolate" }}
							className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-panel-accent px-1.5 text-[10px] font-bold text-white tabular-nums"
						>
							{unread > 99 ? "99+" : unread}
						</span>
					) : null}
				</button>
			</PopoverTrigger>
			<PopoverContent
				dir={isRTL ? "rtl" : "ltr"}
				data-profile-window="true"
				data-profile-submenu="true"
				data-notification-menu-list="true"
				side={isDesktop ? (isRTL ? "left" : "right") : "bottom"}
				align={isDesktop ? "start" : "center"}
				sideOffset={8}
				collisionPadding={12}
				className="z-[10005] w-[min(360px,calc(100vw-24px))] max-w-[380px] max-h-[min(calc(var(--radix-popover-content-available-height,72dvh)-8px),calc(100dvh-24px))] overflow-y-auto overscroll-contain rounded-[20px] border border-panel-border! bg-panel-surface p-2 text-panel-text shadow-[0_20px_48px_rgba(0,0,0,0.35)]"
			>
				<NotificationListPanel
					items={items}
					unread={unread}
					isMarkingAll={isMarkingAll}
					isRTL={isRTL}
					onMarkAll={markAll}
					onSelectItem={(item) => {
						handleOpenChange(false);
						onNavigate?.();
						openItem(item);
					}}
					onViewAll={() => {
						handleOpenChange(false);
						onNavigate?.();
						navigate("/notifications");
					}}
				/>
			</PopoverContent>
		</Popover>
	);
};

export const NotificationBell: FC = () => {
	const { t, i18n } = useTranslation();
	const navigate = useNavigate();
	const context = useContext(NotificationContext);
	const queryClient = useQueryClient();
	const localInbox = useQuery({
		queryKey: ["notifications", "bell"],
		queryFn: () => getNotifications({ limit: 6 }),
		refetchInterval: 30000,
		enabled: !context,
	});
	const localMarkAll = useMutation({
		mutationFn: () => markNotificationsRead({ all: true }),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: ["notifications"] }),
	});
	const localMarkOne = useMutation({
		mutationFn: (id: number) => markNotificationsRead({ ids: [id] }),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: ["notifications"] }),
	});

	const unread = context ? context.unread : (localInbox.data?.unread ?? 0);
	const items = context ? context.items : (localInbox.data?.items ?? []);
	const isMarkingAll = context ? context.isMarkingAll : localMarkAll.isPending;
	const isRTL = i18n.dir(i18n.language) === "rtl";

	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="outline"
					size="sm"
					data-header-notifications="true"
					aria-label={t("notifications.bell.label")}
					className="relative size-[34px] min-w-[34px] rounded-[12px] border-panel-border! bg-panel-surface p-0 text-panel-text-secondary transition-[background-color,border-color,color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-panel-surface dark:hover:bg-input/30 active:scale-[0.96] min-[769px]:hover:border-panel-border-strong! min-[769px]:hover:bg-panel-elevated min-[769px]:dark:hover:bg-panel-elevated min-[769px]:hover:text-panel-text"
				>
					<Bell className="size-4" />
					{unread > 0 ? (
						<span className="absolute -top-0.5 -end-0.5 size-2.5 rounded-full border-2 border-panel-surface bg-panel-accent" />
					) : null}
				</Button>
			</PopoverTrigger>
			<PopoverContent
				dir={isRTL ? "rtl" : "ltr"}
				align={isRTL ? "start" : "end"}
				sideOffset={8}
				collisionPadding={12}
				className="z-[9999] w-[min(360px,calc(100vw-24px))] max-w-[380px] max-h-[min(calc(var(--radix-popover-content-available-height,76dvh)-8px),calc(100dvh-24px))] overflow-y-auto overscroll-contain rounded-[20px] border border-panel-border! bg-panel-surface p-2 text-panel-text shadow-[0_20px_48px_rgba(0,0,0,0.32)]"
			>
				<NotificationListPanel
					items={items}
					unread={unread}
					isMarkingAll={isMarkingAll}
					isRTL={isRTL}
					onMarkAll={() => {
						if (context) context.markAll();
						else localMarkAll.mutate();
					}}
					onSelectItem={(item) => {
						if (context) {
							context.openItem(item);
							return;
						}
						if (item.read_at === null) {
							localMarkOne.mutate(item.id);
						}
						navigate("/notifications");
					}}
					onViewAll={() => navigate("/notifications")}
				/>
			</PopoverContent>
		</Popover>
	);
};

