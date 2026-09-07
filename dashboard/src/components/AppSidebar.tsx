import {
	Avatar,
	Box,
	chakra,
	Flex,
	HStack,
	Icon,
	IconButton,
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
	ChevronLeftIcon,
	ChevronRightIcon,
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
	ArrowRightOnRectangleIcon,
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
import { logout as logoutSession } from "service/auth";
import { AdminRole, AdminSection, AdminSudoScope } from "types/Admin";
import { clearClientSession } from "utils/session";
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
	inDrawer?: boolean;
	onRequestExpand?: () => void;
	onToggleCollapse?: () => void;
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

type GroupNavItem = {
	type: "group";
	id: string;
	title: string;
	icon: ElementType;
	primaryUrl?: string;
	subItems: GroupSubItem[];
	visible: boolean;
};

type NavEntry = DirectNavItem | GroupNavItem;

export const AppSidebar: FC<AppSidebarProps> = ({
	collapsed,
	inDrawer = false,
	onRequestExpand,
	onToggleCollapse,
}) => {
	const { t, i18n } = useTranslation();
	const location = useLocation();
	const navigate = useNavigate();
	const dashboardRoot = useHref("/");
	const { colorMode } = useColorMode();
	const { userData, getUserIsSuccess } = useGetUser();
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

	const roleLabel = useMemo(() => {
		switch (userData.role) {
			case AdminRole.FullAccess:
				return t("admins.roles.fullAccess");
			case AdminRole.Sudo:
				return t("admins.roles.sudo");
			case AdminRole.Reseller:
				return t("admins.roles.reseller");
			default:
				return t("admins.roles.standard");
		}
	}, [t, userData.role]);

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
				primaryUrl: "/users",
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

	const handleGroupClick = (group: GroupNavItem) => {
		const isCurrentlyOpen = Boolean(openGroups[group.id]);
		setOpenGroups((prev) => ({ ...prev, [group.id]: !isCurrentlyOpen }));

		if (group.primaryUrl) {
			handleNavigate(group.primaryUrl);
		}
	};

	const handleLogout = async () => {
		try {
			await logoutSession();
		} finally {
			clearClientSession();
			navigate("/login");
		}
	};

	return (
		<Box
			w={inDrawer ? "full" : collapsed ? "68px" : "240px"}
			h={inDrawer ? "100%" : "calc(100vh - 24px)"}
			maxH={inDrawer ? "100%" : "calc(100vh - 24px)"}
			bg={sidebarBg}
			borderWidth={inDrawer ? undefined : "1px"}
			borderColor={inDrawer ? undefined : sidebarBorderColor}
			borderRadius={inDrawer ? undefined : "2xl"}
			boxShadow={
				inDrawer
					? undefined
					: "inset 0 1px 1px 0 rgba(255, 255, 255, 0.05), 0 16px 40px -8px rgba(0, 0, 0, 0.28)"
			}
			transition="width 0.28s cubic-bezier(0.16, 1, 0.3, 1)"
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
					justify={collapsed ? "center" : "space-between"}
					px={collapsed ? 0 : 2}
					py={2.5}
					mb={2}
					borderBottomWidth="1px"
					borderColor="panel.border"
				>
					{!collapsed ? (
						<HStack spacing={2.5} align="center" cursor="pointer" onClick={() => navigate("/")}>
							<LogoIcon
								src={logoUrl}
								alt="Rebecca"
								filter={colorMode === "dark" ? "brightness(0) invert(1)" : "none"}
							/>
							<Text fontSize="15px" fontWeight="700" letterSpacing="-0.02em" color="panel.text">
								Rebecca
							</Text>
						</HStack>
					) : (
						<Tooltip label="Rebecca" placement={isRTL ? "left" : "right"} hasArrow>
							<Box cursor="pointer" onClick={() => navigate("/")}>
								<LogoIcon
									src={logoUrl}
									alt="Rebecca"
									filter={colorMode === "dark" ? "brightness(0) invert(1)" : "none"}
								/>
							</Box>
						</Tooltip>
					)}

					{!inDrawer && !collapsed && onToggleCollapse && (
						<IconButton
							size="xs"
							variant="ghost"
							borderRadius="full"
							aria-label="Collapse"
							icon={
								isRTL ? (
									<ChevronRightIcon width={14} height={14} />
								) : (
									<ChevronLeftIcon width={14} height={14} />
								)
							}
							onClick={onToggleCollapse}
							color="panel.textMuted"
							_hover={{ color: "panel.text", bg: "panel.elevated" }}
						/>
					)}
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
					<VStack align="stretch" spacing={1.5} py={1}>
						{navEntries.map((entry) => {
							if (!entry.visible) return null;

							if (entry.type === "direct") {
								const isCurrent =
									location.pathname === entry.url ||
									(entry.url !== "/" && location.pathname.startsWith(entry.url));
								const IconEl = entry.icon;

								const btnContent = (
									<Flex
										align="center"
										justify={collapsed ? "center" : "space-between"}
										w="full"
										h="38px"
										px={collapsed ? 0 : 3}
										borderRadius="10px"
										bg={isCurrent ? activeItemBg : "transparent"}
										color={isCurrent ? activeItemColor : normalItemColor}
										fontWeight={isCurrent ? "700" : "600"}
										fontSize="13px"
										position="relative"
										cursor="pointer"
										transition="all 0.2s cubic-bezier(0.16, 1, 0.3, 1)"
										borderInlineStartWidth={!collapsed && isCurrent ? "3px" : "0px"}
										borderInlineStartColor="var(--rb-panel-accent)"
										_hover={{
											bg: isCurrent ? activeItemBg : hoverItemBg,
											color: isCurrent ? activeItemColor : "panel.text",
										}}
									>
										<HStack spacing={2.5} align="center">
											<Box as="span" display="inline-flex" alignItems="center" justifyContent="center">
												<IconEl />
											</Box>
											{!collapsed && <Text noOfLines={1}>{entry.title}</Text>}
										</HStack>

										{!collapsed && entry.badge && (
											<Box
												w="6px"
												h="6px"
												borderRadius="full"
												bg="var(--rb-panel-accent)"
												boxShadow="0 0 6px var(--rb-panel-accent)"
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
												borderRadius="10px"
												bg={isGroupActive ? activeItemBg : "transparent"}
												color={isGroupActive ? activeItemColor : normalItemColor}
												cursor="pointer"
												transition="all 0.2s ease"
												_hover={{ bg: hoverItemBg, color: "panel.text" }}
											>
												<GroupIcon />
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
																	color={isSubActive ? activeItemColor : normalItemColor}
																	_hover={{ bg: hoverItemBg, color: "panel.text" }}
																>
																	<SubIcon />
																	<Text noOfLines={1}>{sub.title}</Text>
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
										justify="space-between"
										w="full"
										h="38px"
										px={3}
										borderRadius="10px"
										bg={isGroupActive && !isOpen ? activeItemBg : "transparent"}
										color={isGroupActive ? activeItemColor : normalItemColor}
										fontWeight={isGroupActive ? "700" : "600"}
										fontSize="13px"
										cursor="pointer"
										transition="all 0.2s cubic-bezier(0.16, 1, 0.3, 1)"
										onClick={() => handleGroupClick(entry)}
										_hover={{
											bg: hoverItemBg,
											color: "panel.text",
										}}
									>
										<HStack spacing={2.5} align="center">
											<Box as="span" display="inline-flex" alignItems="center" justifyContent="center">
												<GroupIcon />
											</Box>
											<Text noOfLines={1}>{entry.title}</Text>
										</HStack>

										<Icon
											as={ChevronDownIcon}
											w="14px"
											h="14px"
											color="panel.textMuted"
											transform={isOpen ? "rotate(180deg)" : "rotate(0deg)"}
											transition="transform 0.24s cubic-bezier(0.16, 1, 0.3, 1)"
										/>
									</Flex>

									<AnimatePresence initial={false}>
										{isOpen && (
											<motion.div
												initial={{ opacity: 0, height: 0 }}
												animate={{ opacity: 1, height: "auto" }}
												exit={{ opacity: 0, height: 0 }}
												transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
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
																		color={isSubActive ? activeItemColor : normalItemColor}
																		fontWeight={isSubActive ? "700" : "500"}
																		fontSize="12px"
																		cursor="pointer"
																		transition="all 0.18s ease"
																		_hover={{
																			bg: isSubActive ? activeItemBg : hoverItemBg,
																			color: isSubActive ? activeItemColor : "panel.text",
																		}}
																	>
																		<HStack spacing={2} align="center">
																			<Box
																				as="span"
																				display="inline-flex"
																				alignItems="center"
																				justifyContent="center"
																				opacity={0.8}
																			>
																				<SubIcon />
																			</Box>
																			<Text noOfLines={1}>{sub.title}</Text>
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

				{getUserIsSuccess && userData.username && (
					<Box pt={2} mt={1} borderTopWidth="1px" borderColor="panel.border">
						{!collapsed ? (
							<Flex
								align="center"
								justify="space-between"
								p={2}
								borderRadius="12px"
								bg="panel.elevated"
							>
								<HStack spacing={2.5} minW={0}>
									<Avatar
										size="xs"
										name={userData.username}
										bg="var(--rb-panel-accent)"
										color="white"
									/>
									<VStack align="flex-start" spacing={0} minW={0}>
										<Text fontSize="12px" fontWeight="700" color="panel.text" isTruncated>
											{userData.username}
										</Text>
										<Text fontSize="10px" color="panel.textMuted" isTruncated>
											{roleLabel}
										</Text>
									</VStack>
								</HStack>
								<IconButton
									size="xs"
									variant="ghost"
									borderRadius="full"
									aria-label="Logout"
									icon={<ArrowRightOnRectangleIcon width={15} height={15} />}
									onClick={handleLogout}
									color="panel.textMuted"
									_hover={{ color: "red.400", bg: "rgba(239, 68, 68, 0.1)" }}
								/>
							</Flex>
						) : (
							<Tooltip
								label={`${userData.username} (${roleLabel})`}
								placement={isRTL ? "left" : "right"}
								hasArrow
							>
								<Flex justify="center" py={1}>
									<Avatar
										size="xs"
										name={userData.username}
										bg="var(--rb-panel-accent)"
										color="white"
										cursor="pointer"
										onClick={() => navigate("/myaccount")}
									/>
								</Flex>
							</Tooltip>
						)}
					</Box>
				)}
			</Flex>
		</Box>
	);
};