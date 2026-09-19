import {
	Box,
	chakra,
	Flex,
	HStack,
	Icon,
	Popover,
	PopoverBody,
	PopoverContent,
	PopoverHeader,
	PopoverTrigger,
	Text,
	Tooltip,
	useColorModeValue,
	VStack,
} from "@chakra-ui/react";
import {
	ArrowsRightLeftIcon,
	BoltIcon,
	BookOpenIcon,
	BriefcaseIcon,
	ChartBarIcon,
	ChevronDownIcon,
	CircleStackIcon,
	ClockIcon,
	CodeBracketSquareIcon,
	Cog6ToothIcon,
	Cog8ToothIcon,
	CommandLineIcon,
	DocumentDuplicateIcon,
	DocumentTextIcon,
	EyeIcon,
	HomeIcon,
	LinkIcon,
	ServerStackIcon,
	ShieldCheckIcon,
	Squares2X2Icon,
	UserCircleIcon,
	UserGroupIcon,
	WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import logoUrl from "assets/logo.svg";
import { AnimatePresence, motion } from "framer-motion";
import useGetUser from "hooks/useGetUser";
import {
	type ElementType,
	type FC,
	type MouseEvent as ReactMouseEvent,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from "react";
import { useTranslation } from "react-i18next";
import { NavLink, useHref, useLocation, useNavigate } from "react-router-dom";
import { SponsorCarousel, type SponsorCarouselItem } from "./SponsorCarousel";
import type { SponsorAsset } from "service/sponsors";
import { AdminRole, AdminSection, AdminSudoScope } from "types/Admin";
import {
	getTutorialManifestUrl,
	getTutorialSeenKey,
	normalizeTutorialLang,
} from "utils/tutorials";

const iconProps = {
	baseStyle: {
		w: "18px",
		h: "18px",
	},
};

const HomeIconStyled = chakra(HomeIcon, iconProps);
const UsersIconStyled = chakra(UserGroupIcon, iconProps);
const BulkActionsIconStyled = chakra(BoltIcon, iconProps);
const RecentActionsIconStyled = chakra(ClockIcon, iconProps);
const SettingsIconStyled = chakra(Cog6ToothIcon, iconProps);
const MasterSettingsIconStyled = chakra(Cog8ToothIcon, iconProps);
const NodeIconStyled = chakra(ServerStackIcon, iconProps);
const AdminIconStyled = chakra(BriefcaseIcon, iconProps);
const ServicesIconStyled = chakra(Squares2X2Icon, iconProps);
const HostsIconStyled = chakra(LinkIcon, iconProps);
const HAProxyIconStyled = chakra(ArrowsRightLeftIcon, iconProps);
const UsageIconStyled = chakra(ChartBarIcon, iconProps);
const MyAccountIconStyled = chakra(UserCircleIcon, iconProps);
const InsightsIconStyled = chakra(EyeIcon, iconProps);
const TutorialIconStyled = chakra(BookOpenIcon, iconProps);
const XraySettingsIconStyled = chakra(WrenchScrewdriverIcon, iconProps);
const XrayLogsIconStyled = chakra(DocumentTextIcon, iconProps);
const ApiDocsIconStyled = chakra(CodeBracketSquareIcon, iconProps);
const PHPMyAdminIconStyled = chakra(CircleStackIcon, iconProps);
const ExternalAppsIconStyled = chakra(CommandLineIcon, iconProps);
const PlaceholderIconStyled = chakra(DocumentDuplicateIcon, iconProps);
const ObservabilityIconStyled = chakra(ShieldCheckIcon, iconProps);
const InfrastructureIconStyled = chakra(WrenchScrewdriverIcon, iconProps);

const LogoIcon = chakra("img", {
	baseStyle: {
		w: "26px",
		h: "26px",
	},
});

interface AppSidebarProps {
	collapsed: boolean;
	sponsors?: SponsorAsset[];
	sidebarBanners?: SponsorAsset[];
	/** when rendered inside a Drawer on mobile */
	inDrawer?: boolean;
	onRequestExpand?: () => void;
}

type DirectNavItem = {
	type: "direct";
	id: string;
	title: string;
	url: string;
	icon: ElementType;
	badge?: boolean;
	visible: boolean;
};

type GroupSubItem = {
	id: string;
	title: string;
	url: string;
	icon: ElementType;
	badge?: boolean;
	visible: boolean;
};
type SidebarSubItems = NonNullable<SidebarItem["subItems"]>;

export const AppSidebar: FC<AppSidebarProps> = ({
	collapsed,
	sponsors = [],
	sidebarBanners = [],
	inDrawer = false,
	onRequestExpand,
}) => {
	const { t, i18n } = useTranslation();
	const location = useLocation();
	const navigate = useNavigate();
	const dashboardRoot = useHref("/");
	const { userData } = useGetUser();
	const isRTL = i18n.dir(i18n.language) === "rtl";
	const tutorialsUrl = "/tutorials";

	const isFullAccess = userData.role === AdminRole.FullAccess;
	const isPrivilegedAdmin = isFullAccess || userData.role === AdminRole.Sudo;
	const sidebarBg = useColorModeValue("panel.sidebar", "panel.sidebar");
	const sidebarBorderColor = useColorModeValue("panel.border", "panel.border");
	const sidebarPanelBg = useColorModeValue("panel.elevated", "panel.elevated");
	const sidebarPanelBorder = useColorModeValue("panel.border", "panel.border");
	const sidebarShadow = useColorModeValue(
		"0 18px 48px rgba(15, 23, 42, 0.10)",
		"0 18px 48px rgba(0, 0, 0, 0.32)",
	);
	const itemColor = useColorModeValue(
		"panel.textSecondary",
		"panel.textSecondary",
	);
	const activeItemBg = useColorModeValue("panel.elevated", "panel.elevated");
	const activeItemColor = useColorModeValue("panel.text", "panel.text");
	const hoverItemBg = useColorModeValue("panel.elevated", "panel.elevated");
	const subNavBorder = useColorModeValue("panel.border", "panel.border");
	const defaultSelfPermissions = {
		self_myaccount: false,
		self_change_password: false,
		self_api_keys: false,
		self_placeholders: false,
	};
	const baseSelf = userData.permissions?.self_permissions ?? defaultSelfPermissions;
	const selfAccess = isFullAccess
		? { self_myaccount: true, self_change_password: true, self_api_keys: true }
		: baseSelf;

	const canViewUsage = Boolean(sectionAccess?.[AdminSection.Usage]);
	const canViewAdmins = Boolean(sectionAccess?.[AdminSection.Admins]);
	const canViewServicesSection = Boolean(sectionAccess?.[AdminSection.Services]);
	const canViewHosts = isPrivilegedAdmin && Boolean(sectionAccess?.[AdminSection.Hosts]);
	const canViewRecentActions =
		isFullAccess ||
		(userData.role === AdminRole.Sudo &&
			Boolean(userData.permissions?.sudo?.[AdminSudoScope.Xray]));
	const canManagePlaceholders =
		isFullAccess ||
		(userData.role === AdminRole.Sudo &&
			Boolean(userData.permissions?.sudo?.[AdminSudoScope.Subscriptions])) ||
		Boolean(baseSelf.self_placeholders);

	const [hasNewTutorials, setHasNewTutorials] = useState(false);
	const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
		users_hub: true,
	});

	const sidebarBg = useColorModeValue("panel.surface", "panel.surface");
	const sidebarBorderColor = useColorModeValue("panel.border", "panel.border");
	const activeItemBg = useColorModeValue("panel.elevated", "panel.elevated");
	const activeItemColor = "var(--rb-panel-accent)";
	const normalItemColor = useColorModeValue("panel.textSecondary", "panel.textSecondary");
	const hoverItemBg = useColorModeValue("panel.elevated", "panel.elevated");

	const checkTutorialUpdates = useCallback(async () => {
		const langKey = normalizeTutorialLang(i18n.language);
		try {
			const response = await fetch(getTutorialManifestUrl(dashboardRoot), {
				headers: { "Cache-Control": "no-cache" },
			});
			if (!response.ok) {
				throw new Error(`Failed to load tutorial meta: ${response.status}`);
			}
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

	const defaultTabByPath: Record<string, string> = {
		"/settings": "panel",
		"/hosts": "inbounds",
		"/usage": "services",
		"/xray-settings": "basic",
	};

	const handleNavigate = (url: string, event?: ReactMouseEvent) => {
		if (inDrawer && onRequestExpand) {
			onRequestExpand();
		}
		const defaultTab = defaultTabByPath[url];
		if (defaultTab) {
			event?.preventDefault();
			const normalized = url.startsWith("/") ? url : `/${url}`;
			navigate(`${normalized}#${defaultTab}`);
		}
	};

	const navEntries: NavEntry[] = useMemo(
		() => [
			{
				type: "direct",
				id: "dashboard",
				title: t("dashboard"),
				url: "/",
				icon: HomeIconStyled,
				visible: true,
			},
			{
				type: "group",
				id: "users_hub",
				title: t("sidebar.groups.userHub"),
				icon: UsersIconStyled,
				visible: true,
				subItems: [
					{
						id: "users_list",
						title: t("sidebar.usersList"),
						url: "/users",
						icon: UsersIconStyled,
						visible: true,
					},
					{
						id: "bulk_actions",
						title: t("bulkActions.menu"),
						url: "/bulk-actions",
						icon: BulkActionsIconStyled,
						visible: true,
					},
				],
			},
			{
				type: "direct",
				id: "admins",
				title: t("admins"),
				url: "/admins",
				icon: AdminIconStyled,
				visible: canViewAdmins,
			},
			{
				type: "direct",
				id: "myaccount",
				title: t("myaccount.menu"),
				url: "/myaccount",
				icon: MyAccountIconStyled,
				visible: Boolean(selfAccess.self_myaccount),
			},
			{
				type: "direct",
				id: "usage",
				title: t("usage.menu"),
				url: "/usage",
				icon: UsageIconStyled,
				visible: canViewUsage,
			},
			{
				type: "direct",
				id: "hosts",
				title: t("header.hostSettings"),
				url: "/hosts",
				icon: HostsIconStyled,
				visible: canViewHosts,
			},
			{
				type: "direct",
				id: "services",
				title: t("services.title"),
				url: "/services",
				icon: ServicesIconStyled,
				visible: canViewServicesSection,
			},
			{
				type: "direct",
				id: "nodes",
				title: t("header.nodeSettings"),
				url: "/node-settings",
				icon: NodeIconStyled,
				visible: Boolean(sectionAccess?.[AdminSection.Nodes]),
			},
			{
				type: "group",
				id: "observability",
				title: t("sidebar.groups.observability"),
				icon: ObservabilityIconStyled,
				visible: Boolean(sectionAccess?.[AdminSection.Xray]) || canViewRecentActions,
				subItems: [
					{
						id: "xray_logs",
						title: t("pages.xray.logs"),
						url: "/xray-logs",
						icon: XrayLogsIconStyled,
						visible: Boolean(sectionAccess?.[AdminSection.Xray]),
					},
					{
						id: "access_insights",
						title: t("header.accessInsights"),
						url: "/access-insights",
						icon: InsightsIconStyled,
						visible: Boolean(sectionAccess?.[AdminSection.Xray]),
					},
					{
						id: "recent_actions",
						title: t("recentActions.title"),
						url: "/recent-actions",
						icon: RecentActionsIconStyled,
						visible: canViewRecentActions,
					},
				],
			},
			{
				type: "group",
				id: "infrastructure",
				title: t("sidebar.groups.infrastructure"),
				icon: InfrastructureIconStyled,
				visible: Boolean(sectionAccess?.[AdminSection.Xray]) || isPrivilegedAdmin,
				subItems: [
					{
						id: "xray_settings",
						title: t("header.xraySettings"),
						url: "/xray-settings",
						icon: XraySettingsIconStyled,
						visible: Boolean(sectionAccess?.[AdminSection.Xray]),
					},
					{
						id: "haproxy",
						title: t("haproxy.title"),
						url: "/haproxy",
						icon: HAProxyIconStyled,
						visible: isPrivilegedAdmin,
					},
				],
			},
			{
				type: "group",
				id: "system",
				title: t("sidebar.groups.system"),
				icon: SettingsIconStyled,
				visible:
					Boolean(sectionAccess?.[AdminSection.Integrations]) ||
					canManagePlaceholders ||
					isPrivilegedAdmin,
				subItems: [
					{
						id: "settings_panel",
						title: t("header.integrationSettings"),
						url: "/settings",
						icon: MasterSettingsIconStyled,
						visible: Boolean(sectionAccess?.[AdminSection.Integrations]),
					},
					{
						id: "placeholders",
						title: isPrivilegedAdmin
							? t("placeholders.menu")
							: t("placeholders.settingsMenu"),
						url: "/placeholders",
						icon: PlaceholderIconStyled,
						visible: canManagePlaceholders,
					},
					{
						id: "phpmyadmin",
						title: t("phpmyadmin.menu"),
						url: "/phpmyadmin",
						icon: PHPMyAdminIconStyled,
						visible: isPrivilegedAdmin,
					},
					{
						id: "external_apps",
						title: t("externalApps.menu"),
						url: "/external-apps",
						icon: ExternalAppsIconStyled,
						visible: isPrivilegedAdmin,
					},
					{
						id: "api_docs",
						title: t("apiDocs.menu"),
						url: "/api-docs",
						icon: ApiDocsIconStyled,
						visible: isPrivilegedAdmin,
					},
				],
			},
			{
				type: "direct",
				id: "tutorials",
				title: t("tutorials.menu"),
				url: tutorialsUrl,
				icon: TutorialIconStyled,
				badge: hasNewTutorials,
				visible: true,
			},
		],
		[
			t,
			canViewAdmins,
			selfAccess.self_myaccount,
			canViewUsage,
			canViewHosts,
			canViewServicesSection,
			sectionAccess,
			canViewRecentActions,
			isPrivilegedAdmin,
			canManagePlaceholders,
			hasNewTutorials,
		],
	);

	useEffect(() => {
		const path = location.pathname;
		if (path === "/users" || path === "/bulk-actions") {
			setOpenGroups((prev) => ({ ...prev, users_hub: true }));
		} else if (
			path.startsWith("/xray-logs") ||
			path.startsWith("/access-insights") ||
			path.startsWith("/recent-actions")
		) {
			setOpenGroups((prev) => ({ ...prev, observability: true }));
		} else if (path.startsWith("/xray-settings") || path.startsWith("/haproxy")) {
			setOpenGroups((prev) => ({ ...prev, infrastructure: true }));
		} else if (
			path.startsWith("/settings") ||
			path.startsWith("/placeholders") ||
			path.startsWith("/phpmyadmin") ||
			path.startsWith("/external-apps") ||
			path.startsWith("/api-docs")
		) {
			setOpenGroups((prev) => ({ ...prev, system: true }));
		}
	}, [location.pathname]);

	const isRTL = i18n.dir(currentLanguage) === "rtl";
	const sponsorItems: SponsorCarouselItem[] = [
		{
			id: "rebecca",
			src: logoUrl,
			alt: "Rebecca",
			label: "Rebecca",
		},
		...sponsors.map((asset) => ({
			id: asset.id,
			src: asset.image_url,
			alt: asset.alt || asset.label || "Sponsor",
			href: asset.target_url,
			label: asset.label,
			isSponsor: true,
		})),
	];

	return (
		<Box
			w={inDrawer ? "full" : collapsed ? "68px" : "240px"}
			h={inDrawer ? "100%" : "calc(100vh - 24px)"}
			maxH={inDrawer ? "100%" : "calc(100vh - 24px)"}
			bg={sidebarBg}
			borderWidth={inDrawer ? undefined : "1px"}
			borderColor={inDrawer ? undefined : sidebarBorderColor}
			borderRadius={inDrawer ? undefined : "20px"}
			boxShadow={
				inDrawer
					? undefined
					: "inset 0 1px 1px 0 rgba(255, 255, 255, 0.05), 0 16px 40px -8px rgba(0, 0, 0, 0.28)"
			}
			transition="width 0.3s cubic-bezier(0.16, 1, 0.3, 1)"
			position={inDrawer ? "relative" : "fixed"}
			top={inDrawer ? undefined : "12px"}
			left={inDrawer || isRTL ? undefined : "12px"}
			right={inDrawer || !isRTL ? undefined : "12px"}
			overflow="hidden"
			flexShrink={0}
			userSelect="none"
			zIndex={200}
		>
			<Flex direction="column" h="full" justify="space-between" p={collapsed ? 2 : 3}>
				<Flex
					align="center"
					justify={collapsed ? "center" : "flex-start"}
					px={collapsed ? 0 : 2}
					py={2.5}
					mb={2}
					borderBottomWidth="1px"
					borderColor="panel.border"
				>
					<Box
						borderWidth="1px"
						borderColor={sidebarPanelBorder}
						borderRadius="md"
						bg={sidebarPanelBg}
						mb={5}
						px={collapsed ? 2 : 3}
						py={collapsed ? 2 : 3}
					>
						<SponsorCarousel
							items={sponsorItems}
							variant="logo"
							collapsed={collapsed}
						/>
					</Box>
					<VStack align="stretch" spacing={4}>
						{compactGroups.map((group) => {
							if (group.items.length === 0) return null;

							return (
								<Box key={group.title}>
									{collapsed ? (
										<Box
											borderTopWidth="1px"
											borderColor={subNavBorder}
											my={2}
											mx={2}
										/>
									) : (
										<Text
											px={3}
											mb={2}
											fontSize="11px"
											fontWeight="700"
											color="panel.textMuted"
											textTransform="uppercase"
										>
											{group.title}
										</Text>
									)}
									<VStack align="stretch" spacing={1}>
										{group.items.map((item) => {
											if (!item.url) return null;
											const itemUrl = item.url;
											const isActive =
												location.pathname === itemUrl ||
												(itemUrl !== "/" &&
													location.pathname.startsWith(itemUrl));
											const Icon = item.icon;
											const showTutorialBadge =
												itemUrl === tutorialsUrl && hasNewTutorials;
											const navItem = (
												<Tooltip
													key={itemUrl}
													label={collapsed ? item.title : ""}
													placement={isRTL ? "left" : "right"}
													hasArrow
												>
													<HStack
														spacing={3}
														px={collapsed ? 2 : 3}
														py={2}
														minH="40px"
														borderRadius="4px"
														cursor="pointer"
														bg={isActive ? activeItemBg : "transparent"}
														color={isActive ? activeItemColor : itemColor}
														borderInlineStartWidth="3px"
														borderInlineStartColor={
															isActive ? "panel.accent" : "transparent"
														}
														_hover={{
															bg: isActive ? activeItemBg : hoverItemBg,
															color: activeItemColor,
														}}
														transition="background 0.15s ease, color 0.15s ease"
														justifyContent={collapsed ? "center" : "flex-start"}
													>
														{showTutorialBadge && collapsed ? (
															<Box position="relative" display="inline-flex">
																<Icon
																	w={collapsed ? 5 : undefined}
																	h={collapsed ? 5 : undefined}
																/>
																<Box
																	position="absolute"
																	top="-6px"
																	left={isRTL ? "-7px" : undefined}
																	right={isRTL ? undefined : "-7px"}
																	w="4"
																	h="4"
																	borderRadius="full"
																	bg="panel.accent"
																	color="white"
																	border="2px solid"
																	borderColor={sidebarBg}
																	display="inline-flex"
																	alignItems="center"
																	justifyContent="center"
																>
																	<TutorialUpdateIconStyled />
																</Box>
															</Box>
														) : (
															<Icon
																w={collapsed ? 5 : undefined}
																h={collapsed ? 5 : undefined}
															/>
														)}
														{!collapsed && (
															<>
																<Text
																	fontSize="sm"
																	fontWeight={isActive ? "700" : "600"}
																	noOfLines={1}
																>
																	{item.title}
																</Text>
																{showTutorialBadge ? (
																	<Box
																		ml={isRTL ? undefined : "auto"}
																		mr={isRTL ? "auto" : undefined}
																		w="5"
																		h="5"
																		borderRadius="full"
																		bg="panel.accent"
																		color="white"
																		display="inline-flex"
																		alignItems="center"
																		justifyContent="center"
																	>
																		<TutorialUpdateIconStyled />
																	</Box>
																) : null}
															</>
														)}
													</HStack>
												</Tooltip>
											);

											return (
												<NavLink
													key={itemUrl}
													to={itemUrl}
													onClick={(e) => handleNavClick(e, itemUrl)}
												>
													{navItem}
												</NavLink>
											);
										})}
									</VStack>
								</Box>
							);
						})}
					</VStack>
				</Box>
				{!collapsed && sidebarBanners.length > 0 && (
					<Box flexShrink={0} w="full">
						<SponsorCarousel
							items={sidebarBanners.map((asset) => ({
								id: asset.id,
								src: asset.image_url,
								alt: asset.alt || asset.label || "Sponsor",
								href: asset.target_url,
								label: asset.label,
								isSponsor: true,
							}))}
							variant="sidebar"
						/>
					</Box>
				)}
			</VStack>
		</Box>
	);
};