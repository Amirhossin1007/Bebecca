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
	MenuDivider,
	MenuItem,
	MenuList,
	type PlacementWithLogical,
	Popover,
	PopoverBody,
	PopoverContent,
	PopoverTrigger,
	Portal,
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
	Bars3Icon,
	BellIcon,
	BookOpenIcon,
	BriefcaseIcon,
	CheckIcon,
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
	UserIcon,
	UserGroupIcon,
	WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import {
	BellIcon as BellSolidIcon,
	BriefcaseIcon as BriefcaseSolidIcon,
	Cog6ToothIcon as Cog6ToothSolidIcon,
	HomeIcon as HomeSolidIcon,
	UserGroupIcon as UserGroupSolidIcon,
	UserIcon as UserSolidIcon,
} from "@heroicons/react/24/solid";
import { motion, useReducedMotion } from "framer-motion";
import useGetUser from "hooks/useGetUser";
import { useQuery } from "react-query";
import {
	type ElementType,
	type MouseEvent as ReactMouseEvent,
	type PointerEvent as ReactPointerEvent,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import ReactCountryFlag from "react-country-flag";
import { useTranslation } from "react-i18next";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { logout as logoutSession } from "service/auth";
import { AdminRole, AdminSection, AdminSudoScope } from "types/Admin";
import { clearClientSession } from "utils/session";
import { getSponsors, type SponsorAsset } from "service/sponsors";
import { ReactComponent as ImperialIranFlag } from "../assets/imperial-iran-flag.svg";
import { AppSidebar } from "./AppSidebar";
import { useSheetSwipeToClose } from "hooks/useSheetSwipeToClose";
import { GitHubStars } from "./GitHubStars";
import { HeaderCalendar } from "./HeaderCalendar";
import { NotificationBell } from "./NotificationBell";
import ThemeSelector from "./ThemeSelector";
import { SponsorCarousel } from "./SponsorCarousel";

const iconProps = {
	baseStyle: {
		w: 4,
		h: 4,
	},
};

const LogoutIcon = chakra(ArrowLeftOnRectangleIcon, iconProps);
const MenuIcon = chakra(Bars3Icon, iconProps);
const LanguageIconStyled = chakra(LanguageIcon, iconProps);
const DocsIcon = chakra(CodeBracketSquareIcon, iconProps);
const PHPMyAdminIcon = chakra(CircleStackIcon, iconProps);
const ExternalAppsIcon = chakra(CommandLineIcon, iconProps);
const PlaceholderIcon = chakra(DocumentDuplicateIcon, iconProps);
const PersonIcon = chakra(UserIcon, iconProps);
const MasterSettingsIcon = chakra(Cog8ToothIcon, iconProps);
const XraySettingsIcon = chakra(WrenchScrewdriverIcon, iconProps);
const tabIconStyle = { baseStyle: { w: "22px", h: "22px" } };
const TAB_ICONS: Record<string, [ElementType, ElementType]> = {
	dashboard: [chakra(HeroHomeIcon, tabIconStyle), chakra(HomeSolidIcon, tabIconStyle)],
	users: [chakra(UserGroupIcon, tabIconStyle), chakra(UserGroupSolidIcon, tabIconStyle)],
	admins: [chakra(BriefcaseIcon, tabIconStyle), chakra(BriefcaseSolidIcon, tabIconStyle)],
	settings: [chakra(Cog6ToothIcon, tabIconStyle), chakra(Cog6ToothSolidIcon, tabIconStyle)],
	myaccount: [chakra(UserIcon, tabIconStyle), chakra(UserSolidIcon, tabIconStyle)],
	notifications: [chakra(BellIcon, tabIconStyle), chakra(BellSolidIcon, tabIconStyle)],
};
const ServicesIcon = chakra(Squares2X2Icon, iconProps);
const HostsIcon = chakra(LinkIcon, iconProps);
const HAProxyIcon = chakra(ArrowsRightLeftIcon, iconProps);
const NodesIcon = chakra(ServerStackIcon, iconProps);
const InsightsIcon = chakra(EyeIcon, iconProps);
const RecentActionsIcon = chakra(ClockIcon, iconProps);
const ShareIcon = chakra(ArrowUpOnSquareIcon, iconProps);
const TutorialIcon = chakra(BookOpenIcon, iconProps);

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
	useSheetSwipeToClose();
	const languageMenu = useDisclosure();
	const userMenu = useDisclosure();
	const accountMenu = useDisclosure();
	const settingsMenu = useDisclosure();
	const { t, i18n } = useTranslation();
	const { userData, getUserIsSuccess } = useGetUser();
	const canSeeSponsors =
		getUserIsSuccess &&
		(userData.role === AdminRole.FullAccess || userData.role === AdminRole.Sudo);
	const sponsorsQuery = useQuery("sponsors", getSponsors, {
		staleTime: 5 * 60 * 1000,
		cacheTime: 30 * 60 * 1000,
		retry: false,
		enabled: canSeeSponsors,
	});
	const sponsorData = canSeeSponsors ? sponsorsQuery.data : undefined;
	const sponsorHeaderItems = (sponsorData?.header ?? []).slice(0, 3).map(
		(asset: SponsorAsset) => ({
			id: asset.id,
			src: asset.image_url,
			alt: asset.alt || asset.label || "Sponsor",
			href: asset.target_url,
			label: asset.label,
			isSponsor: true,
		}),
	);
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
	const mobileHeaderItems = sponsorHeaderMobileItems.length > 0
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
	const accountHoldTimeout = useRef<number | null>(null);
	const accountHoldOpened = useRef(false);
	const accountHoldStartPoint = useRef<{ x: number; y: number } | null>(null);
	const settingsHoldTimeout = useRef<number | null>(null);
	const settingsHoldOpened = useRef(false);
	const settingsHoldStartPoint = useRef<{ x: number; y: number } | null>(null);
	const tabContentRefs = useRef<Record<string, HTMLButtonElement | null>>({});
	const navDragRef = useRef<{
		active: boolean;
		moved: boolean;
		startX: number;
		startY: number;
		pointerId: number | null;
	}>({
		active: false,
		moved: false,
		startX: 0,
		startY: 0,
		pointerId: null,
	});
	const navMoveRaf = useRef<number | null>(null);
	const navMovePoint = useRef<{ x: number; y: number } | null>(null);
	const suppressNavClickUntil = useRef(0);
	const [previewTabKey, setPreviewTabKey] = useState<string | null>(null);
	const previewTabKeyRef = useRef<string | null>(null);
	const [isNavDragging, setIsNavDragging] = useState(false);
	const [pendingTabKey, setPendingTabKey] = useState<string | null>(null);
	const languagePlacement =
		useBreakpointValue<PlacementWithLogical>({
			base: "bottom-start",
			md: isRTL ? "left-start" : "right-start",
		}) ?? "bottom-start";

	const menuBg = useColorModeValue("panel.surface", "panel.surface");
	const menuBorder = useColorModeValue("panel.border", "panel.border");
	const menuHover = useColorModeValue("panel.elevated", "panel.elevated");
	const textColor = useColorModeValue("panel.text", "panel.text");
	const secondaryTextColor = useColorModeValue(
		"panel.textSecondary",
		"panel.textSecondary",
	);
	const primaryTint = useColorModeValue(
		"color-mix(in srgb, var(--primary-500) 12%, transparent)",
		"color-mix(in srgb, var(--primary-300) 20%, transparent)",
	);
	const dockBg = useColorModeValue(
		"color-mix(in srgb, var(--rb-panel-surface) 78%, transparent)",
		"color-mix(in srgb, var(--rb-panel-surface) 72%, transparent)",
	);
	const dockBorder = useColorModeValue(
		"rgba(15, 23, 42, 0.08)",
		"rgba(255, 255, 255, 0.09)",
	);
	const dockShadow = useColorModeValue(
		"0 12px 32px rgba(15, 23, 42, 0.14), 0 1px 3px rgba(15, 23, 42, 0.08)",
		"0 12px 32px rgba(0, 0, 0, 0.5)",
	);
	const reduceMotion = useReducedMotion();
	const navSpring = reduceMotion
		? { duration: 0 }
		: { type: "spring" as const, stiffness: 300, damping: 30, mass: 0.8 };
	const tapSpring = reduceMotion
		? { duration: 0 }
		: { type: "spring" as const, stiffness: 520, damping: 32, mass: 0.6 };
	const shellBorder = useColorModeValue("panel.border", "panel.border");
	const shellHeaderBg = useColorModeValue("panel.surface", "panel.surface");
	const shellHeaderShadow = useColorModeValue(
		"0 18px 48px rgba(15, 23, 42, 0.10)",
		"0 18px 48px rgba(0, 0, 0, 0.32)",
	);
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
			isPrivilegedAdmin
				? {
						key: "errors",
						label: "errors",
						to: "/errors",
						icon: InsightsIcon,
					}
				: null,
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

	const hasSettingsMenu = settingsMenuItems.length > 0;

	const changeLanguage = (lang: string) => {
		i18n.changeLanguage(lang);
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
		const canSeeAdmins = Boolean(sectionAccess?.[AdminSection.Admins]);
		const items: BottomNavItem[] = [
			{ key: "users", label: t("nav.users"), to: "/users" },
		];
		if (canSeeAdmins) {
			items.push({ key: "admins", label: t("nav.admins"), to: "/admins" });
		}
			if (items.length + 3 + (hasSettingsMenu ? 1 : 0) <= 5) {
			items.push({
				key: "notifications",
				label: t("notifications.menu"),
				to: "/notifications",
			});
		}
		items.push({ key: "myaccount", label: t("nav.myaccount"), to: "/myaccount" });
		if (hasSettingsMenu) {
			items.push({ key: "settings", label: t("header.settings"), kind: "menu" });
		}
		items.splice(Math.floor((items.length + 1) / 2), 0, {
			key: "dashboard",
			label: t("dashboard"),
			to: "/",
		});
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
	const activeSettingsKey = activeSettingsItem?.key ?? null;
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
	const selectedTabKey = previewTabKey ?? pendingTabKey ?? activeTabKey;
	useEffect(() => {
		setPendingTabKey((pending) => (pending === activeTabKey ? null : pending));
	}, [activeTabKey]);

	const navKeyAtPoint = (clientX: number, clientY: number) => {
		for (const item of bottomNavItems) {
			const node = tabContentRefs.current[item.key];
			if (!node) continue;
			const rect = node.getBoundingClientRect();
			if (
				clientX >= rect.left &&
				clientX <= rect.right &&
				clientY >= rect.top &&
				clientY <= rect.bottom
			) {
				return item.key;
			}
		}
		return null;
	};

	const handleNavPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
		if (!isMobile) return;
		const key = navKeyAtPoint(event.clientX, event.clientY);
		if (!key) return;
		const target = bottomNavItems.find((item) => item.key === key);
		if (target?.kind === "menu") {
			return;
		}
		navDragRef.current.active = true;
		navDragRef.current.moved = false;
		navDragRef.current.startX = event.clientX;
		navDragRef.current.startY = event.clientY;
		navDragRef.current.pointerId = event.pointerId;
		setPreviewTabKeySafe(key);
	};

	const handleNavPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
		if (!navDragRef.current.active) return;
		navMovePoint.current = { x: event.clientX, y: event.clientY };
		if (navMoveRaf.current) return;
		navMoveRaf.current = window.requestAnimationFrame(() => {
			navMoveRaf.current = null;
			const point = navMovePoint.current;
			if (!point) return;
			const dx = point.x - navDragRef.current.startX;
			const dy = point.y - navDragRef.current.startY;
			if (!navDragRef.current.moved && Math.hypot(dx, dy) < 6) {
				return;
			}
			if (!navDragRef.current.moved) {
				navDragRef.current.moved = true;
				setIsNavDragging(true);
			}
			const key = navKeyAtPoint(point.x, point.y);
			if (key && key !== previewTabKeyRef.current) {
				setPreviewTabKeySafe(key);
			}
		});
	};

	const finalizeNavDrag = () => {
		if (!navDragRef.current.active) return;
		const key = previewTabKeyRef.current;
		const moved = navDragRef.current.moved;
		navDragRef.current.active = false;
		navDragRef.current.moved = false;
		navDragRef.current.pointerId = null;
		if (navMoveRaf.current) {
			window.cancelAnimationFrame(navMoveRaf.current);
			navMoveRaf.current = null;
		}
		setIsNavDragging(false);
		setPreviewTabKeySafe(null);
		if (!moved) {
			const target = bottomNavItems.find((item) => item.key === key);
			if (key && key !== activeTabKey && target?.to && !accountHoldOpened.current) {
				setPendingTabKey(key);
				navigate(target.to);
			}
			return;
		}
		suppressNavClickUntil.current = Date.now() + 400;
		if (!key) return;
		const target = bottomNavItems.find((item) => item.key === key);
		if (!target) return;
		if (target.key === "settings") {
			openSettingsMenu();
			return;
		}
		if (key !== activeTabKey && target.to) {
			setPendingTabKey(key);
			navigate(target.to);
		}
	};

	const handleNavPointerUp = () => {
		finalizeNavDrag();
	};

	const handleNavPointerCancel = () => {
		if (!navDragRef.current.active) return;
		navDragRef.current.active = false;
		navDragRef.current.moved = false;
		navDragRef.current.pointerId = null;
		if (navMoveRaf.current) {
			window.cancelAnimationFrame(navMoveRaf.current);
			navMoveRaf.current = null;
		}
		setIsNavDragging(false);
		setPreviewTabKeySafe(null);
	};

	const handleNavClick = (to?: string) => {
		if (!to) {
			return;
		}
		if (Date.now() < suppressNavClickUntil.current) {
			return;
		}
		if (navDragRef.current.active || isNavDragging) {
			return;
		}
		handleSettingsMenuClose();
		handleAccountMenuClose();
		if (to !== location.pathname) navigate(to);
	};

	const clearAccountHoldTimer = () => {
		if (accountHoldTimeout.current) {
			window.clearTimeout(accountHoldTimeout.current);
			accountHoldTimeout.current = null;
		}
	};

	const handleAccountHoldStart = () => {
		if (!isMobile) return;
		clearAccountHoldTimer();
		accountHoldOpened.current = false;
		accountHoldTimeout.current = window.setTimeout(() => {
			accountHoldOpened.current = true;
			handleSettingsMenuClose();
			accountMenu.onOpen();
		}, 560);
	};

	const handleAccountHoldEnd = () => {
		clearAccountHoldTimer();
		accountHoldStartPoint.current = null;
	};

	const handleAccountHoldMove = (clientX: number, clientY: number) => {
		const start = accountHoldStartPoint.current;
		if (!start || accountHoldOpened.current) return;
		const dx = clientX - start.x;
		const dy = clientY - start.y;
		if (Math.hypot(dx, dy) > 12) {
			clearAccountHoldTimer();
		}
	};

	const handleAccountMenuClose = () => {
		accountHoldOpened.current = false;
		accountMenu.onClose();
	};

	const clearSettingsHoldTimer = () => {
		if (settingsHoldTimeout.current) {
			window.clearTimeout(settingsHoldTimeout.current);
			settingsHoldTimeout.current = null;
		}
	};

	const handleSettingsHoldStart = () => {
		if (!isMobile) return;
		clearSettingsHoldTimer();
		settingsHoldOpened.current = false;
		settingsHoldTimeout.current = window.setTimeout(() => {
			settingsHoldOpened.current = true;
			openSettingsMenu();
		}, 560);
	};

	const handleSettingsHoldEnd = () => {
		clearSettingsHoldTimer();
		settingsHoldStartPoint.current = null;
	};

	const handleSettingsHoldMove = (clientX: number, clientY: number) => {
		const start = settingsHoldStartPoint.current;
		if (!start || settingsHoldOpened.current) return;
		const dx = clientX - start.x;
		const dy = clientY - start.y;
		if (Math.hypot(dx, dy) > 12) {
			clearSettingsHoldTimer();
		}
	};

	const handleSettingsMenuClose = () => {
		settingsHoldOpened.current = false;
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
		if (Date.now() < suppressNavClickUntil.current) return;
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
	const locationTrail = [
		"dashboard",
		...location.pathname.split("/").filter(Boolean),
		activeLocationHash.replace(/^#/, "") ||
			settingsDefaultTabByPath[location.pathname] ||
			"",
	]
		.filter(Boolean)
		.map((part) => part.replace(/[-_]+/g, " "));
	const openCurrentPage = () => {
		const defaultTab = settingsDefaultTabByPath[location.pathname];
		if (defaultTab) {
			window.location.hash = defaultTab;
			return;
		}
		navigate(location.pathname);
	};

	const navigateToSettingsItem = (target: string) => {
		const defaultTab = settingsDefaultTabByPath[target];
		if (defaultTab) {
			navigate(`${target}#${defaultTab}`);
			return;
		}
		navigate(target);
	};

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
							: "248px",
				}}
			>
				{/* persistent sidebar on md+; drawer on mobile */}
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
					ml={isMobile || isRTL ? "0" : sidebarCollapsed ? "88px" : "248px"}
					mr={isMobile || !isRTL ? "0" : sidebarCollapsed ? "88px" : "248px"}
					transition="margin 0.3s cubic-bezier(0.16, 1, 0.3, 1)"
				>
					<Box
						as="header"
						h="14"
						minH="14"
						borderWidth="1px"
						borderColor={shellBorder}
						borderRadius="2xl"
						bg={shellHeaderBg}
						boxShadow={shellHeaderShadow}
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
						gap={4}
					>
						<HStack spacing={3} alignItems="center" flex="1" minW="0">
							<IconButton
								size="sm"
								variant="outline"
								aria-label={t("a11y.toggleSidebar")}
								onClick={() => {
									if (isMobile) sidebarDrawer.onOpen();
									else setSidebarCollapsed(!sidebarCollapsed);
								}}
								icon={<MenuIcon />}
								flexShrink={0}
								bg={headerButtonBg}
								borderColor={shellBorder}
								_hover={{ bg: headerButtonHoverBg }}
							/>
							<HStack
								aria-label="Current location"
								spacing="1"
								minW="0"
								flexShrink={1}
								overflow="hidden"
								dir="ltr"
								display={{ base: "none", md: "flex" }}
							>
								<Button
									variant="link"
									fontSize={{ base: "xs", md: "sm" }}
									fontWeight="semibold"
									color="panel.textSecondary"
									flexShrink={0}
									onClick={() => navigate("/")}
									_hover={{ color: "panel.text" }}
								>
									dashboard
								</Button>
								{locationTrail.length > 1 && (
									<>
										<Text color="panel.textSecondary">→</Text>
										<Button
											variant="link"
											fontSize={{ base: "xs", md: "sm" }}
											fontWeight="semibold"
											color="panel.textSecondary"
											flexShrink={0}
											onClick={openCurrentPage}
											_hover={{ color: "panel.text" }}
										>
											{locationTrail[1]}
										</Button>
									</>
								)}
								{locationTrail.length > 2 && (
									<Text
										fontSize={{ base: "xs", md: "sm" }}
										fontWeight="semibold"
										color="panel.textSecondary"
										whiteSpace="nowrap"
										overflow="hidden"
										textOverflow="ellipsis"
									>
										→ {locationTrail.slice(2).join(" → ")}
									</Text>
								)}
							</HStack>
							{mobileHeaderItems.length > 0 && (
								<Box
									w={{ base: "160px", sm: "220px", md: "360px" }}
									minW="0"
									flexShrink={1}
									display={{ base: "block", md: "none" }}
								>
									<SponsorCarousel
										items={mobileHeaderItems}
										variant="banner"
									/>
								</Box>
							)}
							{sponsorHeaderItems.length > 0 && (
								<Box
									w={{ base: "160px", sm: "220px", md: "360px" }}
									minW="0"
									flexShrink={1}
									display={{ base: "none", md: "block" }}
								>
									<SponsorCarousel
										items={sponsorHeaderItems}
										variant="banner"
									/>
								</Box>
							)}
						</HStack>
						<HStack spacing={2} alignItems="center" flexShrink={0}>
							<HStack
								spacing={0}
								px={1}
								h="34px"
								borderRadius="full"
								borderWidth="1px"
								borderColor={shellBorder}
								bg={headerButtonBg}
							>
								<HeaderCalendar />
								{getUserIsSuccess && userData.username && <NotificationBell />}
								<GitHubStars />
							</HStack>

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
										variant="outline"
										h="34px"
										minW="34px"
										borderRadius="full"
										pl={1}
										pr={{ base: 1, sm: 3 }}
										aria-label={t("a11y.userMenu")}
										fontSize="sm"
										fontWeight="semibold"
										bg={headerButtonBg}
										borderColor={shellBorder}
										_hover={{ bg: headerButtonHoverBg }}
										onClick={() => {
											if (userMenu.isOpen) {
												handleUserMenuClose();
											} else {
												userMenu.onOpen();
											}
										}}
									>
										<HStack spacing={2}>
											<Flex
												w="24px"
												h="24px"
												flexShrink={0}
												align="center"
												justify="center"
												borderRadius="full"
												bg={primaryTint}
												color="primary.500"
												_dark={{ color: "primary.300" }}
											>
												<PersonIcon w="3.5" h="3.5" />
											</Flex>
											<Text
												display={{ base: "none", sm: "inline" }}
												maxW={{ base: "100px", sm: "130px" }}
												isTruncated
											>
												{userData.username}
											</Text>
										</HStack>
									</MenuButton>
									<MenuList
										dir={isRTL ? "rtl" : "ltr"}
										ref={userMenuContentRef}
										minW="236px"
										borderRadius="xl"
										p={1.5}
										boxShadow="xl"
										bg={menuBg}
										borderColor={menuBorder}
										color={textColor}
										zIndex={9999}
										userSelect="none"
										sx={{
											".chakra-menu__menuitem": {
												bg: "transparent !important",
												"&:hover": {
													bg: `${menuHover} !important`,
												},
												"&:active, &:focus-visible": {
													bg: `${menuHover} !important`,
												},
												"&:focus:not(:focus-visible)": {
													bg: "transparent !important",
												},
											},
											".rb-logout-menu-item:hover, .rb-logout-menu-item:focus-visible": {
												bg: "color-mix(in srgb, #ef4444 12%, transparent) !important",
											},
											".rb-logout-menu-item[data-focus]:not(:hover):not(:focus-visible)":
												{
													bg: "transparent !important",
												},
										}}
									>
										{/* User Info */}
										<HStack
											mx={1.5}
											mt={1}
											mb={1.5}
											px={3}
											py={2.5}
											spacing={3}
											borderRadius="lg"
											bg="panel.main"
										>
											<Flex
												w="36px"
												h="36px"
												flexShrink={0}
												align="center"
												justify="center"
												borderRadius="full"
												bg={primaryTint}
												color="primary.500"
												_dark={{ color: "primary.300" }}
											>
												<PersonIcon w="5" h="5" />
											</Flex>
											<VStack align="flex-start" spacing={0} minW={0}>
												<Text fontWeight="semibold" fontSize="sm" isTruncated maxW="160px">
													{userData.username}
												</Text>
												<Text fontSize="xs" color={secondaryTextColor}>
													{roleLabel}
												</Text>
											</VStack>
										</HStack>

										{/* Language Selector */}
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
												h="40px"
												justifyContent="flex-start"
												fontWeight="500"
												borderRadius="md"
												px={3}
												bg="transparent"
												_hover={{ bg: menuHover }}
												_active={{ bg: menuHover }}
												_focusVisible={{ bg: menuHover }}
												onClick={(e: ReactMouseEvent) => {
													e.stopPropagation();
													languageMenu.isOpen
														? languageMenu.onClose()
														: languageMenu.onOpen();
												}}
											>
												<HStack justify="space-between" w="full" minW={0}>
													<Text>{t("header.language")}</Text>
													<Text fontSize="xs" color={secondaryTextColor}>
														{languageItems.find(
															(item) => item.code === i18n.language,
														)?.label || "English"}
													</Text>
												</HStack>
											</MenuButton>
											<Portal containerRef={userMenuContentRef}>
												<MenuList
													dir={isRTL ? "rtl" : "ltr"}
													minW="160px"
													bg={menuBg}
													borderColor={menuBorder}
													color={textColor}
													zIndex={9999}
													userSelect="none"
													sx={{
														".chakra-menu__menuitem": {
															bg: "transparent !important",
															"&:hover": {
																bg: `${menuHover} !important`,
															},
															"&:active, &:focus-visible": {
																bg: `${menuHover} !important`,
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
																	languageMenu.onClose();
																}}
															>
																<HStack justify="space-between" w="full">
																	<HStack spacing={2}>
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
																		<Text>{label}</Text>
																	</HStack>
																	{isActiveLang && <CheckIcon width={16} />}
																</HStack>
															</MenuItem>
														);
													})}
												</MenuList>
											</Portal>
										</Menu>

										{/* Theme Selector */}
										<ThemeSelector
											trigger="menuItem"
											triggerLabel={t("header.theme")}
											portalContainer={userMenuContentRef}
											onModalOpen={handleThemeModalOpen}
											onModalClose={handleThemeModalClose}
										/>

										<MenuDivider />
										{/* Logout */}
										<MenuItem
											className="rb-logout-menu-item"
											icon={<LogoutIcon />}
											color="red.500"
											bg="transparent"
											_hover={{ bg: menuHover }}
											_active={{ bg: "transparent" }}
											_focus={{ bg: "transparent" }}
											_focusVisible={{ bg: menuHover }}
											sx={{
												"&[data-focus]:not(:hover):not(:focus-visible)": {
													bg: "transparent !important",
												},
											}}
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
					>
						<DrawerOverlay />
						<DrawerContent className="rb-sidebar-drawer" bg="panel.sidebar">
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
							bottom="0"
							zIndex={1500}
							px="3"
							pb="calc(env(safe-area-inset-bottom) + 8px)"
							pointerEvents="none"
						>
							<Box
								mx="auto"
								maxW="min(480px, 100%)"
								p="1.5"
								bg={dockBg}
								borderColor={dockBorder}
								borderWidth="1px"
								borderRadius="30px"
								boxShadow={dockShadow}
								backdropFilter="saturate(180%) blur(20px)"
								pointerEvents="auto"
							>
								<HStack
									justify="space-between"
									position="relative"
									align="center"
									spacing={0}
									dir={isRTL ? "rtl" : "ltr"}
									onPointerDown={handleNavPointerDown}
									onPointerMove={handleNavPointerMove}
									onPointerUp={handleNavPointerUp}
									onPointerCancel={handleNavPointerCancel}
									sx={{
										touchAction: "pan-y",
									}}
								>
									{bottomNavItems.map((item) => {
										const isActive = resolveActive(item);
										const isSelected = selectedTabKey === item.key;
										const settingsLabel =
											item.key === "settings" && activeSettingsItem?.label
												? activeSettingsItem.label
												: item.label;
										const customIcon =
											item.key === "settings" ? activeSettingsItem?.icon : undefined;
										const [OutlineTabIcon, SolidTabIcon] = customIcon
											? [customIcon, customIcon]
											: (TAB_ICONS[item.key] ?? TAB_ICONS.myaccount);
										const tabColor = isSelected ? "primary.500" : "panel.textSecondary";
										const tabColorDark = isSelected ? "primary.300" : "panel.textSecondary";
										const navContent = (
											<motion.div
												whileTap={reduceMotion ? undefined : { scale: 0.88 }}
												transition={tapSpring}
												style={{ width: "100%" }}
											>
												<Flex direction="column" align="center" gap="1" py="1" w="full">
													<Box
														position="relative"
														w="56px"
														h="32px"
														display="grid"
														placeItems="center"
													>
														{isSelected && (
															<motion.span
																layoutId="mobile-bottom-nav-indicator"
																transition={navSpring}
																style={{
																	position: "absolute",
																	inset: 0,
																	borderRadius: 16,
																	background: primaryTint,
																}}
															/>
														)}
														<Box
															position="relative"
															display="grid"
															placeItems="center"
															color={tabColor}
															_dark={{ color: tabColorDark }}
														>
															<motion.span
																initial={false}
																animate={{ opacity: isSelected ? 0 : 1, scale: isSelected ? 0.8 : 1 }}
																transition={navSpring}
																style={{ gridArea: "1 / 1", display: "grid", placeItems: "center" }}
															>
																<OutlineTabIcon />
															</motion.span>
															<motion.span
																initial={false}
																animate={{ opacity: isSelected ? 1 : 0, scale: isSelected ? 1 : 0.8 }}
																transition={navSpring}
																style={{ gridArea: "1 / 1", display: "grid", placeItems: "center" }}
															>
																<SolidTabIcon />
															</motion.span>
														</Box>
													</Box>
													<Text
														fontSize="10px"
														lineHeight="1.1"
														fontWeight={isSelected ? "semibold" : "medium"}
														color={tabColor}
														_dark={{ color: tabColorDark }}
														textAlign="center"
														noOfLines={1}
														maxW="100%"
														px="1"
														transition="color 0.25s ease"
													>
														{settingsLabel}
													</Text>
												</Flex>
											</motion.div>
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
																if (settingsHoldOpened.current) return;
																handleSettingsMenuToggle();
															}}
															onPointerDown={(event) => {
																if (event.pointerType === "mouse") return;
																settingsHoldStartPoint.current = {
																	x: event.clientX,
																	y: event.clientY,
																};
																handleSettingsHoldStart();
															}}
															onPointerMove={(event) => {
																if (event.pointerType === "mouse") return;
																handleSettingsHoldMove(
																	event.clientX,
																	event.clientY,
																);
															}}
															onPointerUp={handleSettingsHoldEnd}
															onPointerCancel={handleSettingsHoldEnd}
															onPointerLeave={handleSettingsHoldEnd}
															onContextMenu={(event) => {
																if (isMobile) event.preventDefault();
															}}
															color={isActive ? "primary.500" : "gray.600"}
															_dark={{
																color: isActive ? "primary.300" : "gray.300",
															}}
															flex="1"
															minW="0"
															minH="48px"
															h="auto"
															px="0"
															position="relative"
															zIndex={1}
															sx={{ touchAction: "manipulation" }}
															userSelect="none"
															_hover={{ bg: "transparent" }}
															_active={{ bg: "transparent" }}
															_focus={{ bg: "transparent" }}
														>
															{navContent}
														</Button>
													</PopoverTrigger>
													<Portal>
														<PopoverContent
															w="min(210px, calc(100vw - 24px))"
															maxW="calc(100vw - 24px)"
															maxH="calc(100vh - 160px)"
															overflowY="auto"
															borderRadius="22px"
															backdropFilter="saturate(180%) blur(20px)"
															bg={dockBg}
															borderColor={dockBorder}
															borderWidth="1px"
															boxShadow={dockShadow}
														>
															<PopoverBody position="relative" zIndex={1} p="2">
																<VStack align="stretch" spacing={1}>
																	{settingsMenuItems.map((entry) => {
																		const ItemIcon = entry.icon;
																		const isSelected =
																			activeSettingsKey === entry.key;
																		return (
																			<Button
																				key={entry.key}
																				variant="ghost"
																				size="sm"
																				w="full"
																				justifyContent="flex-start"
																				leftIcon={
																					ItemIcon ? <ItemIcon /> : undefined
																				}
																				bg={
																					isSelected ? menuHover : "transparent"
																				}
																				fontWeight={
																					isSelected ? "semibold" : "normal"
																				}
																				aria-current={
																					isSelected ? "page" : undefined
																				}
																				_hover={{
																					bg:
																						isSelected || activeSettingsKey
																							? menuHover
																							: "transparent",
																				}}
																				_active={{ bg: menuHover }}
																				_focusVisible={{ boxShadow: "outline" }}
																				onClick={() => {
																					handleSettingsMenuClose();
																					navigateToSettingsItem(entry.to);
																				}}
																			>
																				{entry.label}
																			</Button>
																		);
																	})}
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
																if (accountHoldOpened.current) return;
																handleAccountMenuClose();
																handleNavClick(item.to);
															}}
															onPointerDown={(event) => {
																if (event.pointerType === "mouse") return;
																accountHoldStartPoint.current = {
																	x: event.clientX,
																	y: event.clientY,
																};
																handleAccountHoldStart();
															}}
															onPointerMove={(event) => {
																if (event.pointerType === "mouse") return;
																handleAccountHoldMove(
																	event.clientX,
																	event.clientY,
																);
															}}
															onPointerUp={handleAccountHoldEnd}
															onPointerCancel={handleAccountHoldEnd}
															onPointerLeave={handleAccountHoldEnd}
															onContextMenu={(event) => {
																if (isMobile) event.preventDefault();
															}}
															color={isActive ? "primary.500" : "gray.600"}
															_dark={{
																color: isActive ? "primary.300" : "gray.300",
															}}
															flex="1"
															minW="0"
															minH="48px"
															h="auto"
															px="0"
															position="relative"
															zIndex={1}
															sx={{ touchAction: "manipulation" }}
															userSelect="none"
															_hover={{ bg: "transparent" }}
															_active={{ bg: "transparent" }}
															_focus={{ bg: "transparent" }}
														>
															{navContent}
														</Button>
													</PopoverTrigger>
													<Portal>
														<PopoverContent
															w="min(180px, calc(100vw - 24px))"
															maxW="calc(100vw - 24px)"
															maxH="calc(100vh - 160px)"
															overflowY="auto"
															borderRadius="22px"
															backdropFilter="saturate(180%) blur(20px)"
															bg={dockBg}
															borderColor={dockBorder}
															borderWidth="1px"
															boxShadow={dockShadow}
														>
															<PopoverBody position="relative" zIndex={1} p="2">
																<Button
																	variant="ghost"
																	size="sm"
																	w="full"
																	justifyContent="flex-start"
																	leftIcon={<LogoutIcon />}
																	color="red.500"
																	_hover={{ bg: menuHover }}
																	_active={{ bg: menuHover }}
																	_focus={{ bg: "transparent" }}
																	_focusVisible={{ bg: menuHover }}
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
												_dark={{ color: isActive ? "primary.300" : "gray.300" }}
												flex="1"
												minW="0"
												minH="48px"
												h="auto"
												px="0"
												position="relative"
												zIndex={1}
												userSelect="none"
												_hover={{ bg: "transparent" }}
												_active={{ bg: "transparent" }}
												_focus={{ bg: "transparent" }}
											>
												{navContent}
											</Button>
										);
									})}
								</HStack>
							</Box>
						</Box>
					</>
				)}
			</Flex>
		</>
	);
}
