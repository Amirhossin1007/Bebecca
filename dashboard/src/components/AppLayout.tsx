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
	UserCircleIcon,
	UserGroupIcon,
	WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import { motion } from "framer-motion";
import useGetUser from "hooks/useGetUser";
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
import { ReactComponent as ImperialIranFlag } from "../assets/imperial-iran-flag.svg";
import { AppSidebar } from "./AppSidebar";
import { HeaderCalendar } from "./HeaderCalendar";
import ThemeSelector from "./ThemeSelector";

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
	const languagePlacement =
		useBreakpointValue<PlacementWithLogical>({
			base: "bottom-start",
			md: isRTL ? "left-start" : "right-start",
		}) ?? "bottom-start";

	const menuBg = useColorModeValue("panel.surface", "panel.surface");
	const menuBorder = useColorModeValue("panel.border", "panel.border");
	const menuHover = useColorModeValue("panel.elevated", "panel.elevated");
	const activePillBg = useColorModeValue(
		"rgba(255, 255, 255, 0.18)",
		"rgba(255, 255, 255, 0.08)",
	);
	const activePillShadow = useColorModeValue(
		"0 6px 14px rgba(15, 23, 42, 0.1)",
		"0 6px 14px rgba(0, 0, 0, 0.24)",
	);
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
		const items: BottomNavItem[] = [];
		const canSeeAdmins = Boolean(sectionAccess?.[AdminSection.Admins]);
		items.push({ key: "users", label: t("nav.users"), to: "/users" });
		if (canSeeAdmins) {
			items.push({
				key: "admins",
				label: t("nav.admins"),
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
			label: t("nav.myaccount"),
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
	const activeSettingsKey = activeSettingsItem?.key ?? null;
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
		navigate(to);
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
	const breadcrumbItems = useMemo(() => {
		const path = location.pathname;
		let items: { label: string; path?: string }[] = [];

		if (path === "/") {
			items = [{ label: t("dashboard"), path: "/" }];
		} else if (path === "/users") {
			items = [
				{ label: t("dashboard"), path: "/" },
				{ label: t("sidebar.groups.userHub"), path: "/users" },
			];
		} else if (path === "/bulk-actions") {
			items = [
				{ label: t("dashboard"), path: "/" },
				{ label: t("sidebar.groups.userHub"), path: "/users" },
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
				{ label: t("sidebar.groups.infrastructure") },
				{ label: t("header.xraySettings"), path: "/xray-settings" },
			];
		} else if (path === "/haproxy") {
			items = [
				{ label: t("dashboard"), path: "/" },
				{ label: t("sidebar.groups.infrastructure") },
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
				{ label: t("sidebar.groups.system") },
				{ label: t("apiDocs.menu"), path: "/api-docs" },
			];
		} else if (path === "/tutorials") {
			items = [
				{ label: t("dashboard"), path: "/" },
				{ label: t("tutorials.menu"), path: "/tutorials" },
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
			items.push({ label: rawHash.replace(/[-_]+/g, " ") });
		}

		return items;
	}, [location.pathname, activeLocationHash, t]);

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
							: "260px",
				}}
			>
				{!isMobile ? (
					<AppSidebar
						collapsed={sidebarCollapsed}
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
					transition="margin 0.3s cubic-bezier(0.16, 1, 0.3, 1)"
				>
					<Box
						as="header"
						h="52px"
						minH="52px"
						borderWidth="1px"
						borderColor={shellBorder}
						borderRadius="20px"
						bg={shellHeaderBg}
						boxShadow={shellHeaderShadow}
						backdropFilter="blur(20px)"
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
								variant="ghost"
								borderRadius="full"
								aria-label={t("a11y.toggleSidebar")}
								onClick={() => {
									if (isMobile) sidebarDrawer.onOpen();
									else setSidebarCollapsed(!sidebarCollapsed);
								}}
								icon={<MenuIcon />}
								flexShrink={0}
								bg={headerButtonBg}
								color="panel.textSecondary"
								_hover={{ bg: headerButtonHoverBg, color: "panel.text" }}
							/>
							<HStack
								aria-label="Breadcrumb navigation"
								spacing={1.5}
								minW="0"
								overflow="hidden"
								dir={isRTL ? "rtl" : "ltr"}
							>
								{breadcrumbItems.map((crumb, idx) => {
									const isLast = idx === breadcrumbItems.length - 1;
									return (
										<HStack key={crumb.label} spacing={1.5} flexShrink={isLast ? 1 : 0} minW="0">
											{idx > 0 && (
												<Text as="span" fontSize="11px" color="panel.textMuted" userSelect="none">
													{isRTL ? "←" : "→"}
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
													_hover={{ color: "panel.text" }}
													transition="color 0.18s ease"
													onClick={() => navigate(crumb.path!)}
												>
													<Text as="span" isTruncated>{crumb.label}</Text>
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
						</HStack>
						<HStack spacing={2} alignItems="center" flexShrink={0}>
							<HeaderCalendar />

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
										w={{ base: "34px", sm: "auto" }}
										minW={{ base: "34px", sm: "auto" }}
										p={{ base: 0, sm: 2.5 }}
										borderRadius="full"
										borderColor="panel.border"
										bg="panel.surface"
										color="panel.text"
										_hover={{ bg: "panel.elevated", borderColor: "panel.borderStrong" }}
										aria-label={t("a11y.userMenu")}
										display="inline-flex"
										alignItems="center"
										justifyContent="center"
										onClick={() => {
											if (userMenu.isOpen) {
												handleUserMenuClose();
											} else {
												userMenu.onOpen();
											}
										}}
									>
										<HStack spacing={2} align="center" justify="center">
											<Flex
												w="20px"
												h="20px"
												align="center"
												justify="center"
												borderRadius="full"
												color="var(--rb-panel-accent)"
												flexShrink={0}
											>
												<UserIcon />
											</Flex>
											<Text
												display={{ base: "none", sm: "inline" }}
												maxW={{ base: "100px", sm: "140px" }}
												fontSize="12px"
												fontWeight="600"
												isTruncated
											>
												{userData.username}
											</Text>
										</HStack>
									</MenuButton>
									<MenuList
										dir={isRTL ? "rtl" : "ltr"}
										ref={userMenuContentRef}
										minW="230px"
										p={2}
										borderRadius="20px"
										borderWidth="1px"
										borderColor="panel.border"
										bg="panel.surface"
										boxShadow="0 20px 48px rgba(0, 0, 0, 0.35)"
										backdropFilter="blur(24px)"
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
													bg: "panel.elevated !important",
												},
												"&:active, &:focus-visible": {
													bg: "panel.elevated !important",
												},
												"&:focus:not(:focus-visible)": {
													bg: "transparent !important",
												},
											},
											".rb-logout-menu-item": {
												color: "red.400 !important",
												fontWeight: "600 !important",
												"&:hover": {
													bg: "rgba(239, 68, 68, 0.12) !important",
													color: "red.400 !important",
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
												borderRadius="full"
												bg="var(--rb-panel-accent)"
												color="white"
												flexShrink={0}
											>
												<UserIcon />
											</Flex>
											<VStack align="flex-start" spacing={0} minW={0}>
												<Text fontWeight="700" fontSize="13px" color="panel.text" isTruncated>
													{userData.username}
												</Text>
												<Text fontSize="11px" fontWeight="500" color="panel.textMuted" isTruncated>
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
												borderRadius="10px"
												px={3}
												bg="transparent"
												_hover={{ bg: "panel.elevated" }}
												_active={{ bg: "panel.elevated" }}
												_focusVisible={{ bg: "panel.elevated" }}
												onClick={(e: ReactMouseEvent) => {
													e.stopPropagation();
													languageMenu.isOpen
														? languageMenu.onClose()
														: languageMenu.onOpen();
												}}
											>
												<HStack justify="space-between" w="full" minW={0}>
													<Text>{t("header.language")}</Text>
													<Text fontSize="11px" fontWeight="600" color="panel.textMuted">
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
													borderRadius="16px"
													borderWidth="1px"
													borderColor="panel.border"
													bg="panel.surface"
													backdropFilter="blur(24px)"
													boxShadow="0 18px 42px rgba(0, 0, 0, 0.35)"
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
															"&:hover": {
																bg: "panel.elevated !important",
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
																	languageMenu.onClose();
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
																		<Text fontWeight={isActiveLang ? "700" : "500"}>{label}</Text>
																	</HStack>
																	{isActiveLang && <CheckIcon width={15} color="var(--rb-panel-accent)" />}
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
						<DrawerContent bg="panel.sidebar">
							<DrawerBody p={0}>
								<AppSidebar
									collapsed={false}
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
							px="4"
							pb="6px"
							pt="1"
						>
							<Box
								bg={menuBg}
								borderColor={menuBorder}
								boxShadow="xl"
								borderWidth="1px"
								borderRadius="26px"
								px="3"
								pt="2"
								pb="calc(env(safe-area-inset-bottom) + 6px)"
								maxW="min(520px, 100%)"
								mx="auto"
								position="relative"
								overflow="hidden"
							>
								<HStack
									justify="space-between"
									position="relative"
									align="center"
									spacing={1}
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
										const isSettingsItem = item.key === "settings";
										const settingsLabel =
											isSettingsItem && activeSettingsItem?.label
												? activeSettingsItem.label
												: item.label;
										const icon =
											item.key === "dashboard" ? (
												<HomeIcon />
											) : item.key === "users" ? (
												<UsersIcon />
											) : item.key === "admins" ? (
												<AdminsIcon />
											) : item.key === "settings" ? (
												<SettingsNavIcon />
											) : (
												<UserIcon />
											);
										const navContent = (
											<Box
												w="full"
												display="flex"
												justifyContent="center"
												minW="0"
											>
												<Box
													position="relative"
													display="inline-flex"
													flexDirection="column"
													alignItems="center"
													justifyContent="center"
													px="3"
													py="1.5"
													maxW="100%"
													w="fit-content"
												>
													{isSelected && (
														<motion.div
															layoutId="mobile-bottom-nav-active-pill"
															transition={{
																type: "spring",
																stiffness: 520,
																damping: 38,
																mass: 0.7,
															}}
															style={{
																position: "absolute",
																inset: 0,
																borderRadius: 999,
																background: activePillBg,
																boxShadow: activePillShadow,
																zIndex: 0,
																pointerEvents: "none",
															}}
														/>
													)}
													<Box
														position="relative"
														zIndex={1}
														w="8"
														h="8"
														display="grid"
														placeItems="center"
													>
														<motion.div
															animate={{
																y: isSelected ? -2 : 0,
																scale: isSelected ? 1.06 : 1,
															}}
															transition={{
																type: "spring",
																stiffness: 500,
																damping: 32,
															}}
															style={{ position: "relative", zIndex: 1 }}
														>
															{icon}
														</motion.div>
													</Box>
													<Text
														position="relative"
														zIndex={1}
														fontSize="10px"
														lineHeight="1.1"
														fontWeight="semibold"
														textAlign="center"
														noOfLines={2}
														maxW="100%"
														overflowWrap="anywhere"
														px="1"
													>
														{settingsLabel}
													</Text>
												</Box>
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
															borderRadius="18px"
															bg={menuBg}
															borderColor={menuBorder}
															borderWidth="1px"
															boxShadow="xl"
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
															borderRadius="18px"
															bg={menuBg}
															borderColor={menuBorder}
															borderWidth="1px"
															boxShadow="xl"
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
