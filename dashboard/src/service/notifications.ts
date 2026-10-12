import type {
	NotificationInbox,
	NotificationRecipient,
	NotificationRule,
	NotificationRuleUpdate,
	SentNotification,
} from "types/Notification";
import { fetch as apiFetch } from "./http";

export type SendNotificationPayload = {
	title: string;
	body: string;
	audience: "all" | "selected";
	admin_ids: number[];
};

export const getNotifications = async (query?: {
	limit?: number;
	offset?: number;
	unread_only?: boolean;
}): Promise<NotificationInbox> => {
	return apiFetch("/notifications", { query });
};

export const markNotificationsRead = async (payload: {
	ids?: number[];
	all?: boolean;
}): Promise<{ updated: number }> => {
	return apiFetch("/notifications/read", {
		method: "POST",
		body: JSON.stringify(payload),
	});
};

export const sendNotification = async (
	payload: SendNotificationPayload,
): Promise<{ id: number; recipients: number }> => {
	return apiFetch("/notifications", {
		method: "POST",
		body: JSON.stringify(payload),
	});
};

export const getSentNotifications = async (): Promise<{
	items: SentNotification[];
}> => {
	return apiFetch("/notifications/sent");
};

export const getNotificationRecipients = async (): Promise<{
	items: NotificationRecipient[];
}> => {
	return apiFetch("/notifications/recipients");
};

export const getNotificationRules = async (): Promise<{
	items: NotificationRule[];
}> => {
	return apiFetch("/notifications/rules");
};

export const updateNotificationRule = async (
	key: string,
	payload: NotificationRuleUpdate,
): Promise<NotificationRule> => {
	return apiFetch(`/notifications/rules/${encodeURIComponent(key)}`, {
		method: "PUT",
		body: JSON.stringify(payload),
	});
};
