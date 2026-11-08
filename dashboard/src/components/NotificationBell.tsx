import {
	Badge,
	Box,
	Button,
	HStack,
	IconButton,
	Popover,
	PopoverBody,
	PopoverContent,
	PopoverTrigger,
	Stack,
	Text,
} from "@chakra-ui/react";
import { BellIcon } from "@heroicons/react/24/outline";
import dayjs from "dayjs";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import type { NotificationItem } from "types/Notification";
import { getNotifications, markNotificationsRead } from "service/notifications";

export const NotificationBell = () => {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const inbox = useQuery(
		["notifications", "bell"],
		() => getNotifications({ limit: 6 }),
		{ refetchInterval: 30000 },
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
				<Box position="relative" display="inline-flex">
					<IconButton
						aria-label={t("notifications.bell.label")}
						icon={<BellIcon width={18} height={18} />}
						size="sm"
						variant="ghost"
						borderRadius="full"
					/>
					{unread > 0 && (
						<Badge
							position="absolute"
							top="-1"
							right="-1"
							colorScheme="red"
							borderRadius="full"
							fontSize="2xs"
							px={1.5}
						>
							{unread > 99 ? "99+" : unread}
						</Badge>
					)}
				</Box>
			</PopoverTrigger>
			<PopoverContent w="340px" maxH="420px" overflowY="auto">
				<PopoverBody>
					<HStack justify="space-between" mb={2}>
						<Text fontWeight="semibold">{t("notifications.bell.label")}</Text>
						{unread > 0 && (
							<Button
								size="xs"
								variant="ghost"
								onClick={() => markAll.mutate()}
								isLoading={markAll.isLoading}
							>
								{t("notifications.inbox.markAllRead")}
							</Button>
						)}
					</HStack>
					{items.length === 0 ? (
						<Text fontSize="sm" color="gray.500">
							{t("notifications.bell.empty")}
						</Text>
					) : (
						<Stack spacing={2}>
							{items.map((item) => (
								<Box
									key={item.id}
									as="button"
									textAlign="start"
									p={2}
									borderRadius="md"
									borderWidth="1px"
									opacity={item.read_at === null ? 1 : 0.7}
									onClick={() => openItem(item)}
								>
									<Text fontSize="sm" fontWeight="semibold" noOfLines={1}>
										{item.title}
									</Text>
									<Text fontSize="xs" noOfLines={2}>
										{item.body}
									</Text>
									<Text fontSize="2xs" color="gray.500">
										{dayjs.unix(item.created_at).format("YYYY-MM-DD HH:mm")}
									</Text>
								</Box>
							))}
						</Stack>
					)}
					<Button
						mt={3}
						size="sm"
						w="full"
						variant="outline"
						onClick={() => navigate("/notifications")}
					>
						{t("notifications.bell.viewAll")}
					</Button>
				</PopoverBody>
			</PopoverContent>
		</Popover>
	);
};
