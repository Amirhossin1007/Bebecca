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

type GroupNavItem = {
	type: "group";
	id: string;
	title: string;
	icon: ElementType;
	subItems: GroupSubItem[];
	visible: boolean;
};

type NavEntry = DirectNavItem | GroupNavItem;

type NavSection = {
	id: string;
	labelKey?: string;
	entries: NavEntry[];
};

export const AppSidebar: FC<AppSidebarProps> = ({
	collapsed,
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
	const canViewRecentActions =
		isFullAccess ||
		(userData.role === AdminRole.Sudo &&
			Boolean(userData.permissions?.sudo?.[AdminSudoScope.Xray]));
	const canManagePlaceholders =
		isFullAccess ||
		(userData.role === AdminRole.Sudo &&
			Boolean(userData.permissions?.sudo?.[AdminSudoScope.Subscriptions])) ||
		Boolean(baseSelf.self_placeholders);

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
				return;
			}
			const seenKey = getTutorialSeenKey(langKey);
			const seenVersion = window.localStorage.getItem(seenKey);
			if (seenVersion === null) {
				window.localStorage.setItem(seenKey, version);
			}
		} catch {
			return;
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
				id: "main",
				entries: [
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
				id: "users",
				labelKey: "sidebar.groups.userHub",
				entries: [
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
				],
			},
			{
				id: "traffic",
				labelKey: "sidebar.groups.traffic",
				entries: [
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
				id: "infrastructure",
				labelKey: "sidebar.groups.infrastructure",
				entries: [
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
						visible: Boolean(sectionAccess?.[AdminSection.Nodes]),
					},
				],
			},
			{
				id: "observability",
				labelKey: "sidebar.groups.observability",
				entries: [
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
				],
			},
			{
				id: "system",
				labelKey: "sidebar.groups.system",
				entries: [
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
						],
					},
					{
						type: "group",
						id: "docs",
						title: t("sidebar.groups.docs"),
						icon: TutorialIconStyled,
						visible: true,
						subItems: [
							{
								id: "api_docs",
								title: t("apiDocs.menu"),
								url: "/api-docs",
								icon: ApiDocsIconStyled,
								visible: isPrivilegedAdmin,
							},
							{
								id: "tutorials",
								title: t("tutorials.menu"),
								url: tutorialsUrl,
								icon: TutorialIconStyled,
								visible: true,
							},
						],
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
			canViewServicesSection,
			sectionAccess,
			canViewRecentActions,
			isPrivilegedAdmin,
			canManagePlaceholders,
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
		if (!isCurrentlyOpen) {
			const firstVisible = group.subItems.find((sub) => sub.visible);
			if (firstVisible) {
				handleNavigate(firstVisible.url);
			}
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
					{!collapsed ? (
						<HStack spacing={2.5} align="center" cursor="pointer" onClick={() => navigate("/")}>
							<LogoIcon
								src={logoUrl}
								alt="Rebecca"
								style={{
									filter: colorMode === "dark" ? "brightness(0) invert(1)" : "brightness(0)",
								}}
							/>
							<Text
								fontSize="18px"
								fontWeight="700"
								lineHeight="26px"
								letterSpacing="-0.02em"
								color="panel.text"
							>
								Rebecca
							</Text>
						</HStack>
					) : (
						<Tooltip label="Rebecca" placement={isRTL ? "left" : "right"} hasArrow>
							<Box cursor="pointer" onClick={() => navigate("/")}>
								<LogoIcon
									src={logoUrl}
									alt="Rebecca"
									style={{
										filter: colorMode === "dark" ? "brightness(0) invert(1)" : "brightness(0)",
									}}
								/>
							</Box>
						</Tooltip>
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
						{navSections.map((section, sectionIdx) => {
							const visibleEntries = section.entries.filter((e) => e.visible);
							if (visibleEntries.length === 0) return null;
							return (
								<Box key={section.id}>
									{sectionIdx > 0 && (
										<Box
											h="1px"
											bg="panel.border"
											opacity={0.6}
											mx={2}
											mb={2}
											mt={sectionIdx === 1 ? 2 : 3}
										/>
									)}
									{!collapsed && section.labelKey && sectionIdx > 0 && (
										<Text
											fontSize="10px"
											fontWeight="700"
											color="panel.textMuted"
											textTransform="uppercase"
											letterSpacing="0.06em"
											px={3.5}
											pb={1.5}
											opacity={0.75}
										>
											{t(section.labelKey)}
										</Text>
									)}
										<VStack align="stretch" spacing={1}>
												{visibleEntries.map((entry) => {

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
										color={isCurrent ? "panel.text" : normalItemColor}
										fontWeight={isCurrent ? "700" : "600"}
										fontSize="13px"
										position="relative"
										cursor="pointer"
										transition="all 0.2s cubic-bezier(0.16, 1, 0.3, 1)"
										borderInlineStartWidth={!collapsed && isCurrent ? "3px" : "0px"}
										borderInlineStartColor="var(--rb-panel-accent)"
										_hover={{
											md: {
												bg: isCurrent ? activeItemBg : hoverItemBg,
												color: "panel.text",
											},
										}}
									>
										<HStack spacing={2.5} align="center">
											<Box
												as="span"
												display="inline-flex"
												alignItems="center"
												justifyContent="center"
												color={isCurrent ? activeItemColor : "inherit"}
											>
												<IconEl />
											</Box>
											{!collapsed && (
												<Text noOfLines={1} color={isCurrent ? "panel.text" : normalItemColor}>
													{entry.title}
												</Text>
											)}
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
												_hover={{ md: { bg: hoverItemBg, color: "panel.text" } }}
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
										justify="space-between"
										w="full"
										h="38px"
										px={3}
										borderRadius="10px"
										bg={isGroupActive && !isOpen ? activeItemBg : "transparent"}
										color={isGroupActive ? "panel.text" : normalItemColor}
										fontWeight={isGroupActive ? "700" : "600"}
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
										<HStack spacing={2.5} align="center">
											<Box
												as="span"
												display="inline-flex"
												alignItems="center"
												justifyContent="center"
												color={isGroupActive ? activeItemColor : "inherit"}
											>
												<GroupIcon />
											</Box>
											<Text noOfLines={1} color={isGroupActive ? "panel.text" : normalItemColor}>
												{entry.title}
											</Text>
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
												})
												}
												</VStack>
												</Box>
												);
												})
												}
												</VStack>
												</Box>
												</Flex>
												</Box>
												);
												};