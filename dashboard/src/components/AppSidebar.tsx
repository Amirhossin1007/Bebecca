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
	useColorMode,
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
import type { SponsorAsset } from "service/sponsors";
import { AdminRole, AdminSection, AdminSudoScope } from "types/Admin";
import {
	getTutorialManifestUrl,
	getTutorialSeenKey,
	normalizeTutorialLang,
} from "utils/tutorials";
import { SponsorCarousel } from "./SponsorCarousel";

const iconProps = {
	baseStyle: {
		w: "18px",
		h: "18px",
	},
};

const subIconProps = {
	baseStyle: {
		w: "16px",
		h: "16px",
	},
};

const HomeIconStyled = chakra(HomeIcon, iconProps);
const UsersIconStyled = chakra(UserGroupIcon, iconProps);
const BulkActionsIconStyled = chakra(BoltIcon, subIconProps);
const UsersListIconStyled = chakra(UserGroupIcon, subIconProps);
const RecentActionsIconStyled = chakra(ClockIcon, subIconProps);
const SettingsIconStyled = chakra(Cog6ToothIcon, iconProps);
const MasterSettingsIconStyled = chakra(Cog8ToothIcon, subIconProps);
const NodeIconStyled = chakra(ServerStackIcon, iconProps);
const AdminIconStyled = chakra(BriefcaseIcon, iconProps);
const ServicesIconStyled = chakra(Squares2X2Icon, iconProps);
const HostsIconStyled = chakra(LinkIcon, iconProps);
const HAProxyIconStyled = chakra(ArrowsRightLeftIcon, subIconProps);
const UsageIconStyled = chakra(ChartBarIcon, iconProps);
const MyAccountIconStyled = chakra(UserCircleIcon, iconProps);
const InsightsIconStyled = chakra(EyeIcon, subIconProps);
const TutorialIconStyled = chakra(BookOpenIcon, iconProps);
const XraySettingsIconStyled = chakra(WrenchScrewdriverIcon, subIconProps);
const XrayLogsIconStyled = chakra(DocumentTextIcon, subIconProps);
const ApiDocsIconStyled = chakra(CodeBracketSquareIcon, iconProps);
const PHPMyAdminIconStyled = chakra(CircleStackIcon, subIconProps);
const ExternalAppsIconStyled = chakra(CommandLineIcon, subIconProps);
const PlaceholderIconStyled = chakra(DocumentDuplicateIcon, subIconProps);
const ObservabilityIconStyled = chakra(ShieldCheckIcon, iconProps);
const InfrastructureIconStyled = chakra(WrenchScrewdriverIcon, iconProps);

const LogoIcon = chakra("img", {
	baseStyle: {
		w: "30px",
		h: "30px",
		objectFit: "contain",
	},
});

interface AppSidebarProps {
	collapsed: boolean;
	sponsors?: SponsorAsset[];
	sidebarBanners?: SponsorAsset[];
	inDrawer?: boolean;
	onRequestExpand?: () => void;
}

type DirectNavItem = {
	type: "direct";
	id: string;
	title: string;
	url: string;
	icon: ElementType;
	visible: boolean;
	badge?: boolean;
};

type GroupSubItem = {
	id: string;
	title: string;
	url: string;
	icon: ElementType;
	visible: boolean;
};

type GroupNavItem = {
	type: "group";
	id: string;
	title: string;
	icon: ElementType;
	subItems: GroupSubItem[];
	visible: boolean;
};

type NavItem = DirectNavItem | GroupNavItem;

type NavSection = {
	id: string;
	title: string;
	items: NavItem[];
};

export const AppSidebar: FC<AppSidebarProps> = ({
	collapsed,
	sidebarBanners = [],
	inDrawer = false,
	onRequestExpand,
}) => {
	const { t, i18n } = useTranslation();
	const location = useLocation();
	const navigate = useNavigate();
	const dashboardRoot = useHref("/");
	const { colorMode } = useColorMode();
	const { userData } = useGetUser();
	const isRTL = i18n.dir(i18n.language) === "rtl";
	const tutorialsUrl = "/tutorials";

	const isFullAccess = userData.role === AdminRole.FullAccess;
	const isPrivilegedAdmin = isFullAccess || userData.role === AdminRole.Sudo;
	const sectionAccess = userData.permissions?.sections;

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
	const canViewNodes = Boolean(sectionAccess?.[AdminSection.Nodes]);
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

	const navSections: NavSection[] = useMemo(
		() => [
			{
				id: "sec_dashboard",
				title: t("sidebar.sections.dashboard"),
				items: [
					{
						type: "direct",
						id: "dashboard",
						title: t("dashboard"),
						url: "/",
						icon: HomeIconStyled,
						visible: true,
					},
				],
			},
			{
				id: "sec_users",
				title: t("sidebar.sections.users"),
				items: [
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
								icon: UsersListIconStyled,
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
				],
			},
			{
				id: "sec_traffic_admins",
				title: t("sidebar.sections.trafficAndAdmins"),
				items: [
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
						id: "admins",
						title: t("admins"),
						url: "/admins",
						icon: AdminIconStyled,
						visible: canViewAdmins,
					},
				],
			},
			{
				id: "sec_infrastructure",
				title: t("sidebar.sections.infrastructure"),
				items: [
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
						id: "hosts",
						title: t("header.hostSettings"),
						url: "/hosts",
						icon: HostsIconStyled,
						visible: canViewHosts,
					},
					{
						type: "direct",
						id: "nodes",
						title: t("header.nodeSettings"),
						url: "/node-settings",
						icon: NodeIconStyled,
						visible: canViewNodes,
					},
				],
			},
			{
				id: "sec_system",
				title: t("sidebar.sections.system"),
				items: [
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
						id: "core_routing",
						title: t("sidebar.groups.coreRouting"),
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
						id: "system_tools",
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
						],
					},
				],
			},
			{
				id: "sec_docs",
				title: t("sidebar.sections.docs"),
				items: [
					{
						type: "direct",
						id: "tutorials",
						title: t("sidebar.tutorialsAndFaq"),
						url: tutorialsUrl,
						icon: TutorialIconStyled,
						badge: hasNewTutorials,
						visible: true,
					},
					{
						type: "direct",
						id: "api_docs",
						title: t("apiDocs.menu"),
						url: "/api-docs",
						icon: ApiDocsIconStyled,
						visible: isPrivilegedAdmin,
					},
				],
			},
		],
		[
			t,
			canViewAdmins,
			selfAccess.self_myaccount,
			canViewUsage,
			canViewHosts,
			canViewNodes,
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
			setOpenGroups((prev) => ({ ...prev, core_routing: true }));
		} else if (
			path.startsWith("/settings") ||
			path.startsWith("/placeholders") ||
			path.startsWith("/phpmyadmin") ||
			path.startsWith("/external-apps")
		) {
			setOpenGroups((prev) => ({ ...prev, system_tools: true }));
		}
	}, [location.pathname]);

	const handleGroupClick = (group: GroupNavItem) => {
		const isCurrentlyOpen = Boolean(openGroups[group.id]);
		setOpenGroups((prev) => ({ ...prev, [group.id]: !isCurrentlyOpen }));
	};

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
					px="10px"
					py={2.5}
					mb={2}
					minH="48px"
					borderBottomWidth="1px"
					borderColor="panel.border"
					cursor="pointer"
					onClick={() => navigate("/")}
				>
					<Box
						w="32px"
						h="32px"
						flexShrink={0}
						display="flex"
						alignItems="center"
						justifyContent="center"
					>
						<LogoIcon
							src={logoUrl}
							alt="Rebecca"
							style={{
								filter: colorMode === "dark" ? "brightness(0) invert(1)" : "brightness(0)",
								transition: "filter 0.3s ease",
							}}
						/>
					</Box>
					<Box
						flex="1"
						minW="0"
						ms={2.5}
						overflow="hidden"
						whiteSpace="nowrap"
						opacity={collapsed ? 0 : 1}
						maxW={collapsed ? "0px" : "150px"}
						transform={
							collapsed
								? isRTL
									? "translateX(10px)"
									: "translateX(-10px)"
								: "translateX(0)"
						}
						transition="max-width 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1), transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)"
						pointerEvents={collapsed ? "none" : "auto"}
					>
						<Text fontSize="17px" fontWeight="800" letterSpacing="-0.02em" color="panel.text">
							Rebecca
						</Text>
					</Box>
				</Flex>

				<Box
					flex="1"
					minH={0}
					overflowY="auto"
					overflowX="hidden"
					className="rb-sidebar-scroll"
					dir={isRTL ? "rtl" : "ltr"}
					px={collapsed ? 0 : 1}
				>
					<VStack align="stretch" spacing={2} py={1}>
						{navSections.map((section, secIdx) => {
							const visibleItems = section.items.filter((item) => item.visible);
							if (visibleItems.length === 0) return null;

							return (
								<Box key={section.id}>
									{secIdx > 0 && (
										<Box
											h="1px"
											bg="panel.border"
											mx={2}
											my={1.5}
											opacity={collapsed ? 0.6 : 0}
											display={collapsed ? "block" : "none"}
											transition="opacity 0.25s ease"
										/>
									)}

									<Box
										overflow="hidden"
										whiteSpace="nowrap"
										maxH={collapsed ? "0px" : "28px"}
										opacity={collapsed ? 0 : 1}
										mb={collapsed ? 0 : 1}
										mt={secIdx === 0 ? 0 : 1.5}
										transition="max-height 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease, margin 0.3s ease"
										pointerEvents="none"
									>
										<Text
											px={3}
											fontSize="10px"
											fontWeight="700"
											color="panel.textMuted"
											textTransform="uppercase"
											letterSpacing="0.06em"
											userSelect="none"
										>
											{section.title}
										</Text>
									</Box>

									<VStack align="stretch" spacing={1}>
										{visibleItems.map((entry) => {
											if (entry.type === "direct") {
												const isCurrent =
													location.pathname === entry.url ||
													(entry.url !== "/" && location.pathname.startsWith(entry.url));
												const IconEl = entry.icon;

												const btnContent = (
													<Flex
														align="center"
														w="full"
														h="38px"
														px="11px"
														borderRadius="10px"
														bg={isCurrent ? activeItemBg : "transparent"}
														color={isCurrent ? "panel.text" : normalItemColor}
														fontWeight={isCurrent ? "700" : "500"}
														fontSize="13px"
														position="relative"
														cursor="pointer"
														transition="all 0.2s cubic-bezier(0.16, 1, 0.3, 1)"
														borderInlineStartWidth={isCurrent ? "3px" : "0px"}
														borderInlineStartColor="var(--rb-panel-accent)"
														_hover={{
															md: {
																bg: isCurrent ? activeItemBg : hoverItemBg,
																color: "panel.text",
															},
														}}
													>
														<Box
															w="30px"
															h="30px"
															flexShrink={0}
															display="flex"
															alignItems="center"
															justifyContent="center"
															color={isCurrent ? activeItemColor : "inherit"}
															transition="color 0.2s ease"
														>
															<IconEl />
														</Box>

														<Box
															flex="1"
															minW="0"
															ms={collapsed ? 0 : 2.5}
															overflow="hidden"
															whiteSpace="nowrap"
															opacity={collapsed ? 0 : 1}
															maxW={collapsed ? "0px" : "160px"}
															transform={
																collapsed
																	? isRTL
																		? "translateX(8px)"
																		: "translateX(-8px)"
																	: "translateX(0)"
															}
															transition="max-width 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1), transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), margin 0.3s cubic-bezier(0.16, 1, 0.3, 1)"
															pointerEvents={collapsed ? "none" : "auto"}
														>
															<Text
																noOfLines={1}
																color={isCurrent ? "panel.text" : normalItemColor}
																fontSize="13px"
																fontWeight={isCurrent ? "700" : "500"}
															>
																{entry.title}
															</Text>
														</Box>

														{!collapsed && entry.badge && (
															<Box
																w="6px"
																h="6px"
																borderRadius="full"
																bg="var(--rb-panel-accent)"
																boxShadow="0 0 6px var(--rb-panel-accent)"
																flexShrink={0}
															/>
														)}

														{collapsed && entry.badge && (
															<Box
																position="absolute"
																top="6px"
																insetInlineEnd="6px"
																w="5px"
																h="5px"
																borderRadius="full"
																bg="var(--rb-panel-accent)"
															/>
														)}
													</Flex>
												);

												return collapsed ? (
													<Tooltip
														key={entry.id}
														label={entry.title}
														placement={isRTL ? "left" : "right"}
														hasArrow
													>
														<Box
															as={NavLink}
															to={entry.url}
															onClick={(e: ReactMouseEvent) => handleNavigate(entry.url, e)}
															display="block"
														>
															{btnContent}
														</Box>
													</Tooltip>
												) : (
													<Box
														key={entry.id}
														as={NavLink}
														to={entry.url}
														onClick={(e: ReactMouseEvent) => handleNavigate(entry.url, e)}
														display="block"
													>
														{btnContent}
													</Box>
												);
											}

											const visibleSubs = entry.subItems.filter((s) => s.visible);
											if (visibleSubs.length === 0) return null;

											const isGroupActive = visibleSubs.some(
												(s) =>
													location.pathname === s.url ||
													(s.url !== "/" && location.pathname.startsWith(s.url)),
											);
											const isOpen = Boolean(openGroups[entry.id]);
											const GroupIcon = entry.icon;

											if (collapsed) {
												return (
													<Popover
														key={entry.id}
														trigger="hover"
														placement={isRTL ? "left-start" : "right-start"}
														isLazy
														gutter={8}
													>
														<PopoverTrigger>
															<Flex
																align="center"
																justify="center"
																w="full"
																h="38px"
																px="11px"
																borderRadius="10px"
																bg={isGroupActive ? activeItemBg : "transparent"}
																color={isGroupActive ? activeItemColor : normalItemColor}
																cursor="pointer"
																transition="all 0.2s ease"
																borderInlineStartWidth={isGroupActive ? "3px" : "0px"}
																borderInlineStartColor="var(--rb-panel-accent)"
																_hover={{ md: { bg: hoverItemBg, color: "panel.text" } }}
															>
																<Box
																	w="30px"
																	h="30px"
																	display="flex"
																	alignItems="center"
																	justifyContent="center"
																>
																	<GroupIcon />
																</Box>
															</Flex>
														</PopoverTrigger>
														<PopoverContent
															bg="panel.surface"
															borderColor="panel.border"
															borderWidth="1px"
															borderRadius="xl"
															p={1.5}
															minW="180px"
															boxShadow="0 12px 36px rgba(0,0,0,0.3)"
															dir={isRTL ? "rtl" : "ltr"}
															_focus={{ outline: "none" }}
														>
															<PopoverHeader
																borderBottomWidth="1px"
																borderColor="panel.border"
																px={2.5}
																py={1.5}
																fontSize="11px"
																fontWeight="700"
																color="panel.textMuted"
															>
																{entry.title}
															</PopoverHeader>
															<PopoverBody p={0} pt={1}>
																<VStack align="stretch" spacing={1}>
																	{visibleSubs.map((sub) => {
																		const isSubActive =
																			location.pathname === sub.url ||
																			(sub.url !== "/" && location.pathname.startsWith(sub.url));
																		const SubIcon = sub.icon;

																		return (
																			<Box
																				key={sub.id}
																				as={NavLink}
																				to={sub.url}
																				onClick={(e: ReactMouseEvent) => handleNavigate(sub.url, e)}
																				display="block"
																			>
																				<Flex
																					align="center"
																					gap={2}
																					px={2.5}
																					py={1.5}
																					borderRadius="md"
																					fontSize="12px"
																					fontWeight={isSubActive ? "700" : "500"}
																					bg={isSubActive ? activeItemBg : "transparent"}
																					color={isSubActive ? "panel.text" : normalItemColor}
																					borderInlineStartWidth={isSubActive ? "2.5px" : "0px"}
																					borderInlineStartColor="var(--rb-panel-accent)"
																					_hover={{ md: { bg: hoverItemBg, color: "panel.text" } }}
																				>
																					<Box as="span" color={isSubActive ? activeItemColor : "inherit"}>
																						<SubIcon />
																					</Box>
																					<Text noOfLines={1} color={isSubActive ? "panel.text" : normalItemColor}>
																						{sub.title}
																					</Text>
																				</Flex>
																			</Box>
																		);
																	})}
																</VStack>
															</PopoverBody>
														</PopoverContent>
													</Popover>
												);
											}

											return (
												<Box key={entry.id}>
													<Flex
														align="center"
														w="full"
														h="38px"
														px="11px"
														borderRadius="10px"
														bg={isGroupActive && !isOpen ? activeItemBg : "transparent"}
														color={isGroupActive ? "panel.text" : normalItemColor}
														fontWeight={isGroupActive ? "700" : "500"}
														fontSize="13px"
														cursor="pointer"
														transition="all 0.2s cubic-bezier(0.16, 1, 0.3, 1)"
														borderInlineStartWidth={isGroupActive && !isOpen ? "3px" : "0px"}
														borderInlineStartColor="var(--rb-panel-accent)"
														onClick={() => handleGroupClick(entry)}
														_hover={{
															md: {
																bg: hoverItemBg,
																color: "panel.text",
															},
														}}
													>
														<Box
															w="30px"
															h="30px"
															flexShrink={0}
															display="flex"
															alignItems="center"
															justifyContent="center"
															color={isGroupActive ? activeItemColor : "inherit"}
															transition="color 0.2s ease"
														>
															<GroupIcon />
														</Box>

														<Box
															flex="1"
															minW="0"
															ms={collapsed ? 0 : 2.5}
															overflow="hidden"
															whiteSpace="nowrap"
															opacity={collapsed ? 0 : 1}
															maxW={collapsed ? "0px" : "160px"}
															transform={
																collapsed
																	? isRTL
																		? "translateX(8px)"
																		: "translateX(-8px)"
																	: "translateX(0)"
															}
															transition="max-width 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1), transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), margin 0.3s cubic-bezier(0.16, 1, 0.3, 1)"
															pointerEvents={collapsed ? "none" : "auto"}
														>
															<Text
																noOfLines={1}
																color={isGroupActive ? "panel.text" : normalItemColor}
																fontSize="13px"
																fontWeight={isGroupActive ? "700" : "500"}
															>
																{entry.title}
															</Text>
														</Box>

														<Box
															flexShrink={0}
															overflow="hidden"
															opacity={collapsed ? 0 : 0.65}
															maxW={collapsed ? "0px" : "20px"}
															transition="max-width 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease"
														>
															<Icon
																as={ChevronDownIcon}
																w="14px"
																h="14px"
																color="panel.textMuted"
																transform={isOpen ? "rotate(180deg)" : "rotate(0deg)"}
																transition="transform 0.24s cubic-bezier(0.16, 1, 0.3, 1)"
															/>
														</Box>
													</Flex>

													<AnimatePresence initial={false}>
														{isOpen && (
															<motion.div
																initial={{ opacity: 0, height: 0 }}
																animate={{ opacity: 1, height: "auto" }}
																exit={{ opacity: 0, height: 0 }}
																transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
																style={{ overflow: "hidden" }}
															>
																<Box
																	ms="16px"
																	ps="10px"
																	my={1}
																	borderInlineStart="1.5px solid"
																	borderColor="panel.border"
																>
																	<VStack align="stretch" spacing={0.5}>
																		{visibleSubs.map((sub) => {
																			const isSubActive =
																				location.pathname === sub.url ||
																				(sub.url !== "/" && location.pathname.startsWith(sub.url));
																			const SubIcon = sub.icon;

																			return (
																				<Box
																					key={sub.id}
																					as={NavLink}
																					to={sub.url}
																					onClick={(e: ReactMouseEvent) => handleNavigate(sub.url, e)}
																					display="block"
																				>
																					<Flex
																						align="center"
																						justify="space-between"
																						w="full"
																						h="32px"
																						px={2.5}
																						borderRadius="8px"
																						bg={isSubActive ? activeItemBg : "transparent"}
																						color={isSubActive ? "panel.text" : normalItemColor}
																						fontWeight={isSubActive ? "700" : "500"}
																						fontSize="12px"
																						cursor="pointer"
																						transition="all 0.22s cubic-bezier(0.16, 1, 0.3, 1)"
																						borderInlineStartWidth={isSubActive ? "2.5px" : "0px"}
																						borderInlineStartColor="var(--rb-panel-accent)"
																						_hover={{
																							md: {
																								bg: isSubActive ? activeItemBg : hoverItemBg,
																								color: "panel.text",
																							},
																						}}
																					>
																						<HStack spacing={2} align="center">
																							<Box
																								as="span"
																								display="inline-flex"
																								alignItems="center"
																								justifyContent="center"
																								color={isSubActive ? activeItemColor : "inherit"}
																								opacity={isSubActive ? 1 : 0.8}
																							>
																								<SubIcon />
																							</Box>
																							<Text noOfLines={1} color={isSubActive ? "panel.text" : normalItemColor}>
																								{sub.title}
																							</Text>
																						</HStack>
																					</Flex>
																				</Box>
																			);
																		})}
																	</VStack>
																</Box>
															</motion.div>
														)}
													</AnimatePresence>
												</Box>
											);
										})}
									</VStack>
								</Box>
							);
						})}
					</VStack>
				</Box>
				{!collapsed && sidebarBanners.length > 0 && (
					<Box flexShrink={0} w="full" pt={2}>
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
			</Flex>
		</Box>
	);
};
