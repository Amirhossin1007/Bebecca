import {
	Activity,
	AlertTriangle,
	AppWindow,
	Bell,
	BookOpen,
	Code2,
	Cpu,
	Database,
	FolderTree,
	GitFork,
	History,
	Layers,
	LayoutDashboard,
	Network,
	Radar,
	Server,
	Settings2,
	ShieldCheck,
	Sliders,
	Terminal,
	User,
	Users,
} from "lucide-react";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarRail,
} from "components/ui/sidebar";
import { AppTitle } from "./layout/AppTitle";
import { NavGroup, type NavItemData } from "./layout/NavGroup";
import { SponsorCarousel, type SponsorCarouselItem } from "./SponsorCarousel";
import useGetUser from "hooks/useGetUser";
import { useQuery } from "@tanstack/react-query";
import {
	type FC,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from "react";
import { useTranslation } from "react-i18next";
import { useHref } from "react-router-dom";
import { getSponsors, type SponsorAsset } from "service/sponsors";
import { AdminRole, AdminSection, AdminSudoScope } from "types/Admin";
import {
	getTutorialManifestUrl,
	getTutorialSeenKey,
	normalizeTutorialLang,
} from "utils/tutorials";

export interface AppSidebarProps {
	collapsed?: boolean;
	sponsors?: SponsorAsset[];
	sidebarBanners?: SponsorAsset[];
	inDrawer?: boolean;
	onRequestExpand?: () => void;
}

export const AppSidebar: FC<AppSidebarProps> = ({
	sponsors = [],
	sidebarBanners = [],
}) => {
	const { t, i18n } = useTranslation();
	const dashboardRoot = useHref("/");
	const { userData } = useGetUser();
	const [hasNewTutorials, setHasNewTutorials] = useState(false);
	const isRTL = i18n.dir(i18n.language) === "rtl";

	const sectionAccess = userData.permissions?.sections;
	const isFullAccess = userData.role === AdminRole.FullAccess;
	const isPrivilegedAdmin = isFullAccess || userData.role === AdminRole.Sudo;
	const canSeeSponsors = isPrivilegedAdmin;

	const sponsorsQuery = useQuery({
		queryKey: ["sponsors"],
		queryFn: getSponsors,
		staleTime: 5 * 60 * 1000,
		gcTime: 30 * 60 * 1000,
		retry: false,
		enabled: canSeeSponsors && sponsors.length === 0 && sidebarBanners.length === 0,
	});
	const sponsorData = canSeeSponsors ? sponsorsQuery.data : undefined;
	const resolvedSponsors = sponsors.length > 0 ? sponsors : (sponsorData?.sidebar_logo ?? []);
	const resolvedBanners = sidebarBanners.length > 0 ? sidebarBanners : (sponsorData?.sidebar ?? []);
	const defaultSelfPermissions = {
		self_myaccount: false,
		self_change_password: false,
		self_api_keys: false,
		self_placeholders: false,
	};
	const baseSelf =
		userData.permissions?.self_permissions ?? defaultSelfPermissions;
	const selfAccess = isFullAccess
		? { self_myaccount: true, self_change_password: true, self_api_keys: true }
		: baseSelf;
	const canViewUsage = Boolean(sectionAccess?.[AdminSection.Usage]);
	const canViewAdmins = Boolean(sectionAccess?.[AdminSection.Admins]);
	const canViewServicesSection = Boolean(
		sectionAccess?.[AdminSection.Services],
	);
	const canViewRecentActions =
		isFullAccess ||
		(userData.role === AdminRole.Sudo &&
			Boolean(userData.permissions?.sudo?.[AdminSudoScope.Xray]));
	const canManagePlaceholders =
		isFullAccess ||
		(userData.role === AdminRole.Sudo &&
			Boolean(userData.permissions?.sudo?.[AdminSudoScope.Subscriptions])) ||
		Boolean(baseSelf.self_placeholders);

	const checkTutorialUpdates = useCallback(async () => {
		const langKey = normalizeTutorialLang(i18n.language);
		try {
			const response = await fetch(getTutorialManifestUrl(dashboardRoot), {
				headers: { "Cache-Control": "no-cache" },
			});
			if (!response.ok) return;
			const manifest = (await response.json()) as Record<string, string>;
			const version = manifest[langKey]?.toString().trim();
			if (!version) {
				setHasNewTutorials(false);
				return;
			}
			const seenKey = getTutorialSeenKey(langKey);
			const seenVersion = window.localStorage.getItem(seenKey);
			if (seenVersion === null) {
				window.localStorage.setItem(seenKey, version);
				setHasNewTutorials(false);
				return;
			}
			setHasNewTutorials(seenVersion !== version);
		} catch {
			setHasNewTutorials(false);
		}
	}, [dashboardRoot, i18n.language]);

	useEffect(() => {
		void checkTutorialUpdates();
	}, [checkTutorialUpdates]);

	const overviewItems: NavItemData[] = useMemo(() => {
		const items: NavItemData[] = [
			{ title: t("dashboard"), url: "/", icon: LayoutDashboard },
			{ title: t("users"), url: "/users", icon: Users },
			{ title: t("groups.title"), url: "/groups", icon: FolderTree },
			{
				title: t("bulkActions.menu"),
				url: "/bulk-actions",
				icon: Layers,
			},
		];

		if (selfAccess.self_myaccount) {
			items.push({
				title: t("myaccount.menu"),
				url: "/myaccount",
				icon: User,
			});
		}

		if (canViewAdmins) {
			items.push({
				title: t("admins.title"),
				url: "/admins",
				icon: ShieldCheck,
			});
		}

		if (canViewUsage) {
			items.push({
				title: t("usage.title"),
				url: "/usage",
				icon: Activity,
			});
		}

		items.push({
			title: t("notifications.title"),
			url: "/notifications",
			icon: Bell,
		});

		return items;
	}, [t, selfAccess.self_myaccount, canViewAdmins, canViewUsage]);

	const infrastructureItems: NavItemData[] = useMemo(() => {
		const items: NavItemData[] = [];

		if (canViewServicesSection) {
			items.push({
				title: t("services.title"),
				url: "/services",
				icon: Cpu,
			});
		}

		if (sectionAccess?.[AdminSection.Hosts]) {
			items.push({
				title: t("header.hostSettings"),
				url: "/hosts#inbounds",
				icon: Server,
			});
		}

		if (sectionAccess?.[AdminSection.Nodes]) {
			items.push({
				title: t("header.nodeSettings"),
				url: "/node-settings",
				icon: Network,
			});
		}

		if (isPrivilegedAdmin) {
			items.push({
				title: t("haproxy.title"),
				url: "/haproxy",
				icon: GitFork,
			});
		}

		return items;
	}, [
		t,
		canViewServicesSection,
		sectionAccess,
		isPrivilegedAdmin,
	]);

	const settingsItems: NavItemData[] = useMemo(() => {
		const items: NavItemData[] = [];

		if (sectionAccess?.[AdminSection.Integrations]) {
			items.push({
				title: t("header.integrationSettings"),
				url: "/settings#panel",
				icon: Settings2,
			});
		}

		if (sectionAccess?.[AdminSection.Xray]) {
			items.push({
				title: t("header.xraySettings"),
				url: "/xray-settings#basic",
				icon: Sliders,
			});
		}

		if (canManagePlaceholders) {
			items.push({
				title: isPrivilegedAdmin
					? t("placeholders.menu")
					: t("placeholders.settingsMenu"),
				url: "/placeholders",
				icon: Code2,
			});
		}

		return items;
	}, [
		t,
		sectionAccess,
		canManagePlaceholders,
		isPrivilegedAdmin,
	]);

	const operationsItems: NavItemData[] = useMemo(() => {
		const items: NavItemData[] = [];

		if (sectionAccess?.[AdminSection.Xray]) {
			items.push({
				title: t("pages.xray.logs"),
				url: "/xray-logs",
				icon: Terminal,
			});
			items.push({
				title: t("header.accessInsights"),
				url: "/access-insights",
				icon: Radar,
			});
		}

		if (canViewRecentActions) {
			items.push({
				title: t("recentActions.title"),
				url: "/recent-actions",
				icon: History,
			});
		}

		if (isPrivilegedAdmin) {
			items.push({
				title: t("diagnostics.menu"),
				url: "/errors",
				icon: AlertTriangle,
			});
		}

		return items;
	}, [
		t,
		sectionAccess,
		canViewRecentActions,
		isPrivilegedAdmin,
	]);

	const toolsItems: NavItemData[] = useMemo(() => {
		const items: NavItemData[] = [];

		if (isPrivilegedAdmin) {
			items.push({
				title: t("externalApps.menu"),
				url: "/external-apps",
				icon: AppWindow,
			});
			items.push({
				title: t("phpmyadmin.menu"),
				url: "/phpmyadmin",
				icon: Database,
			});
			items.push({
				title: t("apiDocs.menu"),
				url: "/api-docs",
				icon: BookOpen,
			});
		}

		items.push({
			title: t("tutorials.menu"),
			url: "/tutorials",
			icon: BookOpen,
			badge: hasNewTutorials ? (
				<span className="size-2 rounded-full bg-panel-accent animate-pulse" />
			) : undefined,
		});

		return items;
	}, [t, isPrivilegedAdmin, hasNewTutorials]);

	const sidebarSponsors: SponsorCarouselItem[] = useMemo(() => {
		return [...resolvedSponsors, ...resolvedBanners].slice(0, 3).map((asset) => ({
			id: asset.id,
			src: asset.image_url,
			alt: asset.alt || asset.label || "Sponsor",
			href: asset.target_url,
			label: asset.label,
			isSponsor: true,
		}));
	}, [resolvedSponsors, resolvedBanners]);

	return (
		<Sidebar
			side={isRTL ? "right" : "left"}
			variant="sidebar"
			collapsible="icon"
			className="border-panel-border bg-panel-surface"
		>
			<SidebarHeader className="p-2 border-b border-panel-border/60">
				<AppTitle />
			</SidebarHeader>

			<SidebarContent className="px-1 py-2">
				<NavGroup
					title={t("next.nav.group.overview") || t("dashboard")}
					items={overviewItems}
				/>
				<NavGroup
					title={t("services.title") || "Infrastructure"}
					items={infrastructureItems}
				/>
				<NavGroup
					title={t("header.integrationSettings") || "Settings"}
					items={settingsItems}
				/>
				<NavGroup
					title={t("diagnostics.menu") || "Operations"}
					items={operationsItems}
				/>
				<NavGroup
					title={t("externalApps.menu") || "Ecosystem"}
					items={toolsItems}
				/>
			</SidebarContent>

			{sidebarSponsors.length > 0 ? (
				<SidebarFooter className="p-2 border-t border-panel-border/60 flex flex-col gap-2">
					<div className="group-data-[collapsible=icon]:hidden w-full overflow-hidden rounded-xl">
						<SponsorCarousel items={sidebarSponsors} variant="sidebar" />
					</div>
				</SidebarFooter>
			) : null}

			<SidebarRail />
		</Sidebar>
	);
};

export default AppSidebar;
