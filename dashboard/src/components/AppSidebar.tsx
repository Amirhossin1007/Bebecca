import {
	Box,
	chakra,
	HStack,
	Text,
	Tooltip,
	useColorModeValue,
	VStack,
} from "@chakra-ui/react";
import {
	ArrowsRightLeftIcon,
	BellAlertIcon,
	BoltIcon,
	BookOpenIcon,
	BriefcaseIcon,
	ChevronDownIcon,
	ChartBarIcon,
	CircleStackIcon,
	ClockIcon,
	CodeBracketSquareIcon,
	Cog6ToothIcon,
	Cog8ToothIcon,
	CommandLineIcon,
	DocumentDuplicateIcon,
	BellIcon,
	DocumentTextIcon,
	EyeIcon,
	HomeIcon,
	LinkIcon,
	ServerStackIcon,
	Squares2X2Icon,
	UserCircleIcon,
	UserGroupIcon,
	WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import logoUrl from "assets/logo.svg";
import useGetUser from "hooks/useGetUser";
import {
	type ElementType,
	type FC,
	type MouseEvent as ReactMouseEvent,
	useCallback,
	useEffect,
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
		w: 5,
		h: 5,
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
const NotificationIconStyled = chakra(BellIcon, iconProps);
const InsightsIconStyled = chakra(EyeIcon, iconProps);
const TutorialIconStyled = chakra(BookOpenIcon, iconProps);
const XraySettingsIconStyled = chakra(WrenchScrewdriverIcon, iconProps);
const XrayLogsIconStyled = chakra(DocumentTextIcon, iconProps);
const ApiDocsIconStyled = chakra(CodeBracketSquareIcon, iconProps);
const PHPMyAdminIconStyled = chakra(CircleStackIcon, iconProps);
const ExternalAppsIconStyled = chakra(CommandLineIcon, iconProps);
const PlaceholderIconStyled = chakra(DocumentDuplicateIcon, iconProps);
const TutorialUpdateIconStyled = chakra(BellAlertIcon, {
	baseStyle: {
		w: 3,
		h: 3,
	},
});
interface AppSidebarProps {
	collapsed: boolean;
	sponsors?: SponsorAsset[];
	sidebarBanners?: SponsorAsset[];
	/** when rendered inside a Drawer on mobile */
	inDrawer?: boolean;
	/** optional callback to request the parent to expand the sidebar */
	onRequestExpand?: () => void;
}

type SidebarItem = {
	title: string;
	icon: ElementType;
	url?: string;
	subItems?: {
		title: string;
		url: string;
		icon: ElementType;
	}[];
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
	const currentLanguage = i18n.language || "en";
	const tutorialsUrl = "/tutorials";
	const sectionAccess = userData.permissions?.sections;
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
	const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
	const [hasNewTutorials, setHasNewTutorials] = useState(false);

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
		} catch (err) {
			console.error("Failed to check tutorial updates", err);
			setHasNewTutorials(false);
		}
	}, [dashboardRoot, i18n.language]);

	useEffect(() => {
		void checkTutorialUpdates();
	}, [checkTutorialUpdates]);

	const baseSettingsSubItems: SidebarSubItems = [
		isPrivilegedAdmin
			? {
					title: "errors",
					url: "/errors",
					icon: InsightsIconStyled,
				}
			: null,
		sectionAccess?.[AdminSection.Hosts]
			? {
					title: t("header.hostSettings"),
					url: "/hosts",
					icon: HostsIconStyled,
				}
			: null,
		sectionAccess?.[AdminSection.Nodes]
			? {
					title: t("header.nodeSettings"),
					url: "/node-settings",
					icon: NodeIconStyled,
				}
			: null,
		sectionAccess?.[AdminSection.Integrations]
			? {
					title: t("header.integrationSettings"),
					url: "/settings",
					icon: MasterSettingsIconStyled,
				}
			: null,
		sectionAccess?.[AdminSection.Xray]
			? {
					title: t("header.xraySettings"),
					url: "/xray-settings",
					icon: XraySettingsIconStyled,
				}
			: null,
		isPrivilegedAdmin
			? {
					title: t("haproxy.title"),
					url: "/haproxy",
					icon: HAProxyIconStyled,
				}
			: null,
		sectionAccess?.[AdminSection.Xray]
			? {
					title: t("pages.xray.logs"),
					url: "/xray-logs",
					icon: XrayLogsIconStyled,
				}
			: null,
		sectionAccess?.[AdminSection.Xray]
			? {
					title: t("header.accessInsights"),
					url: "/access-insights",
					icon: InsightsIconStyled,
				}
			: null,
		canViewRecentActions
			? {
					title: t("recentActions.title"),
					url: "/recent-actions",
					icon: RecentActionsIconStyled,
				}
			: null,
		isPrivilegedAdmin
			? {
					title: t("phpmyadmin.menu"),
					url: "/phpmyadmin",
					icon: PHPMyAdminIconStyled,
				}
			: null,
		isPrivilegedAdmin
			? {
					title: t("externalApps.menu"),
					url: "/external-apps",
					icon: ExternalAppsIconStyled,
				}
			: null,
		isPrivilegedAdmin
			? {
					title: t("apiDocs.menu"),
					url: "/api-docs",
					icon: ApiDocsIconStyled,
				}
			: null,
		canManagePlaceholders
			? {
					title: isPrivilegedAdmin
						? t("placeholders.menu")
						: t("placeholders.settingsMenu"),
					url: "/placeholders",
					icon: PlaceholderIconStyled,
				}
			: null,
		{
			title: t("tutorials.menu"),
			url: tutorialsUrl,
			icon: TutorialIconStyled,
		},
	].filter(Boolean) as SidebarSubItems;

	const settingsSubItems: SidebarSubItems = [...baseSettingsSubItems];
	if (canViewServicesSection) {
		settingsSubItems.unshift({
			title: t("services.title"),
			url: "/services",
			icon: ServicesIconStyled,
		});
	}

	const defaultTabByPath: Record<string, string> = {
		"/settings": "panel",
		"/hosts": "inbounds",
		"/usage": "services",
		"/xray-settings": "basic",
	};

	const handleNavClick = (event?: ReactMouseEvent, targetUrl?: string) => {
		if (inDrawer && onRequestExpand) {
			onRequestExpand();
		}
		if (!targetUrl) return;
		const defaultTab = defaultTabByPath[targetUrl];
		if (defaultTab) {
			event?.preventDefault();
			const normalized = targetUrl.startsWith("/")
				? targetUrl
				: `/${targetUrl}`;
			navigate(`${normalized}#${defaultTab}`);
		}
	};

	const items: SidebarItem[] = [
		{ title: t("dashboard"), url: "/", icon: HomeIconStyled },
		{ title: t("users"), url: "/users", icon: UsersIconStyled },
	];

	items.push({
		title: t("bulkActions.menu"),
		url: "/bulk-actions",
		icon: BulkActionsIconStyled,
	});

	if (selfAccess.self_myaccount) {
		items.splice(1, 0, {
			title: t("myaccount.menu"),
			url: "/myaccount",
			icon: MyAccountIconStyled,
		});
	}

	items.push({
		title: t("notifications.menu"),
		url: "/notifications",
		icon: NotificationIconStyled,
	});

	if (canViewUsage) {
		items.push({
			title: t("usage.menu"),
			url: "/usage",
			icon: UsageIconStyled,
		});
	}
	if (canViewAdmins) {
		items.push({
			title: t("admins"),
			url: "/admins",
			icon: AdminIconStyled,
		});
	}
	if (settingsSubItems.length > 0) {
		items.push({
			title: t("header.settings"),
			icon: SettingsIconStyled,
			subItems: settingsSubItems,
		});
	}

	const directItems = items.filter((item) => item.url);
	const directByUrl = new Map(
		directItems.map((item) => [item.url as string, item]),
	);
	const settingsByUrl = new Map(
		settingsSubItems.map((item) => [item.url, item as SidebarItem]),
	);
	const pickDirect = (url: string) => directByUrl.get(url);
	const pickSetting = (url: string) => settingsByUrl.get(url);
	const compactGroups = [
		{
			title: t("dashboard"),
			items: [pickDirect("/")],
		},
		{
			title: t("users"),
			items: [pickDirect("/users"), pickDirect("/bulk-actions")],
		},
		{
			title: t("sidebar.groups.infrastructure"),
			items: [
				pickSetting("/node-settings"),
				pickSetting("/services"),
				pickSetting("/hosts"),
			],
		},
		{
			title: t("admins.admin"),
			items: [
				pickDirect("/admins"),
				pickDirect("/usage"),
				pickDirect("/myaccount"),
				pickDirect("/notifications"),
			],
		},
		{
			title: t("sidebar.groups.system"),
			items: [
				pickSetting("/settings"),
				pickSetting("/xray-settings"),
				pickSetting("/haproxy"),
				pickSetting("/xray-logs"),
				pickSetting("/errors"),
				pickSetting("/access-insights"),
				pickSetting("/recent-actions"),
				pickSetting("/phpmyadmin"),
				pickSetting("/external-apps"),
				pickSetting("/placeholders"),
				pickSetting("/api-docs"),
				pickSetting(tutorialsUrl),
			],
		},
	].map((group) => ({
		...group,
		items: group.items.filter(Boolean) as SidebarItem[],
	}));

	const isRTL = i18n.dir(currentLanguage) === "rtl";
	const isItemActive = (url: string) =>
		location.pathname === url ||
		(url !== "/" && location.pathname.startsWith(url));
	const groupIsOpen = (group: (typeof compactGroups)[number]) =>
		openGroups[group.title] ??
		(group.items.length <= 4 ||
			group.items.some((item) => isItemActive(item.url as string)));
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
			w={inDrawer ? "full" : collapsed ? "16" : "56"}
			h={inDrawer ? "100%" : "calc(100vh - 24px)"}
			maxH={inDrawer ? "100%" : "calc(100vh - 24px)"}
			bg={sidebarBg}
			borderWidth={inDrawer ? undefined : "1px"}
			borderColor={inDrawer ? undefined : sidebarBorderColor}
			borderRadius={inDrawer ? undefined : "2xl"}
			boxShadow={inDrawer ? undefined : sidebarShadow}
			transition="width 0.3s ease"
			position={inDrawer ? "relative" : "fixed"}
			top={inDrawer ? undefined : "12px"}
			left={inDrawer || isRTL ? undefined : "12px"}
			right={inDrawer || !isRTL ? undefined : "12px"}
			overflow="hidden"
			flexShrink={0}
			userSelect="none"
		>
			<VStack
				spacing={2}
				p={collapsed ? 2 : 4}
				align="stretch"
				h="100%"
				minH={0}
				justify="space-between"
			>
				<Box
					flex="1"
					minH={0}
					overflowY="auto"
					overflowX="hidden"
					className="rb-sidebar-scroll"
					data-dir={isRTL ? "rtl" : "ltr"}
					data-collapsed={collapsed ? "true" : "false"}
					dir={isRTL ? "rtl" : "ltr"}
				>
					<Box
						borderWidth="1px"
						borderColor={sidebarPanelBorder}
						borderRadius="md"
						bg={sidebarPanelBg}
						mb={3}
						px={2}
						py={collapsed ? 1.5 : 2}
					>
						<SponsorCarousel
							items={sponsorItems}
							variant="logo"
							collapsed={collapsed}
						/>
					</Box>
					<VStack align="stretch" spacing={collapsed ? 1 : 2}>
						{compactGroups.map((group) => {
							if (group.items.length === 0) return null;
							const isOpen = collapsed || groupIsOpen(group);

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
										<HStack
											as="button"
											type="button"
											w="full"
											px={3}
											py={1}
											mb={1}
											justify="space-between"
											color="panel.textMuted"
											borderRadius="4px"
											_hover={{ color: "panel.text" }}
											aria-expanded={isOpen}
											onClick={() =>
												setOpenGroups((prev) => ({
													...prev,
													[group.title]: !isOpen,
												}))
											}
										>
											<Text
												fontSize="11px"
												fontWeight="700"
												textTransform="uppercase"
											>
												{group.title}
											</Text>
											<ChevronDownIcon
												width={14}
												height={14}
												style={{
													transform: isOpen ? undefined : "rotate(-90deg)",
													transition: "transform 0.15s ease",
												}}
											/>
										</HStack>
									)}
									<VStack
										align="stretch"
										spacing={0.5}
										display={isOpen ? "flex" : "none"}
									>
										{group.items.map((item) => {
											if (!item.url) return null;
											const itemUrl = item.url;
											const isActive = isItemActive(itemUrl);
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
														py={1.5}
														minH={{ base: "44px", md: "36px" }}
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
