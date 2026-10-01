import {
	Box,
	Button,
	chakra,
	Drawer,
	DrawerBody,
	DrawerContent,
	DrawerOverlay,
	Flex,
	HStack,
	IconButton,
	Menu,
	MenuButton,
	MenuItem,
	MenuList,
	type PlacementWithLogical,
	Popover,
	PopoverBody,
	PopoverContent,
	PopoverTrigger,
	Portal,
	SimpleGrid,
	Text,
	useBreakpointValue,
	useColorModeValue,
	useDisclosure,
	VStack,
} from "@chakra-ui/react";
import {
	ArrowLeftOnRectangleIcon,
	ArrowsRightLeftIcon,
	ArrowUpOnSquareIcon,
	BookOpenIcon,
	BriefcaseIcon,
	CheckIcon,
	ChevronDownIcon,
	CircleStackIcon,
	ClockIcon,
	CodeBracketSquareIcon,
	Cog6ToothIcon,
	Cog8ToothIcon,
	CommandLineIcon,
	DocumentDuplicateIcon,
	EyeIcon,
	HomeIcon as HeroHomeIcon,
	LanguageIcon,
	LinkIcon,
	ServerStackIcon,
	Squares2X2Icon,
	UserCircleIcon,
	UserGroupIcon,
	WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import { AnimatePresence, motion } from "framer-motion";
import useGetUser from "hooks/useGetUser";
import {
	type ElementType,
	type FC,
	type MouseEvent as ReactMouseEvent,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import ReactCountryFlag from "react-country-flag";
import { useTranslation } from "react-i18next";
import { useQuery } from "react-query";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { logout as logoutSession } from "service/auth";
import { getSponsors, type SponsorAsset } from "service/sponsors";
import { AdminRole, AdminSection, AdminSudoScope } from "types/Admin";
import { clearClientSession } from "utils/session";
import { ReactComponent as ImperialIranFlag } from "../assets/imperial-iran-flag.svg";
import { AppSidebar } from "./AppSidebar";
import { HeaderCalendar } from "./HeaderCalendar";
import { SponsorCarousel } from "./SponsorCarousel";
import ThemeSelector from "./ThemeSelector";

const iconProps = {
	baseStyle: {
		w: 4,
		h: 4,
	},
};

const LogoutIcon = chakra(ArrowLeftOnRectangleIcon, iconProps);
const LanguageIconStyled = chakra(LanguageIcon, iconProps);
const DocsIcon = chakra(CodeBracketSquareIcon, iconProps);
const PHPMyAdminIcon = chakra(CircleStackIcon, iconProps);
const ExternalAppsIcon = chakra(CommandLineIcon, iconProps);
const PlaceholderIcon = chakra(DocumentDuplicateIcon, iconProps);
const UserIcon = chakra(UserCircleIcon, iconProps);
const HomeIcon = chakra(HeroHomeIcon, iconProps);
const UsersIcon = chakra(UserGroupIcon, iconProps);
const AdminsIcon = chakra(BriefcaseIcon, iconProps);
const SettingsIcon = chakra(Cog6ToothIcon, iconProps);
const MasterSettingsIcon = chakra(Cog8ToothIcon, iconProps);
const XraySettingsIcon = chakra(WrenchScrewdriverIcon, iconProps);
const ServicesIcon = chakra(Squares2X2Icon, iconProps);
const HostsIcon = chakra(LinkIcon, iconProps);
const HAProxyIcon = chakra(ArrowsRightLeftIcon, iconProps);
const NodesIcon = chakra(ServerStackIcon, iconProps);
const InsightsIcon = chakra(EyeIcon, iconProps);
const RecentActionsIcon = chakra(ClockIcon, iconProps);
const ShareIcon = chakra(ArrowUpOnSquareIcon, iconProps);
const TutorialIcon = chakra(BookOpenIcon, iconProps);
const ChevronDownIconStyled = chakra(ChevronDownIcon, {
	baseStyle: { w: 3.5, h: 3.5 },
});

const AnimatedHamburger: FC<{ isOpen: boolean; isRTL: boolean }> = ({
	isOpen,
	isRTL,
}) => {
	const x1Mid = isRTL ? (isOpen ? 7 : 2) : 2;
	const x2Mid = isRTL ? 14 : isOpen ? 9 : 14;
	const x1Bot = isRTL ? (isOpen ? 4.5 : 2) : 2;
	const x2Bot = isRTL ? 14 : isOpen ? 11.5 : 14;

	return (
		<Box
			as="svg"
			width="15"
			height="15"
			viewBox="0 0 16 16"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.25"
			strokeLinecap="round"
			display="block"
		>
			<line x1="2" y1="3.5" x2="14" y2="3.5" />
			<motion.line
				x1={x1Mid}
				y1="8"
				x2={x2Mid}
				y2="8"
				animate={{ x1: x1Mid, x2: x2Mid }}
				transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
			/>
			<motion.line
				x1={x1Bot}
				y1="12.5"
				x2={x2Bot}
				y2="12.5"
				animate={{ x1: x1Bot, x2: x2Bot }}
				transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
			/>
		</Box>
	);
};

type SettingsMenuItem = {
	key: string;
	label: string;
	to: string;
	icon?: ElementType;
};

type BottomNavItem = {
	key: string;
	label: string;
	to?: string;
	kind?: "menu" | "link";
};

export function AppLayout() {
	const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
	const isMobile = useBreakpointValue({ base: true, md: false });
	const sidebarDrawer = useDisclosure();
	const languageMenu = useDisclosure();
	const userMenu = useDisclosure();
	const accountMenu = useDisclosure();
	const settingsMenu = useDisclosure();
	const { t, i18n } = useTranslation();
	const { userData, getUserIsSuccess } = useGetUser();
	const canSeeSponsors =
		getUserIsSuccess &&
		(userData.role === AdminRole.FullAccess ||
			userData.role === AdminRole.Sudo);
	const sponsorsQuery = useQuery("sponsors", getSponsors, {
		staleTime: 5 * 60 * 1000,
		cacheTime: 30 * 60 * 1000,
		retry: false,
		enabled: canSeeSponsors,
	});
	const sponsorData = canSeeSponsors ? sponsorsQuery.data : undefined;
	const sponsorHeaderItems = (sponsorData?.header ?? [])
		.slice(0, 3)
		.map((asset: SponsorAsset) => ({
			id: asset.id,
			src: asset.image_url,
			alt: asset.alt || asset.label || "Sponsor",
			href: asset.target_url,
			label: asset.label,
			isSponsor: true,
		}));
	const sponsorHeaderMobileItems = (sponsorData?.header_mobile ?? [])
		.slice(0, 3)
		.map((asset: SponsorAsset) => ({
			id: asset.id,
			src: asset.image_url,
			alt: asset.alt || asset.label || "Sponsor",
			href: asset.target_url,
			label: asset.label,
			isSponsor: true,
		}));
	const sponsorSidebarLogoItems = (sponsorData?.sidebar_logo ?? []).slice(0, 5);
	const sponsorSidebarBanners = (sponsorData?.sidebar ?? []).slice(0, 5);
	const mobileHeaderItems =
		sponsorHeaderMobileItems.length > 0
			? sponsorHeaderMobileItems
			: sponsorHeaderItems;
	const navigate = useNavigate();
	const location = useLocation();
	const [activeLocationHash, setActiveLocationHash] = useState(
		() => window.location.hash,
	);
	const isRTL = i18n.dir(i18n.language) === "rtl";
	const tutorialsUrl = "/tutorials";
	const sectionAccess = userData.permissions?.sections;
	const userMenuContentRef = useRef<HTMLDivElement | null>(null);
	const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
	const contentRef = useRef<HTMLDivElement | null>(null);
	const [showIosPrompt, setShowIosPrompt] = useState(false);
	const tabContentRefs = useRef<Record<string, HTMLButtonElement | null>>({});
	const [previewTabKey, setPreviewTabKey] = useState<string | null>(null);
	const previewTabKeyRef = useRef<string | null>(null);
	const headerRef = useRef<HTMLDivElement | null>(null);
	const [calendarCompact, setCalendarCompact] = useState(false);
	const [mobileDockOpenGroups, setMobileDockOpenGroups] = useState<
		Record<string, boolean>
	>({
		core_routing: false,
		system_tools: false,
		observability: false,
	});

	useEffect(() => {
		const dir = i18n.dir(i18n.language);
		document.documentElement.dir = dir;
		document.documentElement.lang = i18n.language;
	}, [i18n.language, i18n]);

	const languagePlacement =
		useBreakpointValue<PlacementWithLogical>({
			base: "bottom-start",
			md: isRTL ? "left-start" : "right-start",
		}) ?? "bottom-start";

	const menuBg = useColorModeValue("panel.surface", "panel.surface");
	const menuBorder = useColorModeValue("panel.border", "panel.border");
	const dockBg = useColorModeValue("panel.surface", "panel.surface");
	const dockBorder = useColorModeValue("panel.border", "panel.border");
	const menuShadow = useColorModeValue(
		"inset 0 1px 0 0 rgba(0, 0, 0, 0.04)",
		"inset 0 1px 0 0 rgba(255, 255, 255, 0.08)",
	);
	const dockShadow = menuShadow;
	const dockInactiveText = useColorModeValue("gray.700", "gray.300");
	const dockInactiveIcon = useColorModeValue("gray.600", "gray.400");
	const shellBorder = useColorModeValue("panel.border", "panel.border");
	const shellHeaderBg = useColorModeValue("panel.surface", "panel.surface");
	const shellHeaderShadow = menuShadow;
	const shellMainBg = useColorModeValue("panel.main", "panel.main");
	const headerButtonBg = useColorModeValue("panel.elevated", "panel.elevated");
	const headerButtonHoverBg = useColorModeValue(
		"panel.borderStrong",
		"panel.borderStrong",
	);

	useEffect(() => {
		const syncHash = () => setActiveLocationHash(window.location.hash);
		setActiveLocationHash(location.hash);
		window.addEventListener("hashchange", syncHash);
		return () => window.removeEventListener("hashchange", syncHash);
	}, [location.hash]);

	const setPreviewTabKeySafe = (value: string | null) => {
		previewTabKeyRef.current = value;
		setPreviewTabKey(value);
	};

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

	const languageItems = [
		{ code: "en", label: "English", flag: "US" },
		{ code: "fa", label: "پارسی", flag: "IR" },
		{ code: "zh-cn", label: "中文", flag: "CN" },
		{ code: "ru", label: "Русский", flag: "RU" },
	];

	const isPrivilegedAdmin =
		userData.role === AdminRole.FullAccess || userData.role === AdminRole.Sudo;
	const canViewRecentActions =
		userData.role === AdminRole.FullAccess ||
		(userData.role === AdminRole.Sudo &&
			Boolean(userData.permissions?.sudo?.[AdminSudoScope.Xray]));
	const canManagePlaceholders =
		userData.role === AdminRole.FullAccess ||
		(userData.role === AdminRole.Sudo &&
			Boolean(userData.permissions?.sudo?.[AdminSudoScope.Subscriptions])) ||
		Boolean(userData.permissions?.self_permissions?.self_placeholders);

	const settingsMenuItems = useMemo(() => {
		const items: Array<SettingsMenuItem | null> = [
			isPrivilegedAdmin && sectionAccess?.[AdminSection.Services]
				? {
						key: "services",
						label: t("services.title"),
						to: "/services",
						icon: ServicesIcon,
					}
				: null,
			isPrivilegedAdmin && sectionAccess?.[AdminSection.Hosts]
				? {
						key: "hosts",
						label: t("header.hostSettings"),
						to: "/hosts",
						icon: HostsIcon,
					}
				: null,
			isPrivilegedAdmin && sectionAccess?.[AdminSection.Nodes]
				? {
						key: "node-settings",
						label: t("header.nodeSettings"),
						to: "/node-settings",
						icon: NodesIcon,
					}
				: null,
			isPrivilegedAdmin && sectionAccess?.[AdminSection.Integrations]
				? {
						key: "settings",
						label: t("header.integrationSettings"),
						to: "/settings",
						icon: MasterSettingsIcon,
					}
				: null,
			isPrivilegedAdmin && sectionAccess?.[AdminSection.Xray]
				? {
						key: "xray-settings",
						label: t("header.xraySettings"),
						to: "/xray-settings",
						icon: XraySettingsIcon,
					}
				: null,
			isPrivilegedAdmin
				? {
						key: "haproxy",
						label: t("haproxy.title"),
						to: "/haproxy",
						icon: HAProxyIcon,
					}
				: null,
			isPrivilegedAdmin && sectionAccess?.[AdminSection.Xray]
				? {
						key: "access-insights",
						label: t("header.accessInsights"),
						to: "/access-insights",
						icon: InsightsIcon,
					}
				: null,
			canViewRecentActions
				? {
						key: "recent-actions",
						label: t("recentActions.title"),
						to: "/recent-actions",
						icon: RecentActionsIcon,
					}
				: null,
			isPrivilegedAdmin
				? {
						key: "phpmyadmin",
						label: t("phpmyadmin.menu"),
						to: "/phpmyadmin",
						icon: PHPMyAdminIcon,
					}
				: null,
			isPrivilegedAdmin
				? {
						key: "external-apps",
						label: t("externalApps.menu"),
						to: "/external-apps",
						icon: ExternalAppsIcon,
					}
				: null,
			isPrivilegedAdmin
				? {
						key: "api-docs",
						label: t("apiDocs.menu"),
						to: "/api-docs",
						icon: DocsIcon,
					}
				: null,
			canManagePlaceholders
				? {
						key: "placeholders",
						label: isPrivilegedAdmin
							? t("placeholders.menu")
							: t("placeholders.settingsMenu"),
						to: "/placeholders",
						icon: PlaceholderIcon,
					}
				: null,
			{
				key: "tutorials",
				label: t("tutorials.menu"),
				to: tutorialsUrl,
				icon: TutorialIcon,
			},
		];
		return items.filter(Boolean) as SettingsMenuItem[];
	}, [
		canManagePlaceholders,
		canViewRecentActions,
		isPrivilegedAdmin,
		sectionAccess,
		t,
	]);

	const mobileDockSections = useMemo(
		() => [
			{
				id: "sec_infrastructure",
				title: t("sidebar.sections.infrastructure"),
				items: [
					isPrivilegedAdmin && sectionAccess?.[AdminSection.Nodes]
						? {
								type: "direct" as const,
								key: "node-settings",
								label: t("header.nodeSettings"),
								to: "/node-settings",
								icon: NodesIcon,
							}
						: null,
					isPrivilegedAdmin && sectionAccess?.[AdminSection.Hosts]
						? {
								type: "direct" as const,
								key: "hosts",
								label: t("header.hostSettings"),
								to: "/hosts",
								icon: HostsIcon,
							}
						: null,
					isPrivilegedAdmin && sectionAccess?.[AdminSection.Services]
						? {
								type: "direct" as const,
								key: "services",
								label: t("services.title"),
								to: "/services",
								icon: ServicesIcon,
							}
						: null,
				].filter(Boolean) as Array<{
					type: "direct";
					key: string;
					label: string;
					to: string;
					icon: ElementType;
				}>,
			},
			{
				id: "sec_system",
				title: t("sidebar.sections.system"),
				items: [
					{
						type: "group" as const,
						id: "core_routing",
						title: t("sidebar.groups.coreRouting"),
						icon: XraySettingsIcon,
						subItems: [
							sectionAccess?.[AdminSection.Xray]
								? {
										id: "xray-settings",
										title: t("header.xraySettings"),
										to: "/xray-settings",
										icon: XraySettingsIcon,
									}
								: null,
							isPrivilegedAdmin
								? {
										id: "haproxy",
										title: t("haproxy.title"),
										to: "/haproxy",
										icon: HAProxyIcon,
									}
								: null,
						].filter(Boolean) as Array<{
							id: string;
							title: string;
							to: string;
							icon: ElementType;
						}>,
					},
					{
						type: "group" as const,
						id: "system_tools",
						title: t("sidebar.groups.system"),
						icon: MasterSettingsIcon,
						subItems: [
							sectionAccess?.[AdminSection.Integrations]
								? {
										id: "settings",
										title: t("header.integrationSettings"),
										to: "/settings",
										icon: MasterSettingsIcon,
									}
								: null,
							canManagePlaceholders
								? {
										id: "placeholders",
										title: isPrivilegedAdmin
											? t("placeholders.menu")
											: t("placeholders.settingsMenu"),
										to: "/placeholders",
										icon: PlaceholderIcon,
									}
								: null,
							isPrivilegedAdmin
								? {
										id: "phpmyadmin",
										title: t("phpmyadmin.menu"),
										to: "/phpmyadmin",
										icon: PHPMyAdminIcon,
									}
								: null,
							isPrivilegedAdmin
								? {
										id: "external-apps",
										title: t("externalApps.menu"),
										to: "/external-apps",
										icon: ExternalAppsIcon,
									}
								: null,
						].filter(Boolean) as Array<{
							id: string;
							title: string;
							to: string;
							icon: ElementType;
						}>,
					},
					{
						type: "group" as const,
						id: "observability",
						title: t("sidebar.groups.observability"),
						icon: InsightsIcon,
						subItems: [
							sectionAccess?.[AdminSection.Xray]
								? {
										id: "xray-logs",
										title: t("pages.xray.logs"),
										to: "/xray-logs",
										icon: InsightsIcon,
									}
								: null,
							sectionAccess?.[AdminSection.Xray]
								? {
										id: "access-insights",
										title: t("header.accessInsights"),
										to: "/access-insights",
										icon: InsightsIcon,
									}
								: null,
							canViewRecentActions
								? {
										id: "recent-actions",
										title: t("recentActions.title"),
										to: "/recent-actions",
										icon: RecentActionsIcon,
									}
								: null,
						].filter(Boolean) as Array<{
							id: string;
							title: string;
							to: string;
							icon: ElementType;
						}>,
					},
				],
			},
			{
				id: "sec_docs",
				title: t("sidebar.sections.docs"),
				items: [
					{
						type: "direct" as const,
						key: "tutorials",
						label: t("sidebar.tutorialsAndFaq"),
						to: tutorialsUrl,
						icon: TutorialIcon,
					},
					isPrivilegedAdmin
						? {
								type: "direct" as const,
								key: "api-docs",
								label: t("apiDocs.menu"),
								to: "/api-docs",
								icon: DocsIcon,
							}
						: null,
				].filter(Boolean) as Array<{
					type: "direct";
					key: string;
					label: string;
					to: string;
					icon: ElementType;
				}>,
			},
		],
		[
			t,
			isPrivilegedAdmin,
			sectionAccess,
			canManagePlaceholders,
			canViewRecentActions,
		],
	);

	const hasSettingsMenu = settingsMenuItems.length > 0;

	const changeLanguage = async (lang: string) => {
		await i18n.changeLanguage(lang);
		const dir = i18n.dir(lang);
		document.documentElement.dir = dir;
		document.documentElement.lang = lang;
	};

	const closeUserMenu = () => {
		userMenu.onClose();
		languageMenu.onClose();
	};

	const handleUserMenuClose = () => {
		if (isThemeModalOpen) return;
		closeUserMenu();
	};

	const handleThemeModalOpen = () => setIsThemeModalOpen(true);
	const handleThemeModalClose = () => setIsThemeModalOpen(false);

	useEffect(() => {
		if (!isMobile) return;
		const ua = window.navigator.userAgent || "";
		const isIOS = /iphone|ipad|ipod/i.test(ua);
		const isStandalone =
			"standalone" in window.navigator
				? Boolean(window.navigator.standalone)
				: window.matchMedia("(display-mode: standalone)").matches;
		const hasShown = localStorage.getItem("ios-pwa-tip-shown") === "1";
		if (isIOS && !isStandalone && !hasShown) {
			setShowIosPrompt(true);
			localStorage.setItem("ios-pwa-tip-shown", "1");
		}
	}, [isMobile]);

	useEffect(() => {
		const node = contentRef.current;
		if (!node || !isMobile) return;
		let startX = 0;
		let startY = 0;
		let tracking = false;
		const edgeSize = 24;
		const minSwipe = 60;

		const isFormField = (target: EventTarget | null) => {
			if (!(target instanceof HTMLElement)) return false;
			const tag = target.tagName.toLowerCase();
			return (
				tag === "input" ||
				tag === "textarea" ||
				tag === "select" ||
				target.isContentEditable
			);
		};

		const handleTouchStart = (event: TouchEvent) => {
			if (!isMobile || sidebarDrawer.isOpen) return;
			if (event.touches.length !== 1) return;
			if (isFormField(event.target)) return;
			const touch = event.touches[0];
			startX = touch.clientX;
			startY = touch.clientY;
			const isEdgeStart = isRTL
				? window.innerWidth - startX <= edgeSize
				: startX <= edgeSize;
			tracking = isEdgeStart;
		};

		const handleTouchMove = (event: TouchEvent) => {
			if (!tracking) return;
			const touch = event.touches[0];
			const dx = touch.clientX - startX;
			const dy = touch.clientY - startY;
			if (Math.abs(dy) > 20 && Math.abs(dy) > Math.abs(dx)) {
				tracking = false;
				return;
			}
			const shouldOpen = isRTL ? dx < -minSwipe : dx > minSwipe;
			if (shouldOpen) {
				tracking = false;
				sidebarDrawer.onOpen();
			}
		};

		const handleTouchEnd = () => {
			tracking = false;
		};

		node.addEventListener("touchstart", handleTouchStart, { passive: true });
		node.addEventListener("touchmove", handleTouchMove, { passive: true });
		node.addEventListener("touchend", handleTouchEnd);
		node.addEventListener("touchcancel", handleTouchEnd);
		return () => {
			node.removeEventListener("touchstart", handleTouchStart);
			node.removeEventListener("touchmove", handleTouchMove);
			node.removeEventListener("touchend", handleTouchEnd);
			node.removeEventListener("touchcancel", handleTouchEnd);
		};
	}, [isMobile, isRTL, sidebarDrawer]);

	const bottomNavItems = useMemo<BottomNavItem[]>(() => {
		const items: BottomNavItem[] = [];
		const canSeeAdmins = Boolean(sectionAccess?.[AdminSection.Admins]);
		items.push({ key: "users", label: t("users"), to: "/users" });
		if (canSeeAdmins) {
			items.push({
				key: "admins",
				label: t("admins"),
				to: "/admins",
			});
		}
		items.push({
			key: "dashboard",
			label: t("dashboard"),
			to: "/",
		});
		items.push({
			key: "myaccount",
			label: t("myaccount.menu"),
			to: "/myaccount",
		});
		if (hasSettingsMenu) {
			items.push({
				key: "settings",
				label: t("header.settings"),
				kind: "menu",
			});
		}
		return items;
	}, [t, sectionAccess, hasSettingsMenu]);

	const activeSettingsItem = useMemo(
		() =>
			settingsMenuItems.find((item) => {
				if (item.to === "/") return location.pathname === "/";
				return location.pathname.startsWith(item.to);
			}),
		[settingsMenuItems, location.pathname],
	);
	const isSettingsRoute = Boolean(activeSettingsItem);
	const SettingsNavIcon = activeSettingsItem?.icon ?? SettingsIcon;

	const popoverModifiers = useMemo(
		() => [
			{
				name: "preventOverflow",
				options: {
					boundary: "viewport",
					padding: 12,
				},
			},
			{
				name: "flip",
				options: {
					boundary: "viewport",
					padding: 12,
				},
			},
		],
		[],
	);

	const resolveActive = useCallback(
		(item: BottomNavItem) => {
			if (item.key === "settings") return isSettingsRoute;
			if (!item.to) return false;
			if (item.to === "/") return location.pathname === "/";
			return location.pathname.startsWith(item.to);
		},
		[isSettingsRoute, location.pathname],
	);

	const activeTabKey = useMemo(() => {
		const activeItem = bottomNavItems.find((item) => resolveActive(item));
		return activeItem?.key ?? null;
	}, [bottomNavItems, resolveActive]);
	const selectedTabKey = previewTabKey ?? activeTabKey;

	const handleNavClick = (to?: string) => {
		if (!to) {
			return;
		}
		handleSettingsMenuClose();
		handleAccountMenuClose();
		navigate(to);
	};

	const handleAccountMenuClose = () => {
		accountMenu.onClose();
	};

	const handleSettingsMenuClose = () => {
		settingsMenu.onClose();
		if (previewTabKeyRef.current === "settings") {
			setPreviewTabKeySafe(null);
		}
	};

	const openSettingsMenu = () => {
		accountMenu.onClose();
		settingsMenu.onOpen();
		setPreviewTabKeySafe("settings");
	};

	const handleSettingsMenuToggle = () => {
		if (settingsMenu.isOpen) {
			handleSettingsMenuClose();
			return;
		}
		openSettingsMenu();
	};

	const settingsDefaultTabByPath: Record<string, string> = {
		"/settings": "panel",
		"/hosts": "inbounds",
		"/usage": "services",
		"/xray-settings": "basic",
	};
	const breadcrumbItems = useMemo(() => {
		const path = location.pathname;
		let items: { label: string; path?: string }[] = [];

		if (path === "/") {
			items = [{ label: t("dashboard"), path: "/" }];
		} else if (path === "/users") {
			items = [
				{ label: t("dashboard"), path: "/" },
				{ label: t("sidebar.groups.userHub") },
				{ label: t("sidebar.usersList"), path: "/users" },
			];
		} else if (path === "/bulk-actions") {
			items = [
				{ label: t("dashboard"), path: "/" },
				{ label: t("sidebar.groups.userHub") },
				{ label: t("bulkActions.menu"), path: "/bulk-actions" },
			];
		} else if (path === "/admins") {
			items = [
				{ label: t("dashboard"), path: "/" },
				{ label: t("admins"), path: "/admins" },
			];
		} else if (path === "/myaccount") {
			items = [
				{ label: t("dashboard"), path: "/" },
				{ label: t("myaccount.menu"), path: "/myaccount" },
			];
		} else if (path === "/usage") {
			items = [
				{ label: t("dashboard"), path: "/" },
				{ label: t("usage.menu"), path: "/usage" },
			];
		} else if (path === "/hosts") {
			items = [
				{ label: t("dashboard"), path: "/" },
				{ label: t("header.hostSettings"), path: "/hosts" },
			];
		} else if (path === "/services") {
			items = [
				{ label: t("dashboard"), path: "/" },
				{ label: t("services.title"), path: "/services" },
			];
		} else if (path === "/node-settings") {
			items = [
				{ label: t("dashboard"), path: "/" },
				{ label: t("header.nodeSettings"), path: "/node-settings" },
			];
		} else if (path === "/xray-logs") {
			items = [
				{ label: t("dashboard"), path: "/" },
				{ label: t("sidebar.groups.observability") },
				{ label: t("pages.xray.logs"), path: "/xray-logs" },
			];
		} else if (path === "/access-insights") {
			items = [
				{ label: t("dashboard"), path: "/" },
				{ label: t("sidebar.groups.observability") },
				{ label: t("header.accessInsights"), path: "/access-insights" },
			];
		} else if (path === "/recent-actions") {
			items = [
				{ label: t("dashboard"), path: "/" },
				{ label: t("sidebar.groups.observability") },
				{ label: t("recentActions.title"), path: "/recent-actions" },
			];
		} else if (path === "/xray-settings") {
			items = [
				{ label: t("dashboard"), path: "/" },
				{ label: t("sidebar.groups.coreRouting") },
				{ label: t("header.xraySettings"), path: "/xray-settings" },
			];
		} else if (path === "/haproxy") {
			items = [
				{ label: t("dashboard"), path: "/" },
				{ label: t("sidebar.groups.coreRouting") },
				{ label: t("haproxy.title"), path: "/haproxy" },
			];
		} else if (path === "/settings") {
			items = [
				{ label: t("dashboard"), path: "/" },
				{ label: t("sidebar.groups.system") },
				{ label: t("header.integrationSettings"), path: "/settings" },
			];
		} else if (path === "/placeholders") {
			items = [
				{ label: t("dashboard"), path: "/" },
				{ label: t("sidebar.groups.system") },
				{ label: t("placeholders.menu"), path: "/placeholders" },
			];
		} else if (path === "/phpmyadmin") {
			items = [
				{ label: t("dashboard"), path: "/" },
				{ label: t("sidebar.groups.system") },
				{ label: t("phpmyadmin.menu"), path: "/phpmyadmin" },
			];
		} else if (path === "/external-apps") {
			items = [
				{ label: t("dashboard"), path: "/" },
				{ label: t("sidebar.groups.system") },
				{ label: t("externalApps.menu"), path: "/external-apps" },
			];
		} else if (path === "/api-docs") {
			items = [
				{ label: t("dashboard"), path: "/" },
				{ label: t("sidebar.sections.docs") },
				{ label: t("apiDocs.menu"), path: "/api-docs" },
			];
		} else if (path === "/tutorials") {
			items = [
				{ label: t("dashboard"), path: "/" },
				{ label: t("sidebar.sections.docs") },
				{ label: t("sidebar.tutorialsAndFaq"), path: "/tutorials" },
			];
		} else {
			items = [
				{ label: t("dashboard"), path: "/" },
				...path
					.split("/")
					.filter(Boolean)
					.map((part) => ({
						label: part.replace(/[-_]+/g, " "),
					})),
			];
		}

		const rawHash = activeLocationHash.replace(/^#/, "");
		if (rawHash && items.length > 0) {
			const hashKeyBulk = `bulkActions.tabs.${rawHash}`;
			const hashKeySettings = `settings.tabs.${rawHash}`;
			const hashKeyHosts = `hosts.tabs.${rawHash}`;
			let hashLabel = rawHash.replace(/[-_]+/g, " ");

			if (i18n.exists(hashKeyBulk)) {
				hashLabel = t(hashKeyBulk);
			} else if (i18n.exists(hashKeySettings)) {
				hashLabel = t(hashKeySettings);
			} else if (i18n.exists(hashKeyHosts)) {
				hashLabel = t(hashKeyHosts);
			} else if (rawHash === "create") {
				hashLabel = t("common.create", "ایجاد");
			} else if (rawHash === "edit") {
				hashLabel = t("common.edit", "ویرایش");
			} else if (rawHash === "delete") {
				hashLabel = t("common.delete", "حذف");
			}
			items.push({ label: hashLabel });
		}

		return items;
	}, [location.pathname, activeLocationHash, t, i18n]);

	const navigateToSettingsItem = (target: string) => {
		settingsMenu.onClose();
		setPreviewTabKeySafe("settings");
		const defaultTab = settingsDefaultTabByPath[target];
		if (defaultTab) {
			navigate(`${target}#${defaultTab}`);
			return;
		}
		navigate(target);
	};

	useEffect(() => {
		if (previewTabKeyRef.current && activeTabKey === previewTabKeyRef.current) {
			previewTabKeyRef.current = null;
			setPreviewTabKey(null);
		}
	}, [activeTabKey]);

	useEffect(() => {
		const headerEl = headerRef.current;
		if (!headerEl) return;
		const _pathKey = location.pathname + location.hash;
		void _pathKey;
		const checkFit = () => {
			if (!headerRef.current) return;
			const totalWidth = headerRef.current.clientWidth;
			if (totalWidth < 769) {
				setCalendarCompact(true);
				return;
			}
			const hasBanner =
				mobileHeaderItems.length > 0 || sponsorHeaderItems.length > 0;
			const bannerWidth = hasBanner ? (totalWidth >= 1200 ? 300 : 220) : 0;
			const breadcrumbEl = headerRef.current.querySelector<HTMLElement>(
				"[data-header-breadcrumb]",
			);
			const breadcrumbWidth = breadcrumbEl
				? Math.max(breadcrumbEl.scrollWidth, breadcrumbEl.offsetWidth)
				: 80;
			const navButtonWidth = 46;
			const profileWidth = 110;
			const fullCalendarWidth = 200;
			const safetyBuffer = 40;
			const requiredWidth =
				navButtonWidth +
				breadcrumbWidth +
				bannerWidth +
				profileWidth +
				fullCalendarWidth +
				safetyBuffer;
			setCalendarCompact(totalWidth < requiredWidth);
		};
		const timer = setTimeout(checkFit, 20);
		const ro = new ResizeObserver(checkFit);
		ro.observe(headerEl);
		return () => {
			clearTimeout(timer);
			ro.disconnect();
		};
	}, [
		location.pathname,
		location.hash,
		mobileHeaderItems.length,
		sponsorHeaderItems.length,
	]);

	return (
		<>
			<Box display="none" aria-hidden="true">
				<ThemeSelector minimal trigger="icon" />
			</Box>
			<Flex
				minH="100vh"
				maxH="100vh"
				overflow="hidden"
				direction={isRTL ? "row-reverse" : "row"}
				dir={isRTL ? "rtl" : "ltr"}
				bg="panel.app"
				sx={{
					"--rb-sidebar-offset": isMobile
						? "0px"
						: sidebarCollapsed
							? "88px"
							: "260px",
				}}
			>
				{!isMobile ? (
					<AppSidebar
						collapsed={sidebarCollapsed}
						sponsors={sponsorSidebarLogoItems}
						sidebarBanners={sponsorSidebarBanners}
						onRequestExpand={() => setSidebarCollapsed(false)}
					/>
				) : null}

				<Flex
					ref={contentRef}
					flex="1"
					direction="column"
					minW="0"
					overflow="hidden"
					ml={isMobile || isRTL ? "0" : sidebarCollapsed ? "88px" : "260px"}
					mr={isMobile || !isRTL ? "0" : sidebarCollapsed ? "88px" : "260px"}
					transition="margin 0.22s cubic-bezier(0.16, 1, 0.3, 1)"
					sx={{
						willChange: isMobile ? undefined : "margin",
					}}
				>
					<Box
						ref={headerRef}
						as="header"
						h="52px"
						minH="52px"
						borderWidth="1px"
						borderColor={shellBorder}
						borderRadius="20px"
						bg={shellHeaderBg}
						boxShadow={shellHeaderShadow}
						overflow="hidden"
						mt="3"
						mx={{ base: "3", md: "4" }}
						display="flex"
						alignItems="center"
						px={{ base: 3, md: 5 }}
						justifyContent="space-between"
						flexShrink={0}
						position="sticky"
						top="3"
						zIndex={100}
						userSelect="none"
						gap={3}
						dir={isRTL ? "rtl" : "ltr"}
					>
						<HStack
							spacing={2.5}
							alignItems="center"
							flex="1"
							minW="0"
							h="full"
						>
							<IconButton
								size="sm"
								w="34px"
								h="34px"
								minW="34px"
								variant="ghost"
								borderRadius={{ base: "full", md: "12px" }}
								borderWidth="1px"
								borderColor={shellBorder}
								aria-label={t("a11y.toggleSidebar")}
								onClick={() => {
									if (isMobile) sidebarDrawer.onOpen();
									else setSidebarCollapsed(!sidebarCollapsed);
								}}
								icon={
									<AnimatedHamburger
										isOpen={isMobile ? sidebarDrawer.isOpen : !sidebarCollapsed}
										isRTL={isRTL}
									/>
								}
								flexShrink={0}
								bg={headerButtonBg}
								color="panel.textSecondary"
								_hover={{
									md: {
										bg: headerButtonHoverBg,
										borderColor: "panel.borderStrong",
										color: "panel.text",
									},
								}}
								_active={{ transform: "scale(0.95)" }}
								transition="all 0.16s cubic-bezier(0.2, 0, 0, 1)"
							/>
							<Box w="1px" h="16px" bg="panel.border" mx={0.5} flexShrink={0} />
							<HStack
								data-header-breadcrumb
								aria-label="Breadcrumb navigation"
								display={{ base: "none", md: "flex" }}
								spacing={1.5}
								minW="0"
								overflow="hidden"
								dir={isRTL ? "rtl" : "ltr"}
								flexShrink={1}
							>
								{breadcrumbItems.map((crumb, idx) => {
									const isLast = idx === breadcrumbItems.length - 1;
									return (
										<HStack
											key={crumb.label}
											spacing={1.5}
											flexShrink={isLast ? 1 : 0}
											minW="0"
										>
											{idx > 0 && (
												<Text
													as="span"
													fontSize="11px"
													color="panel.textMuted"
													userSelect="none"
												>
													{isRTL ? ">" : "<"}
												</Text>
											)}
											{crumb.path && !isLast ? (
												<Button
													variant="unstyled"
													h="auto"
													minW="auto"
													p={0}
													fontSize={{ base: "xs", md: "13px" }}
													fontWeight="600"
													color="panel.textSecondary"
													_hover={{ md: { color: "panel.text" } }}
													_active={{ transform: "scale(0.98)" }}
													transition="all 0.16s cubic-bezier(0.2, 0, 0, 1)"
													onClick={() => navigate(crumb.path!)}
												>
													<Text as="span" isTruncated>
														{crumb.label}
													</Text>
												</Button>
											) : (
												<Text
													fontSize={{ base: "xs", md: "13px" }}
													fontWeight={isLast ? "700" : "600"}
													color={isLast ? "panel.text" : "panel.textSecondary"}
													isTruncated
												>
													{crumb.label}
												</Text>
											)}
										</HStack>
									);
								})}
							</HStack>

							<AnimatePresence mode="wait">
								{mobileHeaderItems.length > 0 && (
									<motion.div
										key={mobileHeaderItems[0]?.id || "mobile-banner"}
										initial={{ opacity: 0 }}
										animate={{ opacity: 1 }}
										exit={{ opacity: 0 }}
										transition={{
											duration: 0.5,
											delay: 0.7,
											ease: [0.16, 1, 0.3, 1],
										}}
										style={{
											minWidth: 0,
											flexGrow: 1,
											flexBasis: 0,
											flexShrink: 1,
											display: isMobile ? "flex" : "none",
											alignItems: "center",
										}}
									>
										<Box
											w="fit-content"
											maxW="100%"
											h={{ base: "40px", md: "48px" }}
											display="flex"
											alignItems="center"
											justifyContent="center"
										>
											<SponsorCarousel
												items={mobileHeaderItems}
												variant="banner"
											/>
										</Box>
									</motion.div>
								)}
							</AnimatePresence>
							<AnimatePresence mode="wait">
								{sponsorHeaderItems.length > 0 && (
									<motion.div
										key={sponsorHeaderItems[0]?.id || "desktop-banner"}
										initial={{ opacity: 0 }}
										animate={{ opacity: 1 }}
										exit={{ opacity: 0 }}
										transition={{
											duration: 0.5,
											delay: 0.7,
											ease: [0.16, 1, 0.3, 1],
										}}
										style={{
											minWidth: 0,
											flexShrink: 1,
											display: "flex",
											alignItems: "center",
										}}
									>
										<Box
											maxW="95%"
											minW={0}
											h={{ base: "40px", md: "48px" }}
											display={{ base: "none", md: "flex" }}
											alignItems="center"
											justifyContent="center"
										>
											<SponsorCarousel
												items={sponsorHeaderItems}
												variant="banner"
											/>
										</Box>
									</motion.div>
								)}
							</AnimatePresence>
						</HStack>

						<HStack spacing={2} alignItems="center" flexShrink={0} h="full">
							<HeaderCalendar isCompact={calendarCompact} />

							{/* User Menu */}
							{getUserIsSuccess && userData.username && (
								<Menu
									placement="bottom-end"
									isLazy
									autoSelect={false}
									closeOnSelect={false}
									isOpen={userMenu.isOpen}
									onOpen={userMenu.onOpen}
									onClose={handleUserMenuClose}
								>
									<MenuButton
										as={Button}
										size="sm"
										variant="outline"
										h="34px"
										w={{ base: "34px", md: "auto" }}
										minW={{ base: "34px", md: "auto" }}
										p={{ base: 0, md: "6px 12px" }}
										borderRadius={{ base: "full", md: "12px" }}
										borderColor={shellBorder}
										bg="panel.surface"
										color="panel.text"
										boxShadow="0 1px 3px rgba(0, 0, 0, 0.04)"
										_hover={{
											md: {
												bg: "panel.elevated",
												borderColor: "panel.borderStrong",
												boxShadow: "0 4px 14px rgba(0, 0, 0, 0.08)",
											},
										}}
										_active={{ bg: "panel.elevated", transform: "scale(0.98)" }}
										aria-label={t("a11y.userMenu")}
										display="inline-flex"
										alignItems="center"
										justifyContent="center"
										transition="all 0.16s cubic-bezier(0.2, 0, 0, 1)"
										onClick={() => {
											if (userMenu.isOpen) {
												handleUserMenuClose();
											} else {
												userMenu.onOpen();
											}
										}}
									>
										<HStack
											spacing={2}
											align="center"
											justify="center"
											dir={isRTL ? "rtl" : "ltr"}
										>
											<Flex
												w="20px"
												h="20px"
												align="center"
												justify="center"
												borderRadius="full"
												color="panel.textSecondary"
												flexShrink={0}
											>
												<UserIcon />
											</Flex>
											<Text
												display={{ base: "none", md: "inline" }}
												maxW={{ base: "100px", md: "140px" }}
												fontSize="12px"
												fontWeight="600"
												isTruncated
												dir="ltr"
												sx={{ unicodeBidi: "isolate" }}
											>
												{userData.username}
											</Text>
										</HStack>
									</MenuButton>
									<Portal>
										<MenuList
											dir={isRTL ? "rtl" : "ltr"}
											ref={userMenuContentRef}
											id="rb-user-menu"
											minW="230px"
											p={2}
											borderRadius="20px"
											borderWidth="1px"
											borderColor="panel.border"
											bg="panel.surface"
											boxShadow={menuShadow}
											zIndex={9999}
											userSelect="none"
											sx={{
												".chakra-menu__menuitem": {
													bg: "transparent !important",
													borderRadius: "10px",
													h: "38px",
													px: "12px",
													my: "2px",
													fontSize: "13px",
													fontWeight: "500",
													transition: "all 0.18s cubic-bezier(0.16, 1, 0.3, 1)",
													"&:hover": {
														bg: "var(--rb-panel-elevated) !important",
													},
													"&:active, &:focus-visible": {
														bg: "var(--rb-panel-elevated) !important",
													},
													"&:focus:not(:focus-visible)": {
														bg: "transparent !important",
													},
												},
												".rb-logout-menu-item": {
													color: "red.400 !important",
													fontWeight: "600 !important",
													bg: "transparent !important",
													"--menu-bg": "transparent",
													"&:hover, &:active, &:focus, &:focus-visible": {
														color: "red.400 !important",
														bg: "rgba(239, 68, 68, 0.18) !important",
														"--menu-bg": "rgba(239, 68, 68, 0.18) !important",
													},
													"&:focus:not(:focus-visible)": {
														bg: "transparent !important",
														"--menu-bg": "transparent !important",
													},
												},
											}}
										>
											<Flex
												align="center"
												gap={3}
												p={2.5}
												mb={1.5}
												borderRadius="14px"
												bg="panel.elevated"
												borderWidth="1px"
												borderColor="panel.border"
											>
												<Flex
													w="34px"
													h="34px"
													align="center"
													justify="center"
													borderRadius="10px"
													bg="panel.surface"
													borderWidth="1px"
													borderColor="panel.border"
													color="panel.text"
													flexShrink={0}
												>
													<UserIcon />
												</Flex>
												<VStack align="flex-start" spacing={0} minW={0}>
													<Text
														fontWeight="700"
														fontSize="13px"
														color="panel.text"
														isTruncated
													>
														{userData.username}
													</Text>
													<Text
														fontSize="11px"
														fontWeight="500"
														color="panel.textMuted"
														isTruncated
													>
														{roleLabel}
													</Text>
												</VStack>
											</Flex>

											<Menu
												placement={languagePlacement}
												strategy="fixed"
												isOpen={languageMenu.isOpen}
												onOpen={languageMenu.onOpen}
												onClose={languageMenu.onClose}
												closeOnSelect={false}
												isLazy
												autoSelect={false}
											>
												<MenuButton
													as={Button}
													leftIcon={<LanguageIconStyled />}
													variant="ghost"
													w="full"
													h="38px"
													justifyContent="flex-start"
													fontWeight="500"
													fontSize="13px"
													borderRadius="12px"
													px={3}
													bg="transparent"
													color="panel.text"
													transition="all 0.16s cubic-bezier(0.2, 0, 0, 1)"
													_hover={{ bg: "panel.elevated" }}
													_active={{
														bg: "panel.elevated",
														transform: "scale(0.98)",
													}}
													_focusVisible={{ bg: "panel.elevated" }}
													onClick={(e: ReactMouseEvent) => {
														e.stopPropagation();
														languageMenu.isOpen
															? languageMenu.onClose()
															: languageMenu.onOpen();
													}}
												>
													<HStack justify="space-between" w="full" minW={0}>
														<Text color="panel.text">
															{t("header.language")}
														</Text>
														<Text
															fontSize="11px"
															fontWeight="600"
															color="panel.textMuted"
														>
															{languageItems.find(
																(item) => item.code === i18n.language,
															)?.label || "English"}
														</Text>
													</HStack>
												</MenuButton>
												<Portal containerRef={userMenuContentRef}>
													<MenuList
														dir={isRTL ? "rtl" : "ltr"}
														minW="170px"
														p={1.5}
														borderRadius="18px"
														borderWidth="1px"
														borderColor="panel.border"
														bg="panel.surface"
														boxShadow={menuShadow}
														zIndex={9999}
														userSelect="none"
														sx={{
															".chakra-menu__menuitem": {
																bg: "transparent !important",
																borderRadius: "8px",
																h: "36px",
																px: "10px",
																my: "1px",
																fontSize: "12px",
																fontWeight: "500",
																"@media (hover: hover)": {
																	"&:hover": {
																		bg: "panel.elevated !important",
																	},
																},
																"&:active, &:focus-visible": {
																	bg: "panel.elevated !important",
																},
																"&:focus:not(:focus-visible)": {
																	bg: "transparent !important",
																},
															},
														}}
													>
														{languageItems.map(({ code, label, flag }) => {
															const isActiveLang = i18n.language === code;
															return (
																<MenuItem
																	key={code}
																	onClick={() => {
																		changeLanguage(code);
																	}}
																>
																	<HStack justify="space-between" w="full">
																		<HStack spacing={2.5}>
																			{code === "fa" ? (
																				<ImperialIranFlag
																					style={{
																						width: "16px",
																						height: "12px",
																					}}
																				/>
																			) : (
																				<ReactCountryFlag
																					countryCode={flag}
																					svg
																					style={{
																						width: "16px",
																						height: "12px",
																					}}
																				/>
																			)}
																			<Text
																				fontWeight={
																					isActiveLang ? "700" : "500"
																				}
																			>
																				{label}
																			</Text>
																		</HStack>
																		{isActiveLang && (
																			<CheckIcon
																				width={15}
																				color="panel.text"
																			/>
																		)}
																	</HStack>
																</MenuItem>
															);
														})}
													</MenuList>
												</Portal>
											</Menu>

											<ThemeSelector
												trigger="menuItem"
												triggerLabel={t("header.theme")}
												portalContainer={userMenuContentRef}
												onModalOpen={handleThemeModalOpen}
												onModalClose={handleThemeModalClose}
											/>

											<MenuItem
												className="rb-logout-menu-item"
												icon={<LogoutIcon />}
												color="red.400"
												onClick={async () => {
													try {
														await logoutSession();
													} finally {
														clearClientSession();
														navigate("/login");
													}
												}}
											>
												{t("header.logout")}
											</MenuItem>
										</MenuList>
									</Portal>
								</Menu>
							)}
						</HStack>
					</Box>
					<Box
						as="main"
						flex="1"
						p={{ base: 3, md: 4 }}
						pb={{ base: "40", md: "4" }}
						overflow="auto"
						minH="0"
						bg={shellMainBg}
					>
						<Outlet />
					</Box>
				</Flex>

				{/* mobile drawer */}
				{isMobile && (
					<Drawer
						isOpen={sidebarDrawer.isOpen}
						placement={isRTL ? "right" : "left"}
						onClose={sidebarDrawer.onClose}
						size="xs"
						autoFocus={false}
						returnFocusOnClose={false}
						trapFocus={false}
						blockScrollOnMount={false}
					>
						<DrawerOverlay bg="blackAlpha.700" />
						<DrawerContent
							bg="panel.surface"
							borderInlineEndWidth="1px"
							borderColor="panel.border"
							boxShadow="0 20px 48px rgba(0, 0, 0, 0.4)"
							sx={{
								willChange: "transform",
								transform: "translateZ(0)",
							}}
						>
							<DrawerBody p={0}>
								<AppSidebar
									collapsed={false}
									sponsors={sponsorSidebarLogoItems}
									sidebarBanners={sponsorSidebarBanners}
									inDrawer
									onRequestExpand={sidebarDrawer.onClose}
								/>
							</DrawerBody>
						</DrawerContent>
					</Drawer>
				)}
				{isMobile && (
					<>
						{showIosPrompt && (
							<Box
								position="fixed"
								left="0"
								right="0"
								bottom={{ base: "86px", sm: "90px" }}
								px="4"
								zIndex={2000}
							>
								<Box
									bg={menuBg}
									borderRadius="20px"
									borderWidth="1px"
									borderColor={menuBorder}
									px="4"
									py="3"
									display="flex"
									alignItems="center"
									gap="3"
									boxShadow="lg"
								>
									<Box
										w="8"
										h="8"
										borderRadius="full"
										bg="whiteAlpha.600"
										_dark={{ bg: "whiteAlpha.300" }}
										display="flex"
										alignItems="center"
										justifyContent="center"
									>
										<ShareIcon />
									</Box>
									<Box flex="1">
										<Text fontWeight="semibold" fontSize="sm">
											{t("pwa.ios.title")}
										</Text>
										<Text
											fontSize="xs"
											color="gray.600"
											_dark={{ color: "gray.300" }}
										>
											{t("pwa.ios.body")}
										</Text>
									</Box>
									<Button
										size="sm"
										variant="ghost"
										onClick={() => {
											setShowIosPrompt(false);
											localStorage.setItem("ios-pwa-tip-shown", "1");
										}}
									>
										{t("pwa.ios.dismiss")}
									</Button>
								</Box>
							</Box>
						)}
						<Box
							position="fixed"
							left="0"
							right="0"
							bottom="calc(env(safe-area-inset-bottom, 0px) + 12px)"
							zIndex={1500}
							px="3"
							pointerEvents="none"
						>
							<Box
								pointerEvents="auto"
								bg={dockBg}
								borderColor={dockBorder}
								boxShadow={dockShadow}
								borderWidth="1px"
								borderRadius="24px"
								px="2"
								py="1.5"
								maxW="min(440px, calc(100vw - 20px))"
								mx="auto"
							>
								<Box position="relative" w="full">
									{(() => {
										const dockItemCount = bottomNavItems.length;
										const activeDockIndex = bottomNavItems.findIndex(
											(it) => it.key === selectedTabKey,
										);
										if (activeDockIndex < 0 || dockItemCount === 0) return null;
										return (
											<Box
												position="absolute"
												top="0"
												bottom="0"
												width={`calc(100% / ${dockItemCount})`}
												left={isRTL ? undefined : "0px"}
												right={isRTL ? "0px" : undefined}
												transform={
													isRTL
														? `translateX(calc(-${activeDockIndex * 100}%))`
														: `translateX(calc(${activeDockIndex * 100}%))`
												}
												transition="transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)"
												p="2px"
												pointerEvents="none"
												zIndex={0}
												sx={{
													willChange: "transform",
												}}
											>
												<Box
													w="full"
													h="full"
													borderRadius="16px"
													bg="panel.elevated"
													borderWidth="1px"
													borderColor="panel.borderStrong"
													boxShadow="0 2px 8px rgba(0, 0, 0, 0.12)"
												/>
											</Box>
										);
									})()}

									<SimpleGrid
										columns={bottomNavItems.length}
										spacing={0}
										w="full"
										position="relative"
										alignItems="center"
										dir={isRTL ? "rtl" : "ltr"}
										zIndex={1}
									>
										{bottomNavItems.map((item) => {
											const isActive = resolveActive(item);
											const isSelected = selectedTabKey === item.key;
											const isSettingsItem = item.key === "settings";
											const displayLabel =
												isSettingsItem && activeSettingsItem
													? activeSettingsItem.label
													: item.label;
											const DisplayIcon = isSettingsItem
												? (activeSettingsItem?.icon ?? SettingsNavIcon)
												: item.key === "dashboard"
													? HomeIcon
													: item.key === "users"
														? UsersIcon
														: item.key === "admins"
															? AdminsIcon
															: UserIcon;
											const navContent = (
												<Box
													w="full"
													display="flex"
													flexDirection="column"
													alignItems="center"
													justifyContent="center"
													minW="0"
													py="1"
													px="1"
													position="relative"
													zIndex={1}
												>
													<Box
														w="6"
														h="6"
														display="grid"
														placeItems="center"
														color={
															isSelected
																? "var(--rb-panel-accent)"
																: dockInactiveIcon
														}
														transform={
															isSelected
																? "scale(1.08) translateY(-1px)"
																: "scale(1) translateY(0)"
														}
														transition="all 0.2s cubic-bezier(0.16, 1, 0.3, 1)"
													>
														<DisplayIcon />
													</Box>
													<Text
														fontSize="10px"
														lineHeight="1.2"
														fontWeight={isSelected ? "600" : "500"}
														textAlign="center"
														whiteSpace="nowrap"
														overflow="hidden"
														textOverflow="ellipsis"
														maxW="100%"
														px="0.5"
														mt="2px"
														color={isSelected ? "panel.text" : dockInactiveText}
														transition="color 0.2s ease"
													>
														{displayLabel}
													</Text>
												</Box>
											);

											if (item.key === "settings") {
												return (
													<Popover
														key={item.key}
														isOpen={settingsMenu.isOpen}
														onClose={handleSettingsMenuClose}
														placement="top"
														gutter={12}
														closeOnBlur
														modifiers={popoverModifiers}
														strategy="fixed"
													>
														<PopoverTrigger>
															<Button
																variant="ghost"
																size="sm"
																ref={(node) => {
																	tabContentRefs.current[item.key] = node;
																}}
																onClick={() => {
																	handleSettingsMenuToggle();
																}}
																color={isActive ? "primary.500" : "gray.600"}
																_dark={{
																	color: isActive ? "primary.300" : "gray.300",
																}}
																w="full"
																minW="0"
																minH="46px"
																h="auto"
																px="0"
																borderRadius="full"
																position="relative"
																zIndex={1}
																sx={{ touchAction: "manipulation" }}
																userSelect="none"
																transition="transform 0.16s cubic-bezier(0.2, 0, 0, 1)"
																_hover={{ bg: "transparent" }}
																_active={{
																	bg: "transparent",
																	transform: "scale(0.96)",
																}}
																_focus={{ bg: "transparent" }}
															>
																{navContent}
															</Button>
														</PopoverTrigger>
														<Portal>
															<PopoverContent
																w="min(270px, calc(100vw - 24px))"
																maxW="calc(100vw - 24px)"
																maxH="calc(100vh - 130px)"
																overflowY="auto"
																borderRadius="20px"
																bg="panel.surface"
																borderColor="panel.border"
																borderWidth="1px"
																boxShadow={menuShadow}
																p={2.5}
																dir={isRTL ? "rtl" : "ltr"}
															>
																<PopoverBody p={0}>
																	<Box
																		px={2.5}
																		pt={1.5}
																		pb={1}
																		borderBottomWidth="1px"
																		borderColor="panel.border"
																		mb={2}
																	>
																		<Text
																			fontSize="11px"
																			fontWeight="700"
																			color="panel.textMuted"
																			textTransform="uppercase"
																			letterSpacing="0.06em"
																		>
																			{t("header.settings")}
																		</Text>
																	</Box>
																	<VStack align="stretch" spacing={2.5}>
																		{mobileDockSections.map((sec) => (
																			<Box key={sec.id}>
																				<Text
																					px={2}
																					py={0.5}
																					fontSize="10.5px"
																					fontWeight="600"
																					color="panel.textMuted"
																					textTransform="uppercase"
																					letterSpacing="0.06em"
																				>
																					{sec.title}
																				</Text>
																				<VStack
																					align="stretch"
																					spacing={1}
																					mt={0.5}
																				>
																					{sec.items.map((entry) => {
																						if (entry.type === "direct") {
																							const ItemIcon = entry.icon;
																							const isSelected =
																								location.pathname ===
																									entry.to ||
																								(entry.to !== "/" &&
																									location.pathname.startsWith(
																										entry.to,
																									));
																							return (
																								<Button
																									key={entry.key}
																									variant="ghost"
																									size="sm"
																									w="full"
																									h="36px"
																									borderRadius="10px"
																									px={2.5}
																									justifyContent="flex-start"
																									leftIcon={<ItemIcon />}
																									bg={
																										isSelected
																											? "panel.elevated"
																											: "transparent"
																									}
																									color={
																										isSelected
																											? "panel.text"
																											: "panel.textSecondary"
																									}
																									fontWeight={
																										isSelected ? "600" : "500"
																									}
																									fontSize="12.5px"
																									borderInlineStartWidth={
																										isSelected ? "3px" : "0px"
																									}
																									borderInlineStartColor="var(--rb-panel-accent)"
																									_hover={{
																										md: {
																											bg: "panel.elevated",
																											color: "panel.text",
																										},
																									}}
																									_active={{
																										bg: "panel.elevated",
																									}}
																									onClick={() => {
																										navigateToSettingsItem(
																											entry.to,
																										);
																									}}
																								>
																									{entry.label}
																								</Button>
																							);
																						}

																						const GroupIcon = entry.icon;
																						const isGroupOpen = Boolean(
																							mobileDockOpenGroups[entry.id],
																						);
																						const isGroupActive =
																							entry.subItems.some(
																								(s) =>
																									location.pathname === s.to ||
																									(s.to !== "/" &&
																										location.pathname.startsWith(
																											s.to,
																										)),
																							);

																						return (
																							<Box key={entry.id}>
																								<Flex
																									align="center"
																									justify="space-between"
																									w="full"
																									h="36px"
																									px={2.5}
																									borderRadius="10px"
																									bg={
																										isGroupActive &&
																										!isGroupOpen
																											? "panel.elevated"
																											: "transparent"
																									}
																									color={
																										isGroupActive
																											? "panel.text"
																											: "panel.textSecondary"
																									}
																									fontWeight={
																										isGroupActive
																											? "600"
																											: "500"
																									}
																									fontSize="12.5px"
																									cursor="pointer"
																									borderInlineStartWidth={
																										isGroupActive &&
																										!isGroupOpen
																											? "3px"
																											: "0px"
																									}
																									borderInlineStartColor="var(--rb-panel-accent)"
																									onClick={() => {
																										setMobileDockOpenGroups(
																											(prev) => ({
																												...prev,
																												[entry.id]:
																													!prev[entry.id],
																											}),
																										);
																									}}
																									_hover={{
																										md: {
																											bg: "panel.elevated",
																											color: "panel.text",
																										},
																									}}
																									_active={{
																										bg: "panel.elevated",
																									}}
																								>
																									<HStack
																										spacing={2}
																										align="center"
																									>
																										<Box
																											as="span"
																											color={
																												isGroupActive
																													? "var(--rb-panel-accent)"
																													: "inherit"
																											}
																										>
																											<GroupIcon />
																										</Box>
																										<Text noOfLines={1}>
																											{entry.title}
																										</Text>
																									</HStack>
																									<ChevronDownIconStyled
																										color="panel.textMuted"
																										transform={
																											isGroupOpen
																												? "rotate(180deg)"
																												: "rotate(0deg)"
																										}
																										transition="transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)"
																									/>
																								</Flex>

																								<AnimatePresence
																									initial={false}
																								>
																									{isGroupOpen && (
																										<motion.div
																											initial={{
																												opacity: 0,
																												height: 0,
																											}}
																											animate={{
																												opacity: 1,
																												height: "auto",
																											}}
																											exit={{
																												opacity: 0,
																												height: 0,
																											}}
																											transition={{
																												duration: 0.24,
																												ease: [0.16, 1, 0.3, 1],
																											}}
																											style={{
																												overflow: "hidden",
																											}}
																										>
																											<Box
																												ms="14px"
																												ps="8px"
																												my={1}
																												borderInlineStart="1.5px solid"
																												borderColor="panel.border"
																											>
																												<VStack
																													align="stretch"
																													spacing={0.5}
																												>
																													{entry.subItems.map(
																														(sub) => {
																															const isSubActive =
																																location.pathname ===
																																	sub.to ||
																																(sub.to !==
																																	"/" &&
																																	location.pathname.startsWith(
																																		sub.to,
																																	));
																															const SubIcon =
																																sub.icon;
																															return (
																																<Button
																																	key={sub.id}
																																	variant="ghost"
																																	size="sm"
																																	w="full"
																																	h="32px"
																																	borderRadius="10px"
																																	px={2}
																																	justifyContent="flex-start"
																																	leftIcon={
																																		<SubIcon />
																																	}
																																	bg={
																																		isSubActive
																																			? "panel.elevated"
																																			: "transparent"
																																	}
																																	color={
																																		isSubActive
																																			? "panel.text"
																																			: "panel.textSecondary"
																																	}
																																	fontWeight={
																																		isSubActive
																																			? "600"
																																			: "400"
																																	}
																																	fontSize="12px"
																																	borderInlineStartWidth={
																																		isSubActive
																																			? "2.5px"
																																			: "0px"
																																	}
																																	borderInlineStartColor="var(--rb-panel-accent)"
																																	_hover={{
																																		md: {
																																			bg: "panel.elevated",
																																			color:
																																				"panel.text",
																																		},
																																	}}
																																	_active={{
																																		bg: "panel.elevated",
																																	}}
																																	onClick={() => {
																																		navigateToSettingsItem(
																																			sub.to,
																																		);
																																	}}
																																>
																																	{sub.title}
																																</Button>
																															);
																														},
																													)}
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
																		))}
																	</VStack>
																</PopoverBody>
															</PopoverContent>
														</Portal>
													</Popover>
												);
											}

											if (item.key === "myaccount") {
												return (
													<Popover
														key={item.key}
														isOpen={accountMenu.isOpen}
														onClose={handleAccountMenuClose}
														autoFocus={false}
														placement="top"
														gutter={12}
														closeOnBlur
														modifiers={popoverModifiers}
														strategy="fixed"
													>
														<PopoverTrigger>
															<Button
																variant="ghost"
																size="sm"
																ref={(node) => {
																	tabContentRefs.current[item.key] = node;
																}}
																onClick={() => {
																	handleAccountMenuClose();
																	handleNavClick(item.to);
																}}
																color={isActive ? "primary.500" : "gray.600"}
																_dark={{
																	color: isActive ? "primary.300" : "gray.300",
																}}
																w="full"
																minW="0"
																minH="46px"
																h="auto"
																px="0"
																borderRadius="full"
																position="relative"
																zIndex={1}
																sx={{ touchAction: "manipulation" }}
																userSelect="none"
																transition="transform 0.16s cubic-bezier(0.2, 0, 0, 1)"
																_hover={{ bg: "transparent" }}
																_active={{
																	bg: "transparent",
																	transform: "scale(0.96)",
																}}
																_focus={{ bg: "transparent" }}
															>
																{navContent}
															</Button>
														</PopoverTrigger>
														<Portal>
															<PopoverContent
																w="min(200px, calc(100vw - 24px))"
																maxW="calc(100vw - 24px)"
																borderRadius="20px"
																bg="panel.surface"
																borderColor="panel.border"
																borderWidth="1px"
																boxShadow={menuShadow}
																p={2}
															>
																<PopoverBody p={0}>
																	<Button
																		variant="ghost"
																		size="sm"
																		w="full"
																		h="38px"
																		borderRadius="10px"
																		justifyContent="flex-start"
																		leftIcon={<LogoutIcon />}
																		color="red.400"
																		_hover={{
																			bg: "rgba(239, 68, 68, 0.12)",
																			color: "red.400",
																		}}
																		_active={{ bg: "rgba(239, 68, 68, 0.18)" }}
																		_focus={{ bg: "transparent" }}
																		_focusVisible={{
																			bg: "rgba(239, 68, 68, 0.12)",
																		}}
																		onClick={async () => {
																			try {
																				await logoutSession();
																			} finally {
																				clearClientSession();
																				handleAccountMenuClose();
																				navigate("/login");
																			}
																		}}
																	>
																		{t("header.logout")}
																	</Button>
																</PopoverBody>
															</PopoverContent>
														</Portal>
													</Popover>
												);
											}

											return (
												<Button
													key={item.key}
													variant="ghost"
													size="sm"
													ref={(node) => {
														tabContentRefs.current[item.key] = node;
													}}
													onClick={() => {
														if (item.to) {
															handleNavClick(item.to);
														}
													}}
													color={isActive ? "primary.500" : "gray.600"}
													_dark={{
														color: isActive ? "primary.300" : "gray.300",
													}}
													w="full"
													minW="0"
													minH="46px"
													h="auto"
													px="0"
													borderRadius="full"
													position="relative"
													zIndex={1}
													userSelect="none"
													transition="transform 0.16s cubic-bezier(0.2, 0, 0, 1)"
													_hover={{ bg: "transparent" }}
													_active={{
														bg: "transparent",
														transform: "scale(0.96)",
													}}
													_focus={{ bg: "transparent" }}
												>
													{navContent}
												</Button>
											);
										})}
									</SimpleGrid>
								</Box>
							</Box>
						</Box>
					</>
				)}
			</Flex>
		</>
	);
}
