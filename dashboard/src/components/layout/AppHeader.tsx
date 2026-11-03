import { GitHubStars } from "components/GitHubStars";
import { HeaderCalendar } from "components/HeaderCalendar";
import { Language } from "components/Language";
import { NotificationBell } from "components/NotificationBell";
import { ThemeSelector } from "components/ThemeSelector";
import { Separator } from "components/ui/separator";
import { SidebarTrigger } from "components/ui/sidebar";
import useGetUser from "hooks/useGetUser";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";

const ROUTE_TITLE_KEYS: Record<string, string> = {
	"/": "dashboard",
	"/users": "users",
	"/bulk-actions": "bulkActions.menu",
	"/admins": "admins.title",
	"/myaccount": "myaccount.menu",
	"/usage": "usage.title",
	"/services": "services.title",
	"/hosts": "header.hostSettings",
	"/node-settings": "header.nodeSettings",
	"/settings": "header.integrationSettings",
	"/xray-settings": "header.xraySettings",
	"/haproxy": "haproxy.title",
	"/xray-logs": "pages.xray.logs",
	"/access-insights": "header.accessInsights",
	"/recent-actions": "recentActions.title",
	"/errors": "diagnostics.menu",
	"/phpmyadmin": "phpmyadmin.menu",
	"/external-apps": "externalApps.menu",
	"/api-docs": "apiDocs.menu",
	"/placeholders": "placeholders.menu",
	"/tutorials": "tutorials.menu",
	"/notifications": "notifications.title",
};

export function AppHeader() {
	const { t } = useTranslation();
	const location = useLocation();
	const { userData, getUserIsSuccess } = useGetUser();

	const pageTitle = useMemo(() => {
		const exact = ROUTE_TITLE_KEYS[location.pathname];
		if (exact) return t(exact);

		const base = `/${location.pathname.split("/")[1] || ""}`;
		const parent = ROUTE_TITLE_KEYS[base];
		if (parent) return t(parent);

		return "Rebecca";
	}, [location.pathname, t]);

	return (
		<header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-panel-border/70 bg-panel-surface/80 px-3 backdrop-blur-md transition-colors md:px-5">
			<div className="flex min-w-0 items-center gap-2">
				<SidebarTrigger className="size-8 text-panel-text-muted hover:bg-panel-elevated hover:text-panel-text rounded-lg" />
				<Separator
					orientation="vertical"
					className="hidden h-5 bg-panel-border sm:block"
				/>
				<div className="flex min-w-0 items-center gap-1.5 text-xs">
					<span className="hidden font-medium text-panel-text-muted sm:inline">
						Rebecca
					</span>
					<span className="hidden text-panel-text-muted/40 sm:inline">/</span>
					<span className="truncate font-semibold text-panel-text">
						{pageTitle}
					</span>
				</div>
			</div>

			<div className="flex items-center gap-1.5">
				<div className="hidden sm:flex items-center">
					<HeaderCalendar isCompact={true} />
				</div>
				{getUserIsSuccess && userData.username ? (
					<NotificationBell />
				) : null}
				<div className="hidden md:flex items-center">
					<GitHubStars />
				</div>
				<Language triggerVariant="ghost" />
				<ThemeSelector minimal trigger="icon" />
			</div>
		</header>
	);
}
