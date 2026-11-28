import { useDashboard } from "contexts/DashboardContext";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { fetch as apiFetch } from "service/http";
import type { User, UserListItem } from "types/User";
import { copyTextToClipboard } from "utils/clipboard";
import { getConfigLabelFromLink } from "utils/configLabel";
import { generateUserLinks } from "utils/userLinks";
import {
	COPY_FEEDBACK_MS,
	formatUserDialogLink,
} from "./userDialog.helpers";
import type {
	ConfigLinkItem,
	SubscriptionLinkItem,
} from "./userDialog.types";

export const useUserDialogLinks = (editingUser: User | null) => {
	const { t } = useTranslation();
	const linkTemplates = useDashboard((state) => state.linkTemplates);
	const setQRCode = useDashboard((state) => state.setQRCode);
	const setSubLink = useDashboard((state) => state.setSubLink);
	const [copiedKey, setCopiedKey] = useState<string | null>(null);

	useEffect(() => {
		if (!copiedKey) return undefined;
		const timer = window.setTimeout(
			() => setCopiedKey(null),
			COPY_FEEDBACK_MS,
		);
		return () => window.clearTimeout(timer);
	}, [copiedKey]);

	const copyValue = (key: string, value: string) => {
		void copyTextToClipboard(value)
			.then(() => setCopiedKey(key))
			.catch(() => undefined);
	};

	const subscriptionLinks = useMemo<SubscriptionLinkItem[]>(() => {
		if (!editingUser) return [];
		const urls = editingUser.subscription_urls ?? {};
		const order = ["username-key", "key", "key-username", "token"] as const;
		const labels: Record<(typeof order)[number], string> = {
			"username-key": t("userDialog.links.subscriptionUsernameKey"),
			key: t("userDialog.links.subscriptionKey"),
			"key-username": t("userDialog.links.subscriptionKeyUsername"),
			token: t("userDialog.links.subscriptionToken"),
		};
		const orderIndex = new Map(order.map((key, index) => [key, index]));
		const results = Object.entries(urls)
			.map(([key, value]) => {
				const url = formatUserDialogLink(value);
				if (!url) return null;
				const [baseKeyRaw, variant] = key.split("@", 2);
				const baseKey = baseKeyRaw as (typeof order)[number];
				const baseLabel = labels[baseKey] ?? baseKeyRaw;
				return {
					key,
					label: variant ? `${baseLabel} (${variant})` : baseLabel,
					url,
					order: orderIndex.get(baseKey) ?? order.length,
					variant: variant ?? "",
				};
			})
			.filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
			.sort((a, b) => {
				if (a.order !== b.order) return a.order - b.order;
				const aHasVariant = a.variant !== "";
				const bHasVariant = b.variant !== "";
				if (aHasVariant !== bHasVariant) return aHasVariant ? 1 : -1;
				return a.variant.localeCompare(b.variant, undefined, { numeric: true });
			})
			.map(({ key, label, url }) => ({ key, label, url }));

		if (results.length === 0 && editingUser.subscription_url) {
			const fallback = formatUserDialogLink(editingUser.subscription_url);
			if (fallback) {
				results.push({
					key: "primary",
					label: t("userDialog.links.subscription"),
					url: fallback,
				});
			}
		}
		return results;
	}, [editingUser, t]);

	const userLinks = useMemo(
		() =>
			editingUser
				? generateUserLinks(editingUser, linkTemplates, {
						includeInactive: true,
					})
				: [],
		[editingUser, linkTemplates],
	);

	const configLinksText = useMemo(() => userLinks.join("\n"), [userLinks]);

	const configItems = useMemo<ConfigLinkItem[]>(
		() =>
			userLinks.map((link, index) => ({
				link,
				label:
					getConfigLabelFromLink(link) ||
					t("userDialog.links.configFallback", { index: index + 1 }),
			})),
		[userLinks, t],
	);

	const fetchUserForQr = useCallback(async (username: string) => {
		try {
			return await apiFetch<User>(`/user/${encodeURIComponent(username)}`);
		} catch {
			return null;
		}
	}, []);

	const openUserQrDialog = useCallback(
		(user: User | UserListItem | null | undefined) => {
			if (!user) return;
			const currentLinkTemplates =
				useDashboard.getState().linkTemplates ?? linkTemplates;
			const configLinks = generateUserLinks(user, currentLinkTemplates, {
				includeInactive: true,
			});
			const subscriptionLink =
				formatUserDialogLink((user as User).subscription_url) ||
				formatUserDialogLink((user as User).key_subscription_url) ||
				formatUserDialogLink(
					Object.values((user as User).subscription_urls ?? {})[0],
				);
			if (!configLinks.length && !subscriptionLink) return;
			setQRCode(configLinks, user.username);
			setSubLink(subscriptionLink || null);
		},
		[linkTemplates, setQRCode, setSubLink],
	);

	return {
		copiedKey,
		copyValue,
		subscriptionLinks,
		configItems,
		configLinksText,
		fetchUserForQr,
		openUserQrDialog,
		setQRCode,
		setSubLink,
	};
};
