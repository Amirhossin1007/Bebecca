import { Button } from "components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "components/ui/popover";
import { Sheet, SheetContent, SheetTitle } from "components/ui/sheet";
import { LogOut, ArrowLeftRight, Share, Menu, Bell, BookOpen, Briefcase, Check, Database, Clock, SquareCode, Settings, Settings2, Terminal, Copy, Eye, House as HeroHomeIcon, Languages, Link, Server, LayoutGrid, User as UserIcon, Users, Wrench, Bell as BellSolidIcon, Briefcase as BriefcaseSolidIcon, Settings as Cog6ToothSolidIcon, House as HomeSolidIcon, Users as UserGroupSolidIcon, User as UserSolidIcon } from "lucide-react";
import {
	Breadcrumb,
	BreadcrumbEllipsisDropdown,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "components/ui/breadcrumb";
import { motion, useReducedMotion } from "framer-motion";
import useGetUser from "hooks/useGetUser";
import { useQuery } from "@tanstack/react-query";
import {
	type CSSProperties,
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
import ImperialIranFlag from "../assets/imperial-iran-flag.svg?react";
import { AppSidebar } from "./AppSidebar";
import { useSheetSwipeToClose } from "hooks/useSheetSwipeToClose";
import { useDisclosure } from "hooks/useDisclosure";
import { useMediaQuery } from "hooks/useMediaQuery";

import { cn } from "lib/cn";
import { GitHubStars } from "./GitHubStars";
import { HeaderCalendar } from "./HeaderCalendar";
import { NotificationBell } from "./NotificationBell";
import ThemeSelector from "./ThemeSelector";
import { SponsorCarousel } from "./SponsorCarousel";

const LogoutIcon = LogOut;
const MenuIcon = Menu;
const LanguageIconStyled = Languages;
const DocsIcon = SquareCode;
const PHPMyAdminIcon = Database;
const ExternalAppsIcon = Terminal;
const PlaceholderIcon = Copy;
const PersonIcon = UserIcon;
const MasterSettingsIcon = Settings2;
const XraySettingsIcon = Wrench;
const TAB_ICONS: Record<string, [ElementType, ElementType]> = {
	dashboard: [HeroHomeIcon, HomeSolidIcon],
	users: [Users, UserGroupSolidIcon],
	admins: [Briefcase, BriefcaseSolidIcon],
	settings: [Settings, Cog6ToothSolidIcon],
	myaccount: [UserIcon, UserSolidIcon],
	notifications: [Bell, BellSolidIcon],
};
const ServicesIcon = LayoutGrid;
const HostsIcon = Link;
const HAProxyIcon = ArrowLeftRight;
const NodesIcon = Server;
const InsightsIcon = Eye;
const RecentActionsIcon = Clock;
const ShareIcon = Share;
const TutorialIcon = BookOpen;

const TINT_CLASS =
	"bg-[color-mix(in_srgb,var(--primary-500)_12%,transparent)] text-[var(--primary-500)] dark:bg-[color-mix(in_srgb,var(--primary-300)_20%,transparent)] dark:text-[var(--primary-300)]";

const DOCK_CLASS =
	"border-panel-border! bg-panel-surface shadow-[0_12px_32px_rgba(15,23,42,0.14),0_1px_3px_rgba(15,23,42,0.08)] dark:shadow-[0_12px_32px_rgba(0,0,0,0.5)]";

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

let textMeasureCanvas: HTMLCanvasElement | null = null;
const measureBreadcrumbLabel = (text: string, isPage = false): number => {
	if (!text) return 0;
	if (typeof document === "undefined") {
		return Math.ceil(text.length * (isPage ? 8.5 : 8));
	}
	if (!textMeasureCanvas) {
		textMeasureCanvas = document.createElement("canvas");
	}
	const ctx = textMeasureCanvas.getContext("2d");
	if (!ctx) {
		return Math.ceil(text.length * (isPage ? 8.5 : 8));
	}
	ctx.font = `${isPage ? "600" : "500"} 12.5px Vazirmatn, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
	return Math.ceil(ctx.measureText(text).width);
};

export function AppLayout() {
	const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
	const isMobile = !useMediaQuery("(min-width: 48em)");
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
	const sponsorsQuery = useQuery({ queryKey: ["sponsors"], queryFn: getSponsors, staleTime: 5 * 60 * 1000,
		gcTime: 30 * 60 * 1000,
		retry: false,
		enabled: canSeeSponsors, });
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
	const [_responsiveStage, setResponsiveStage] = useState<number>(0);
	const [breadcrumbMode, setBreadcrumbMode] = useState<
		"full" | "short" | "ellipsis" | "hidden"
	>("full");
	const [canTruncateLastCrumb, setCanTruncateLastCrumb] = useState(false);
	const [bannerShrinkable, setBannerShrinkable] = useState(false);
	const [calendarCompact, setCalendarCompact] = useState(false);
	const headerRef = useRef<HTMLElement>(null);
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
	const reduceMotion = useReducedMotion();
	const navSpring = reduceMotion
		? { duration: 0 }
		: { type: "spring" as const, stiffness: 300, damping: 30, mass: 0.8 };
	const tapSpring = reduceMotion
		? { duration: 0 }
		: { type: "spring" as const, stiffness: 520, damping: 32, mass: 0.6 };

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

	const resetNavDrag = () => {
		navDragRef.current.active = false;
		navDragRef.current.moved = false;
		navDragRef.current.pointerId = null;
	};

	const finalizeNavDrag = () => {
		if (!navDragRef.current.active) return;
		const key = previewTabKeyRef.current;
		const moved = navDragRef.current.moved;
		resetNavDrag();
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
		resetNavDrag();
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
	const breadcrumbItems = useMemo(() => {
		const path = location.pathname;
		const hashKey = (activeLocationHash || "")
			.replace(/^#/, "")
			.split("?")[0]
			.toLowerCase();

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
			const bulkActionsTabs: Record<string, string> = {
				edit: t("bulkActions.tabs.edit"),
				delete: t("bulkActions.tabs.delete"),
				permissions: t("bulkActions.tabs.permissions"),
			};
			const activeBulkTab = bulkActionsTabs[hashKey];
			if (activeBulkTab) {
				items = [
					{ label: t("dashboard"), path: "/" },
					{ label: t("sidebar.groups.userHub") },
					{ label: t("bulkActions.menu"), path: "/bulk-actions" },
					{ label: activeBulkTab },
				];
			} else {
				items = [
					{ label: t("dashboard"), path: "/" },
					{ label: t("sidebar.groups.userHub") },
					{ label: t("bulkActions.menu"), path: "/bulk-actions" },
				];
			}
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
			const usageTabs: Record<string, string> = {
				services: t("usage.tabs.services"),
				admins: t("usage.tabs.admins"),
				nodes: t("usage.tabs.nodes"),
			};
			const activeUsageTab = usageTabs[hashKey] || usageTabs.services;
			items = [
				{ label: t("dashboard"), path: "/" },
				{ label: t("usage.menu"), path: "/usage#services" },
				{ label: activeUsageTab },
			];
		} else if (path === "/hosts") {
			const hostsTabs: Record<string, string> = {
				inbounds: t("hostsPage.tabInbounds"),
				hosts: t("hostsPage.tabHosts"),
			};
			const activeHostsTab = hostsTabs[hashKey] || hostsTabs.inbounds;
			items = [
				{ label: t("dashboard"), path: "/" },
				{ label: t("header.hostSettings"), path: "/hosts#inbounds" },
				{ label: activeHostsTab },
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
			const xrayTabs: Record<string, string> = {
				basic: t("pages.xray.basicTemplate"),
				routing: t("pages.xray.Routings"),
				outbounds: t("pages.xray.Outbounds"),
				reverse: t("pages.xray.reverse.title"),
				balancers: t("pages.xray.Balancers"),
				dns: t("DNS"),
				advanced: t("pages.xray.advancedTemplate"),
			};
			const activeXrayTab = xrayTabs[hashKey] || xrayTabs.basic;
			items = [
				{ label: t("dashboard"), path: "/" },
				{ label: t("sidebar.groups.coreRouting") },
				{ label: t("header.xraySettings"), path: "/xray-settings#basic" },
				{ label: activeXrayTab },
			];
		} else if (path === "/haproxy") {
			items = [
				{ label: t("dashboard"), path: "/" },
				{ label: t("sidebar.groups.coreRouting") },
				{ label: t("haproxy.title"), path: "/haproxy" },
			];
		} else if (path === "/notifications") {
			items = [
				{ label: t("dashboard"), path: "/" },
				{ label: t("sidebar.groups.system") },
				{ label: t("notifications.menu"), path: "/notifications" },
			];
		} else if (path === "/settings") {
			const settingsTabs: Record<string, string> = {
				panel: t("settings.panel.tabTitle"),
				telegram: t("settings.telegram"),
				subscriptions: t("settings.subscriptions.tabTitle"),
				ssl: t("settings.ssl.tabTitle"),
			};
			const activeSettingsTab = settingsTabs[hashKey] || settingsTabs.panel;
			items = [
				{ label: t("dashboard"), path: "/" },
				{ label: t("sidebar.groups.system") },
				{ label: t("header.integrationSettings"), path: "/settings#panel" },
				{ label: activeSettingsTab },
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
				{ label: t("apiDocs.menu"), path: "/api-docs" },
			];
		} else if (path === "/tutorials") {
			items = [
				{ label: t("dashboard"), path: "/" },
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

		return items;
	}, [location.pathname, activeLocationHash, t]);
	const checkFit = useCallback(() => {
		if (isMobile) {
			setBreadcrumbMode("hidden");
			setCalendarCompact(false);
			setBannerShrinkable(false);
			setCanTruncateLastCrumb(false);
			return;
		}

		const headerEl = headerRef.current;
		if (!headerEl) return;

		const computed = window.getComputedStyle(headerEl);
		const pl = Number.parseFloat(computed.paddingLeft) || 0;
		const pr = Number.parseFloat(computed.paddingRight) || 0;
		const availableWidth = headerEl.clientWidth - pl - pr;

		const menuBtnWidth = 34;
		const groupGap = 12;
		const crumbItemGap = 8;
		const sepWidth = 14;

		let calendarWidth = 180;
		const calEl = headerEl.querySelector('[data-calendar-widget="true"]');
		if (calEl) {
			const rect = calEl.getBoundingClientRect();
			if (rect.width > 0) calendarWidth = rect.width;
		}

		let notifWidth = 0;
		if (getUserIsSuccess && userData.username) notifWidth = 34;

		let githubStarsWidth = 0;
		const ghEl = headerEl.querySelector('[data-github-stars="true"]');
		if (ghEl) {
			const rect = ghEl.getBoundingClientRect();
			if (rect.width > 0) githubStarsWidth = rect.width;
		}

		let profileWidth = 0;
		const profEl = headerEl.querySelector('[data-header-profile="true"]');
		if (profEl) {
			const rect = profEl.getBoundingClientRect();
			if (rect.width > 0) profileWidth = rect.width;
		}

		const rightControlsWidth =
			calendarWidth + notifWidth + githubStarsWidth + profileWidth;

		let bannerNominalWidth = 0;
		const bannerEl = headerEl.querySelector('[data-header-banner="true"]');
		if (bannerEl) {
			bannerNominalWidth = 360;
		}

		const reservedWidth =
			menuBtnWidth +
			groupGap +
			bannerNominalWidth +
			(bannerNominalWidth > 0 ? groupGap : 0) +
			rightControlsWidth;

		const count = breadcrumbItems.length;

		let fullCrumbsWidth = 0;
		if (count > 0) {
			for (let i = 0; i < count; i++) {
				const isLast = i === count - 1;
				const isFirst = i === 0;
				const pad = isFirst || isLast ? 16 : 8;
				fullCrumbsWidth +=
					measureBreadcrumbLabel(breadcrumbItems[i].label, isLast) + pad;
			}
			fullCrumbsWidth += Math.max(0, count - 1) * (sepWidth + crumbItemGap * 2);
		}

		let shortCrumbsWidth = 0;
		if (count > 0) {
			const firstPad = 16;
			const lastPad = 16;
			const firstW =
				measureBreadcrumbLabel(breadcrumbItems[0].label, false) + firstPad;
			const lastW =
				measureBreadcrumbLabel(
					breadcrumbItems[count - 1].label,
					count > 1,
				) + lastPad;

			if (count <= 2) {
				shortCrumbsWidth = fullCrumbsWidth;
			} else {
				shortCrumbsWidth =
					firstW +
					sepWidth +
					crumbItemGap * 2 +
					22 +
					sepWidth +
					crumbItemGap * 2 +
					lastW;
			}
		}

		const stage0Needed = reservedWidth + fullCrumbsWidth;
		const stage1Needed = reservedWidth + shortCrumbsWidth;
		const stage2Needed = reservedWidth;
		const stage3Needed = reservedWidth - 140;
		const stage4Needed =
			reservedWidth -
			bannerNominalWidth -
			(bannerNominalWidth > 0 ? groupGap : 0) +
			shortCrumbsWidth;
		const stage5Needed =
			reservedWidth -
			bannerNominalWidth -
			(bannerNominalWidth > 0 ? groupGap : 0);

		if (availableWidth >= stage0Needed) {
			setResponsiveStage(0);
			setBreadcrumbMode("full");
			setBannerShrinkable(false);
			setCalendarCompact(false);
			setCanTruncateLastCrumb(false);
		} else if (availableWidth >= stage1Needed) {
			setResponsiveStage(1);
			setBreadcrumbMode(count > 2 ? "short" : "full");
			setBannerShrinkable(false);
			setCalendarCompact(false);
			setCanTruncateLastCrumb(false);
		} else if (availableWidth >= stage2Needed) {
			setResponsiveStage(2);
			setBreadcrumbMode(count > 2 ? "short" : "full");
			setBannerShrinkable(false);
			setCalendarCompact(false);
			setCanTruncateLastCrumb(true);
		} else if (availableWidth >= stage3Needed) {
			setResponsiveStage(3);
			setBreadcrumbMode("ellipsis");
			setBannerShrinkable(true);
			setCalendarCompact(false);
			setCanTruncateLastCrumb(false);
		} else if (availableWidth >= stage4Needed) {
			setResponsiveStage(4);
			setBreadcrumbMode(count > 2 ? "short" : "full");
			setBannerShrinkable(false);
			setCalendarCompact(true);
			setCanTruncateLastCrumb(false);
		} else if (availableWidth >= stage5Needed) {
			setResponsiveStage(5);
			setBreadcrumbMode("ellipsis");
			setBannerShrinkable(false);
			setCalendarCompact(true);
			setCanTruncateLastCrumb(false);
		} else {
			setResponsiveStage(6);
			setBreadcrumbMode("hidden");
			setBannerShrinkable(false);
			setCalendarCompact(true);
			setCanTruncateLastCrumb(false);
		}
	}, [
		isMobile,
		breadcrumbItems,
		getUserIsSuccess,
		userData.username,
	]);

	useEffect(() => {
		checkFit();
		const handleResize = () => checkFit();
		window.addEventListener("resize", handleResize);
		return () => window.removeEventListener("resize", handleResize);
	}, [checkFit]);

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
			<div aria-hidden="true" className="hidden">
				<ThemeSelector minimal trigger="icon" />
			</div>
			<div
				dir={isRTL ? "rtl" : "ltr"}
				className={cn(
					"flex min-h-[100vh] max-h-[100vh] overflow-hidden bg-panel-app",
					isRTL ? "flex-row-reverse" : "flex-row",
				)}
				style={
					{
						"--rb-sidebar-offset": isMobile
							? "0px"
							: sidebarCollapsed
								? "88px"
								: "248px",
					} as CSSProperties
				}
			>
				{!isMobile ? (
					<AppSidebar
						collapsed={sidebarCollapsed}
						sponsors={sponsorSidebarLogoItems}
						sidebarBanners={sponsorSidebarBanners}
						onRequestExpand={() => setSidebarCollapsed(false)}
					/>
				) : null}

				<div
					ref={contentRef}
					className="flex min-w-0 flex-1 flex-col overflow-hidden"
					style={{
						marginLeft: isMobile || isRTL ? "0" : sidebarCollapsed ? "88px" : "248px",
						marginRight: isMobile || !isRTL ? "0" : sidebarCollapsed ? "88px" : "248px",
						transition: "margin 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
					}}
				>
					<header
						ref={headerRef}
						className="sticky top-3 z-40 mx-3 mt-3 flex h-14 min-h-14 shrink-0 select-none items-center justify-between gap-4 rounded-[20px] border border-panel-border! bg-panel-surface px-3 md:mx-4 md:px-5"
					>
						<div className="flex min-w-0 flex-1 items-center gap-3">
							<Button
								aria-label={t("a11y.toggleSidebar")}
								onClick={() => {
									if (isMobile) sidebarDrawer.onOpen();
									else setSidebarCollapsed(!sidebarCollapsed);
								}}
								variant="outline"
								size="icon"
								className="shrink-0 border-panel-border! bg-panel-elevated hover:bg-panel-border-strong"
							>
								<MenuIcon className="size-4" />
							</Button>

							{breadcrumbMode !== "hidden" && (
								<Breadcrumb dir="ltr" className="hidden min-w-0 shrink md:block">
									<BreadcrumbList className="flex-nowrap items-center gap-1 overflow-hidden text-xs whitespace-nowrap md:text-sm">
										{breadcrumbMode === "ellipsis" ? (
											<BreadcrumbItem>
												<BreadcrumbEllipsisDropdown
													items={breadcrumbItems}
													onNavigate={(path) => navigate(path)}
												/>
											</BreadcrumbItem>
										) : breadcrumbMode === "short" ? (
											<>
												{breadcrumbItems.length > 0 && (
													<BreadcrumbItem className="shrink-0">
														<BreadcrumbLink asChild>
															<button
																type="button"
																onClick={() =>
																	breadcrumbItems[0].path &&
																	navigate(breadcrumbItems[0].path)
																}
																className="whitespace-nowrap font-semibold text-panel-text-secondary transition-colors hover:text-panel-text"
															>
																{breadcrumbItems[0].label}
															</button>
														</BreadcrumbLink>
													</BreadcrumbItem>
												)}
												{breadcrumbItems.length > 2 && (
													<>
														<BreadcrumbSeparator className="text-panel-text-muted">→</BreadcrumbSeparator>
														<BreadcrumbItem>
															<BreadcrumbEllipsisDropdown
																items={breadcrumbItems.slice(1, -1)}
																onNavigate={(path) => navigate(path)}
															/>
														</BreadcrumbItem>
													</>
												)}
												{breadcrumbItems.length > 1 && (
													<>
														<BreadcrumbSeparator className="text-panel-text-muted">→</BreadcrumbSeparator>
														<BreadcrumbItem className={canTruncateLastCrumb ? "min-w-0" : "shrink-0"}>
															<BreadcrumbPage
																className={cn(
																	"text-xs font-semibold text-panel-text-secondary md:text-sm",
																	canTruncateLastCrumb && "truncate max-w-[120px]",
																)}
															>
																{breadcrumbItems[breadcrumbItems.length - 1].label}
															</BreadcrumbPage>
														</BreadcrumbItem>
													</>
												)}
											</>
										) : (
											breadcrumbItems.map((item, index) => {
												const isLast = index === breadcrumbItems.length - 1;
												return (
													<React.Fragment key={`${item.label}-${index}`}>
														{index > 0 && (
															<BreadcrumbSeparator className="text-panel-text-muted">→</BreadcrumbSeparator>
														)}
														<BreadcrumbItem className={isLast ? "min-w-0" : "shrink-0"}>
															{isLast ? (
																<BreadcrumbPage
																	className={cn(
																		"text-xs font-semibold text-panel-text-secondary md:text-sm",
																		canTruncateLastCrumb && "truncate max-w-[140px]",
																	)}
																>
																	{item.label}
																</BreadcrumbPage>
															) : (
																<BreadcrumbLink asChild>
																	<button
																		type="button"
																		onClick={() => item.path && navigate(item.path)}
																		className="whitespace-nowrap font-semibold text-panel-text-secondary transition-colors hover:text-panel-text"
																	>
																		{item.label}
																	</button>
																</BreadcrumbLink>
															)}
														</BreadcrumbItem>
													</React.Fragment>
												);
											})
										)}
									</BreadcrumbList>
								</Breadcrumb>
							)}

							{mobileHeaderItems.length > 0 && (
								<div className="block w-[160px] min-w-0 shrink sm:w-[220px] md:hidden md:w-[360px]">
									<SponsorCarousel items={mobileHeaderItems} variant="banner" />
								</div>
							)}
							{sponsorHeaderItems.length > 0 && (
								<div
									data-header-banner="true"
									className={cn(
										"hidden min-w-0 shrink md:block",
										bannerShrinkable ? "w-[220px] max-w-[220px]" : "w-[360px] max-w-[360px]",
									)}
								>
									<SponsorCarousel items={sponsorHeaderItems} variant="banner" />
								</div>
							)}
						</div>

						<div className="flex shrink-0 items-center gap-2">
							<HeaderCalendar isCompact={calendarCompact} />
							{getUserIsSuccess && userData.username && <NotificationBell />}
							<GitHubStars />

							{getUserIsSuccess && userData.username && (
								<DropdownMenu open={userMenu.isOpen} onOpenChange={(open) => {
										if (open) userMenu.onOpen();
										else handleUserMenuClose();
									}}>
									<DropdownMenuTrigger asChild>
										<Button
											data-header-profile="true"
											aria-label={t("a11y.userMenu")}
											variant="outline"
											className="h-[34px] min-w-[34px] rounded-[12px] border-panel-border! bg-panel-surface ps-2 pe-2 text-sm font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:bg-panel-elevated hover:border-panel-border-strong! sm:pe-3"
										>
											<span className="flex items-center gap-2">
												<span
													className={cn(
														"flex size-6 shrink-0 items-center justify-center rounded-full",
														TINT_CLASS,
													)}
												>
													<PersonIcon className="size-3.5" />
												</span>
												<span className="hidden max-w-[100px] truncate sm:inline sm:max-w-[130px]">
													{userData.username}
												</span>
											</span>
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align={isRTL ? "start" : "end"} sideOffset={8} className="min-w-[236px]! rounded-[14px] border-panel-border! bg-panel-surface p-1.5 text-panel-text shadow-xl select-none">
										<div ref={userMenuContentRef}>
											<div className="mx-1.5 mt-1 mb-1.5 flex items-center gap-3 rounded-[12px] bg-panel-main px-3 py-2.5">
												<span
													className={cn(
														"flex size-9 shrink-0 items-center justify-center rounded-full",
														TINT_CLASS,
													)}
												>
													<PersonIcon className="size-5" />
												</span>
												<div className="flex min-w-0 flex-col">
													<span className="max-w-[160px] truncate text-sm font-semibold">
														{userData.username}
													</span>
													<span className="text-xs text-panel-text-secondary">
														{roleLabel}
													</span>
												</div>
											</div>

											{isMobile && (
												<div className="w-full block md:hidden">
													<HeaderCalendar inMenu={true} />
												</div>
											)}
											<Popover open={languageMenu.isOpen} onOpenChange={(open) =>
													open ? languageMenu.onOpen() : languageMenu.onClose()
												}>
												<PopoverTrigger asChild>
													<Button onClick={(event: ReactMouseEvent) => event.stopPropagation()} variant="ghost" className="h-10 w-full justify-start gap-3 rounded-[12px] bg-transparent px-3 font-medium text-panel-text hover:bg-panel-elevated focus-visible:bg-panel-elevated active:bg-panel-elevated">
														<LanguageIconStyled className="size-4 shrink-0" />
														<span className="flex min-w-0 flex-1 items-center justify-between gap-3">
															<span>{t("header.language")}</span>
															<span className="text-xs text-panel-text-secondary">
																{languageItems.find(
																	(item) => item.code === i18n.language,
																)?.label || "English"}
															</span>
														</span>
													</Button>
												</PopoverTrigger>
												<PopoverContent side={isMobile ? "bottom" : isRTL ? "left" : "right"} align="start" className="min-w-[160px]! rounded-[14px] border-panel-border! bg-panel-surface py-2 text-panel-text shadow-lg select-none">
													{languageItems.map(({ code, label, flag }) => {
														const isActiveLang = i18n.language === code;
														return (
															<button
																key={code}
																type="button"
																onClick={() => {
																	changeLanguage(code);
																	languageMenu.onClose();
																}}
																className="flex w-full items-center justify-between gap-3 px-3 py-2 text-sm text-panel-text transition-colors hover:bg-panel-elevated focus-visible:bg-panel-elevated focus-visible:outline-none"
															>
																<span className="flex items-center gap-2">
																	{code === "fa" ? (
																		<ImperialIranFlag
																			style={{ width: "16px", height: "12px" }}
																		/>
																	) : (
																		<ReactCountryFlag
																			countryCode={flag}
																			svg
																			style={{ width: "16px", height: "12px" }}
																		/>
																	)}
																	<span>{label}</span>
																</span>
																{isActiveLang && <Check width={16} />}
															</button>
														);
													})}
												</PopoverContent>
											</Popover>

											<ThemeSelector
												trigger="menuItem"
												triggerLabel={t("header.theme")}
												portalContainer={userMenuContentRef}
												onModalOpen={handleThemeModalOpen}
												onModalClose={handleThemeModalClose}
											/>

											<DropdownMenuSeparator className="my-2 opacity-60" />
											<DropdownMenuItem onSelect={async () => {
													try {
														await logoutSession();
													} finally {
														clearClientSession();
														navigate("/login");
													}
												}} className="px-3 py-1.5 text-sm text-[#E53E3E] focus:bg-[color-mix(in_srgb,#ef4444_12%,transparent)] focus:text-[#E53E3E]">
												<LogoutIcon className="size-4" />
												{t("header.logout")}
											</DropdownMenuItem>
										</div>
									</DropdownMenuContent>
								</DropdownMenu>
							)}
						</div>
					</header>

					<main className="min-h-0 flex-1 overflow-auto bg-panel-main p-3 pb-40 md:p-4 md:pb-4">
						<Outlet />
					</main>
				</div>

				{isMobile && (
					<Sheet open={sidebarDrawer.isOpen} onOpenChange={(open) =>
							open ? sidebarDrawer.onOpen() : sidebarDrawer.onClose()
						}>
						<SheetContent side={isRTL ? "right" : "left"} className="rb-sidebar-drawer w-[312px] max-w-[100vw] bg-panel-sidebar">
							<SheetTitle className="sr-only">{t("a11y.toggleSidebar")}</SheetTitle>
							<div className="h-full overflow-y-auto">
								<AppSidebar
									collapsed={false}
									sponsors={sponsorSidebarLogoItems}
									sidebarBanners={sponsorSidebarBanners}
									inDrawer
									onRequestExpand={sidebarDrawer.onClose}
								/>
							</div>
						</SheetContent>
					</Sheet>
				)}

				{isMobile && (
					<>
						{showIosPrompt && (
							<div className="fixed inset-x-0 bottom-[86px] z-[2000] px-4 sm:bottom-[90px]">
								<div className="flex items-center gap-3 rounded-[20px] border border-panel-border! bg-panel-surface px-4 py-3 shadow-lg">
									<span className="flex size-8 items-center justify-center rounded-full bg-[rgba(255,255,255,0.48)] dark:bg-[rgba(255,255,255,0.16)]">
										<ShareIcon className="size-4" />
									</span>
									<div className="flex-1">
										<p className="text-sm font-semibold">{t("pwa.ios.title")}</p>
										<p className="text-xs text-[#4A5568] dark:text-[#CBD5E0]">
											{t("pwa.ios.body")}
										</p>
									</div>
									<Button onClick={() => {
											setShowIosPrompt(false);
											localStorage.setItem("ios-pwa-tip-shown", "1");
										}} variant="ghost" size="xs" className="text-sm">
										{t("pwa.ios.dismiss")}
									</Button>
								</div>
							</div>
						)}

						<div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(env(safe-area-inset-bottom)+8px)]">
							<div
								className={cn(
									"pointer-events-auto mx-auto max-w-[min(480px,100%)] rounded-[30px] border p-1.5",
									DOCK_CLASS,
								)}
							>
								<div
									className="relative flex items-center justify-between"
									dir={isRTL ? "rtl" : "ltr"}
									onPointerDown={handleNavPointerDown}
									onPointerMove={handleNavPointerMove}
									onPointerUp={handleNavPointerUp}
									onPointerCancel={handleNavPointerCancel}
									style={{ touchAction: "pan-y" }}
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
										const tabLabelClass = isSelected
											? "text-[var(--primary-500)] dark:text-[var(--primary-300)]"
											: "text-panel-text-secondary";
										const tabButtonClass = cn(
											"relative z-[1] h-auto min-h-12 min-w-0 flex-1 select-none rounded-md px-0 hover:bg-transparent focus:bg-transparent active:bg-transparent",
											isActive
												? "text-[var(--primary-500)] dark:text-[var(--primary-300)]"
												: "text-[#4A5568] dark:text-[#CBD5E0]",
										);
										const navContent = (
											<motion.div
												whileTap={reduceMotion ? undefined : { scale: 0.88 }}
												transition={tapSpring}
												className="w-full"
											>
												<div className="flex w-full flex-col items-center gap-1 py-1">
													<div className="relative grid h-8 w-14 place-items-center">
														{isSelected && (
															<motion.span
																layoutId="mobile-bottom-nav-indicator"
																transition={navSpring}
																className="absolute inset-0 rounded-[12px] bg-[color-mix(in_srgb,var(--primary-500)_12%,transparent)] dark:bg-[color-mix(in_srgb,var(--primary-300)_20%,transparent)]"
															/>
														)}
														<div
															className={cn(
																"relative grid place-items-center",
																tabLabelClass,
															)}
														>
															<motion.span
																initial={false}
																animate={{
																	opacity: isSelected ? 0 : 1,
																	scale: isSelected ? 0.8 : 1,
																}}
																transition={navSpring}
																className="grid place-items-center [grid-area:1/1]"
															>
																<OutlineTabIcon className="size-[22px]" />
															</motion.span>
															<motion.span
																initial={false}
																animate={{
																	opacity: isSelected ? 1 : 0,
																	scale: isSelected ? 1 : 0.8,
																}}
																transition={navSpring}
																className="grid place-items-center [grid-area:1/1]"
															>
																<SolidTabIcon className="size-[22px]" />
															</motion.span>
														</div>
													</div>
													<span
														className={cn(
															"max-w-full truncate px-1 text-center text-[10px] leading-[1.1] transition-colors duration-[250ms]",
															tabLabelClass,
															isSelected ? "font-semibold" : "font-medium",
														)}
													>
														{settingsLabel}
													</span>
												</div>
											</motion.div>
										);

										if (item.key === "settings") {
											return (
												<Popover key={item.key} open={settingsMenu.isOpen} onOpenChange={(open) => {
														if (open) openSettingsMenu();
														else handleSettingsMenuClose();
													}}>
													<PopoverTrigger asChild>
														<Button ref={(node) => {
																tabContentRefs.current[item.key] = node;
															}} onClick={(event) => {
																event.preventDefault();
																if (settingsHoldOpened.current) return;
																handleSettingsMenuToggle();
															}} onPointerDown={(event) => {
																if (event.pointerType === "mouse") return;
																settingsHoldStartPoint.current = {
																	x: event.clientX,
																	y: event.clientY,
																};
																handleSettingsHoldStart();
															}} onPointerMove={(event) => {
																if (event.pointerType === "mouse") return;
																handleSettingsHoldMove(event.clientX, event.clientY);
															}} onPointerUp={handleSettingsHoldEnd} onPointerCancel={handleSettingsHoldEnd} onPointerLeave={handleSettingsHoldEnd} onContextMenu={(event) => {
																if (isMobile) event.preventDefault();
															}} variant="ghost" size="sm" className={tabButtonClass}>
															{navContent}
														</Button>
													</PopoverTrigger>
													<PopoverContent side="top" align="center" sideOffset={12} collisionPadding={12} className={cn(
															"w-[min(210px,calc(100vw_-_24px))] max-w-[calc(100vw_-_24px)] max-h-[calc(100vh_-_160px)] overflow-y-auto rounded-[22px] p-2",
															DOCK_CLASS,
														)}>
														<div className="flex flex-col gap-1">
															{settingsMenuItems.map((entry) => {
																const ItemIcon = entry.icon;
																const isSelected = activeSettingsKey === entry.key;
																return (
																	<Button key={entry.key} aria-current={isSelected ? "page" : undefined} onClick={() => {
																			handleSettingsMenuClose();
																			navigateToSettingsItem(entry.to);
																		}} variant="ghost" size="xs" className={cn(
																			"w-full justify-start text-sm",
																			isSelected
																				? "bg-panel-elevated font-semibold"
																				: "bg-transparent font-normal",
																			isSelected || activeSettingsKey
																				? "hover:bg-panel-elevated"
																				: "hover:bg-transparent",
																			"active:bg-panel-elevated focus-visible:shadow-[0_0_0_2px_var(--primary-200)]",
																		)}>
																		{ItemIcon ? <ItemIcon className="size-4" /> : null}
																		{entry.label}
																	</Button>
																);
															})}
														</div>
													</PopoverContent>
												</Popover>
											);
										}

										if (item.key === "myaccount") {
											return (
												<Popover key={item.key} open={accountMenu.isOpen} onOpenChange={(open) => {
														if (!open) handleAccountMenuClose();
													}}>
													<PopoverTrigger asChild>
														<Button ref={(node) => {
																tabContentRefs.current[item.key] = node;
															}} onClick={(event) => {
																event.preventDefault();
																if (accountHoldOpened.current) return;
																handleAccountMenuClose();
																handleNavClick(item.to);
															}} onPointerDown={(event) => {
																if (event.pointerType === "mouse") return;
																accountHoldStartPoint.current = {
																	x: event.clientX,
																	y: event.clientY,
																};
																handleAccountHoldStart();
															}} onPointerMove={(event) => {
																if (event.pointerType === "mouse") return;
																handleAccountHoldMove(event.clientX, event.clientY);
															}} onPointerUp={handleAccountHoldEnd} onPointerCancel={handleAccountHoldEnd} onPointerLeave={handleAccountHoldEnd} onContextMenu={(event) => {
																if (isMobile) event.preventDefault();
															}} variant="ghost" size="sm" className={tabButtonClass}>
															{navContent}
														</Button>
													</PopoverTrigger>
													<PopoverContent side="top" align="center" sideOffset={12} collisionPadding={12} onOpenAutoFocus={(event) => event.preventDefault()} className={cn(
															"w-[min(180px,calc(100vw_-_24px))] max-w-[calc(100vw_-_24px)] max-h-[calc(100vh_-_160px)] overflow-y-auto rounded-[22px] p-2",
															DOCK_CLASS,
														)}>
														<Button onClick={async () => {
																try {
																	await logoutSession();
																} finally {
																	clearClientSession();
																	handleAccountMenuClose();
																	navigate("/login");
																}
															}} variant="ghost" size="xs" className="w-full justify-start text-sm text-[#E53E3E] hover:bg-panel-elevated focus-visible:bg-panel-elevated active:bg-panel-elevated">
															<LogoutIcon className="size-4" />
															{t("header.logout")}
														</Button>
													</PopoverContent>
												</Popover>
											);
										}

										return (
											<Button key={item.key} ref={(node) => {
													tabContentRefs.current[item.key] = node;
												}} onClick={() => {
													if (item.to) {
														handleNavClick(item.to);
													}
												}} variant="ghost" size="sm" className={tabButtonClass}>
												{navContent}
											</Button>
										);
									})}
								</div>
							</div>
						</div>
					</>
				)}
			</div>
		</>
	);
}
