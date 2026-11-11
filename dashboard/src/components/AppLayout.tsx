import { useQuery } from "@tanstack/react-query";
import {
	Breadcrumb,
	BreadcrumbEllipsisDropdown,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "components/ui/breadcrumb";
import { Button } from "components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "components/ui/popover";
import { Sheet, SheetContent, SheetTitle } from "components/ui/sheet";
import { motion, useReducedMotion } from "framer-motion";
import { useDisclosure } from "hooks/useDisclosure";
import useGetUser from "hooks/useGetUser";
import { useMediaQuery } from "hooks/useMediaQuery";
import { useSheetSwipeToClose } from "hooks/useSheetSwipeToClose";
import { cn } from "lib/cn";
import { EDITOR_PAGE_ID, useActiveEntityPage } from "lib/entityPages";
import {
	ArrowLeftRight,
	Bell,
	BookOpen,
	Briefcase,
	Check,
	CircleUser,
	Clock,
	Copy,
	Database,
	Eye,
	FileText,
	FolderTree,
	House,
	Languages,
	LayoutGrid,
	Link,
	LogOut,
	Server,
	Settings,
	Settings2,
	Share,
	SquareCode,
	Terminal,
	TriangleAlert,
	Users,
	Wrench,
	Zap,
} from "lucide-react";
import {
	type CSSProperties,
	type ElementType,
	type MouseEvent as ReactMouseEvent,
	type PointerEvent as ReactPointerEvent,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import ReactCountryFlag from "react-country-flag";
import { useTranslation } from "react-i18next";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { logout as logoutSession } from "service/auth";
import { getSponsors, type SponsorAsset } from "service/sponsors";
import { AdminRole, AdminSection, AdminSudoScope } from "types/Admin";
import { clearClientSession } from "utils/session";
import ImperialIranFlag from "../assets/imperial-iran-flag.svg?react";
import { AppSidebar } from "./AppSidebar";
import { HeaderCalendar } from "./HeaderCalendar";
import {
	NotificationMenuItem,
	NotificationProvider,
	useNotificationCenter,
} from "./NotificationBell";
import { SponsorCarousel } from "./SponsorCarousel";
import ThemeSelector from "./ThemeSelector";

const TAB_ICONS: Record<string, ElementType> = {
	dashboard: House,
	users: Users,
	admins: Briefcase,
	settings: Settings,
	myaccount: CircleUser,
	notifications: Bell,
};

const TINT_CLASS =
	"bg-[color-mix(in_srgb,var(--primary-500)_12%,transparent)] text-[var(--primary-500)] dark:bg-[color-mix(in_srgb,var(--primary-300)_20%,transparent)] dark:text-[var(--primary-300)]";

const DOCK_SURFACE_CLASS =
	"border-panel-border! bg-panel-surface/95 shadow-[0_12px_32px_rgba(15,23,42,0.16)] dark:bg-panel-surface/95 dark:shadow-[0_12px_32px_rgba(0,0,0,0.48)]";

type SettingsMenuItem = {
	key: string;
	label: string;
	to: string;
	icon?: ElementType;
	section: "infrastructure" | "observability" | "system" | "docs";
};

type BottomNavItem = {
	key: string;
	label: string;
	to?: string;
	kind?: "menu" | "link";
};

const AnimatedHamburger = ({
	isOpen,
	isRTL,
}: {
	isOpen: boolean;
	isRTL?: boolean;
}) => (
	<svg
		width="15"
		height="15"
		viewBox="0 0 18 18"
		fill="none"
		stroke="currentColor"
		strokeWidth="1.65"
		strokeLinecap="round"
		aria-hidden="true"
		style={{ transform: isRTL ? "scaleX(-1)" : undefined }}
	>
		<motion.line
			x1="3"
			y1="6.5"
			x2="15"
			y2="6.5"
			initial={false}
			animate={{ x2: isOpen ? 10 : 15 }}
			transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
		/>
		<motion.line
			x1="3"
			y1="11.5"
			x2="15"
			y2="11.5"
			initial={false}
			animate={{ x2: isOpen ? 15 : 11 }}
			transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
		/>
	</svg>
);

let textMeasureCanvas: HTMLCanvasElement | null = null;
const measureBreadcrumbLabel = (text: string, isPage: boolean): number => {
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
	ctx.font = `${isPage ? "600" : "500"} 12.5px "Arad", "Inter", system-ui, -apple-system, sans-serif`;
	return Math.ceil(ctx.measureText(text).width);
};

function AppLayoutContent() {
	const { unread } = useNotificationCenter();
	const editorPageSection = useActiveEntityPage((state) => state.section);
	const editorPageTitle = useActiveEntityPage((state) => state.title);
	const mainRef = useRef<HTMLElement>(null);
	const listScrollTop = useRef(0);
	useLayoutEffect(() => {
		if (mainRef.current) {
			mainRef.current.scrollTop = editorPageSection ? 0 : listScrollTop.current;
		}
	}, [editorPageSection]);

	const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
	const handleSidebarExpand = useCallback(() => setSidebarCollapsed(false), []);
	const isMobile = !useMediaQuery("(min-width: 48em)");
	const sidebarDrawer = useDisclosure();
	const handleDrawerClose = useCallback(
		() => sidebarDrawer.onClose(),
		[sidebarDrawer],
	);
	useSheetSwipeToClose();

	useEffect(() => {
		if (typeof document === "undefined" || !document.body) return;
		if (sidebarCollapsed && !isMobile) {
			document.body.setAttribute("data-sidebar-collapsed", "true");
		} else {
			document.body.removeAttribute("data-sidebar-collapsed");
		}
		return () => {
			document.body?.removeAttribute("data-sidebar-collapsed");
		};
	}, [sidebarCollapsed, isMobile]);

	const userMenu = useDisclosure();
	const accountMenu = useDisclosure();
	const settingsMenu = useDisclosure();
	const [activeProfileSubmenu, setActiveProfileSubmenu] = useState<
		"notifications" | "language" | "theme" | "calendar" | null
	>(null);
	const [pressingProfileSubmenu, setPressingProfileSubmenu] = useState<
		"notifications" | "language" | "theme" | "calendar" | null
	>(null);
	const profileSubmenuTimerRef = useRef<number | null>(null);

	useEffect(() => {
		return () => {
			if (profileSubmenuTimerRef.current) {
				window.clearTimeout(profileSubmenuTimerRef.current);
			}
		};
	}, []);

	const { t, i18n } = useTranslation();
	const { userData, getUserIsSuccess } = useGetUser();
	const cachedRole = useMemo(() => {
		try {
			return localStorage.getItem("rb-user-role");
		} catch {
			return null;
		}
	}, []);
	const effectiveRole = getUserIsSuccess
		? userData.role
		: (cachedRole as AdminRole | null);
	const canSeeSponsors =
		effectiveRole === AdminRole.FullAccess || effectiveRole === AdminRole.Sudo;

	useEffect(() => {
		if (getUserIsSuccess && userData.role) {
			try {
				localStorage.setItem("rb-user-role", userData.role);
			} catch {}
		}
	}, [getUserIsSuccess, userData.role]);

	const sponsorsQuery = useQuery({
		queryKey: ["sponsors"],
		queryFn: getSponsors,
		staleTime: 5 * 60 * 1000,
		gcTime: 30 * 60 * 1000,
		retry: false,
		enabled: canSeeSponsors,
		initialData: () => {
			try {
				const raw = sessionStorage.getItem("rb-sponsors-cache");
				return raw ? JSON.parse(raw) : undefined;
			} catch {
				return undefined;
			}
		},
		initialDataUpdatedAt: 0,
	});

	useEffect(() => {
		if (sponsorsQuery.data && canSeeSponsors) {
			try {
				sessionStorage.setItem(
					"rb-sponsors-cache",
					JSON.stringify(sponsorsQuery.data),
				);
			} catch {}
		}
	}, [sponsorsQuery.data, canSeeSponsors]);

	const sponsorData = canSeeSponsors ? sponsorsQuery.data : undefined;
	const sponsorHeaderItems = useMemo(
		() =>
			(sponsorData?.header ?? []).slice(0, 3).map((asset: SponsorAsset) => ({
				id: asset.id,
				src: asset.image_url,
				alt: asset.alt || asset.label || "Sponsor",
				href: asset.target_url,
				label: asset.label,
				isSponsor: true,
			})),
		[sponsorData?.header],
	);
	const sponsorHeaderMobileItems = useMemo(
		() =>
			(sponsorData?.header_mobile ?? [])
				.slice(0, 3)
				.map((asset: SponsorAsset) => ({
					id: asset.id,
					src: asset.image_url,
					alt: asset.alt || asset.label || "Sponsor",
					href: asset.target_url,
					label: asset.label,
					isSponsor: true,
				})),
		[sponsorData?.header_mobile],
	);
	const sponsorSidebarLogoItems = useMemo(() => {
		const extra = sponsorData as unknown as
			| { sidebarLogo?: SponsorAsset[] }
			| undefined;
		const rawLogoList: SponsorAsset[] = [
			...(sponsorData?.sidebar_logo ?? []),
			...(extra?.sidebarLogo ?? []),
			...(sponsorData?.sidebar ?? []).filter(
				(a: SponsorAsset) => a.placement === "sidebar_logo",
			),
		];
		return rawLogoList
			.filter((a, i, arr) => arr.findIndex((x) => x.id === a.id) === i)
			.slice(0, 5);
	}, [sponsorData]);
	const sponsorSidebarBanners = useMemo(
		() =>
			(sponsorData?.sidebar ?? [])
				.filter((a: SponsorAsset) => a.placement !== "sidebar_logo")
				.slice(0, 5),
		[sponsorData?.sidebar],
	);
	const mobileHeaderItems = useMemo(
		() =>
			sponsorHeaderMobileItems.length > 0
				? sponsorHeaderMobileItems
				: sponsorHeaderItems,
		[sponsorHeaderMobileItems, sponsorHeaderItems],
	);

	const navigate = useNavigate();
	const location = useLocation();
	const [activeLocationHash, setActiveLocationHash] = useState(
		() => window.location.hash,
	);
	const isRTL = i18n.dir(i18n.language) === "rtl";
	const tutorialsUrl = "/tutorials";
	const sectionAccess = userData.permissions?.sections;
	const headerRef = useRef<HTMLElement | null>(null);
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
		: { type: "spring" as const, stiffness: 320, damping: 32, mass: 0.8 };
	const tapSpring = reduceMotion
		? { duration: 0 }
		: { type: "spring" as const, stiffness: 520, damping: 32, mass: 0.6 };

	const [calendarCompact, setCalendarCompact] = useState(false);
	const [breadcrumbMode, setBreadcrumbMode] = useState<
		"full" | "compact" | "minimal"
	>("full");
	const [bannerShrinkable, setBannerShrinkable] = useState(false);
	const [canTruncateLastCrumbState, setCanTruncateLastCrumbState] =
		useState(false);
	const [bannerDimensions, setBannerDimensions] = useState({
		natural: 220,
		half: 110,
	});
	const canTruncateLastCrumb =
		canTruncateLastCrumbState && calendarCompact && breadcrumbMode === "minimal";

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

	const toggleProfileSubmenu = useCallback(
		(target: "notifications" | "language" | "theme" | "calendar") => {
			if (profileSubmenuTimerRef.current) {
				window.clearTimeout(profileSubmenuTimerRef.current);
				profileSubmenuTimerRef.current = null;
			}

			if (activeProfileSubmenu === target) {
				setActiveProfileSubmenu(null);
				setPressingProfileSubmenu(null);
				return;
			}

			setPressingProfileSubmenu(target);
			profileSubmenuTimerRef.current = window.setTimeout(() => {
				setPressingProfileSubmenu(null);
				setActiveProfileSubmenu(target);
			}, 90);
		},
		[activeProfileSubmenu],
	);

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
			isPrivilegedAdmin && sectionAccess?.[AdminSection.Nodes]
				? {
						key: "node-settings",
						label: t("header.nodeSettings"),
						to: "/node-settings",
						icon: Server,
						section: "infrastructure",
					}
				: null,
			isPrivilegedAdmin && sectionAccess?.[AdminSection.Hosts]
				? {
						key: "hosts",
						label: t("header.hostSettings"),
						to: "/hosts",
						icon: Link,
						section: "infrastructure",
					}
				: null,
			isPrivilegedAdmin && sectionAccess?.[AdminSection.Services]
				? {
						key: "services",
						label: t("services.title"),
						to: "/services",
						icon: LayoutGrid,
						section: "infrastructure",
					}
				: null,
			isPrivilegedAdmin && sectionAccess?.[AdminSection.Xray]
				? {
						key: "xray-settings",
						label: t("header.xraySettings"),
						to: "/xray-settings",
						icon: Wrench,
						section: "infrastructure",
					}
				: null,
			isPrivilegedAdmin
				? {
						key: "haproxy",
						label: t("haproxy.title"),
						to: "/haproxy",
						icon: ArrowLeftRight,
						section: "infrastructure",
					}
				: null,
			isPrivilegedAdmin && sectionAccess?.[AdminSection.Xray]
				? {
						key: "xray-logs",
						label: t("pages.xray.logs"),
						to: "/xray-logs",
						icon: FileText,
						section: "observability",
					}
				: null,
			isPrivilegedAdmin
				? {
						key: "errors",
						label: t("diagnostics.menu"),
						to: "/errors",
						icon: TriangleAlert,
						section: "observability",
					}
				: null,
			isPrivilegedAdmin && sectionAccess?.[AdminSection.Xray]
				? {
						key: "access-insights",
						label: t("header.accessInsights"),
						to: "/access-insights",
						icon: Eye,
						section: "observability",
					}
				: null,
			canViewRecentActions
				? {
						key: "recent-actions",
						label: t("recentActions.title"),
						to: "/recent-actions",
						icon: Clock,
						section: "observability",
					}
				: null,
			{
				key: "groups",
				label: t("groups.title"),
				to: "/groups",
				icon: FolderTree,
				section: "system",
			},
			{
				key: "bulk-actions",
				label: t("bulkActions.menu"),
				to: "/bulk-actions",
				icon: Zap,
				section: "system",
			},
			isPrivilegedAdmin && sectionAccess?.[AdminSection.Integrations]
				? {
						key: "settings",
						label: t("header.integrationSettings"),
						to: "/settings",
						icon: Settings2,
						section: "system",
					}
				: null,
			canManagePlaceholders
				? {
						key: "placeholders",
						label: isPrivilegedAdmin
							? t("placeholders.menu")
							: t("placeholders.settingsMenu"),
						to: "/placeholders",
						icon: Copy,
						section: "system",
					}
				: null,
			isPrivilegedAdmin
				? {
						key: "phpmyadmin",
						label: t("phpmyadmin.menu"),
						to: "/phpmyadmin",
						icon: Database,
						section: "system",
					}
				: null,
			isPrivilegedAdmin
				? {
						key: "external-apps",
						label: t("externalApps.menu"),
						to: "/external-apps",
						icon: Terminal,
						section: "system",
					}
				: null,
			isPrivilegedAdmin
				? {
						key: "api-docs",
						label: t("apiDocs.menu"),
						to: "/api-docs",
						icon: SquareCode,
						section: "docs",
					}
				: null,
			{
				key: "tutorials",
				label: t("sidebar.tutorialsAndFaq", t("tutorials.menu")),
				to: tutorialsUrl,
				icon: BookOpen,
				section: "docs",
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

	const groupedSettingsMenu = useMemo(() => {
		const groups: Array<{
			id: SettingsMenuItem["section"];
			title: string;
			items: SettingsMenuItem[];
		}> = [
			{
				id: "infrastructure",
				title: t("sidebar.sections.infrastructure", "Infrastructure"),
				items: [],
			},
			{
				id: "observability",
				title: t("sidebar.groups.observability", "Monitoring & Logs"),
				items: [],
			},
			{
				id: "system",
				title: t("sidebar.groups.system", "System"),
				items: [],
			},
			{
				id: "docs",
				title: t("sidebar.sections.docs", "Resources"),
				items: [],
			},
		];
		for (const item of settingsMenuItems) {
			groups.find((g) => g.id === item.section)?.items.push(item);
		}
		return groups.filter((g) => g.items.length > 0);
	}, [settingsMenuItems, t]);

	const hasSettingsMenu = settingsMenuItems.length > 0;

	const closeUserMenu = useCallback(() => {
		userMenu.onClose();
		setActiveProfileSubmenu(null);
		setPressingProfileSubmenu(null);
	}, [userMenu]);

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
			{ key: "users", label: t("users"), to: "/users" },
		];
		if (canSeeAdmins) {
			items.push({ key: "admins", label: t("admins"), to: "/admins" });
		}
		if (items.length + 3 + (hasSettingsMenu ? 1 : 0) <= 5) {
			items.push({
				key: "notifications",
				label: t("notifications.menu"),
				to: "/notifications",
			});
		}
		items.push({
			key: "myaccount",
			label: t("myaccount.menu"),
			to: "/myaccount",
		});
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
			if (
				key &&
				key !== activeTabKey &&
				target?.to &&
				!accountHoldOpened.current
			) {
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
		if (!to) return;
		if (Date.now() < suppressNavClickUntil.current) return;
		if (navDragRef.current.active || isNavDragging) return;
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
				{ label: t("sidebar.groups.userHub", "User Management") },
				{ label: t("sidebar.usersList", t("users")), path: "/users" },
			];
		} else if (path === "/groups") {
			items = [
				{ label: t("dashboard"), path: "/" },
				{ label: t("sidebar.groups.userHub", "User Management") },
				{ label: t("groups.title"), path: "/groups" },
			];
		} else if (path === "/bulk-actions") {
			const bulkActionsTabs: Record<string, string> = {
				edit: t("bulkActions.tabs.edit"),
				delete: t("bulkActions.tabs.delete"),
				permissions: t("bulkActions.tabs.permissions"),
			};
			const activeBulkTab = bulkActionsTabs[hashKey];
			items = [
				{ label: t("dashboard"), path: "/" },
				{ label: t("sidebar.groups.userHub", "User Management") },
				{ label: t("bulkActions.menu"), path: "/bulk-actions" },
				...(activeBulkTab ? [{ label: activeBulkTab }] : []),
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
				{ label: t("sidebar.groups.observability", "Monitoring & Logs") },
				{ label: t("pages.xray.logs"), path: "/xray-logs" },
			];
		} else if (path === "/errors") {
			items = [
				{ label: t("dashboard"), path: "/" },
				{ label: t("sidebar.groups.observability", "Monitoring & Logs") },
				{ label: t("diagnostics.menu"), path: "/errors" },
			];
		} else if (path === "/access-insights") {
			items = [
				{ label: t("dashboard"), path: "/" },
				{ label: t("sidebar.groups.observability", "Monitoring & Logs") },
				{ label: t("header.accessInsights"), path: "/access-insights" },
			];
		} else if (path === "/recent-actions") {
			items = [
				{ label: t("dashboard"), path: "/" },
				{ label: t("sidebar.groups.observability", "Monitoring & Logs") },
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
				{ label: t("sidebar.groups.coreRouting", "Core & Routing") },
				{ label: t("header.xraySettings"), path: "/xray-settings#basic" },
				{ label: activeXrayTab },
			];
		} else if (path === "/haproxy") {
			items = [
				{ label: t("dashboard"), path: "/" },
				{ label: t("sidebar.groups.coreRouting", "Core & Routing") },
				{ label: t("haproxy.title"), path: "/haproxy" },
			];
		} else if (path === "/notifications") {
			items = [
				{ label: t("dashboard"), path: "/" },
				{ label: t("sidebar.groups.system", "System") },
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
				{ label: t("sidebar.groups.system", "System") },
				{ label: t("header.integrationSettings"), path: "/settings#panel" },
				{ label: activeSettingsTab },
			];
		} else if (path === "/placeholders") {
			items = [
				{ label: t("dashboard"), path: "/" },
				{ label: t("sidebar.groups.system", "System") },
				{ label: t("placeholders.menu"), path: "/placeholders" },
			];
		} else if (path === "/phpmyadmin") {
			items = [
				{ label: t("dashboard"), path: "/" },
				{ label: t("sidebar.groups.system", "System") },
				{ label: t("phpmyadmin.menu"), path: "/phpmyadmin" },
			];
		} else if (path === "/external-apps") {
			items = [
				{ label: t("dashboard"), path: "/" },
				{ label: t("sidebar.groups.system", "System") },
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
				{
					label: t("sidebar.tutorialsAndFaq", t("tutorials.menu")),
					path: "/tutorials",
				},
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

		if (editorPageTitle) {
			items = [...items, { label: editorPageTitle }];
		}

		return items;
	}, [location.pathname, activeLocationHash, editorPageTitle, t]);

	const navigateToSettingsItem = (target: string) => {
		handleSettingsMenuClose();
		setPreviewTabKeySafe("settings");
		const defaultTab = settingsDefaultTabByPath[target];
		if (defaultTab) {
			navigate(`${target}#${defaultTab}`);
			return;
		}
		navigate(target);
	};

	useEffect(() => {
		const firstBannerSrc = sponsorHeaderItems[0]?.src;
		if (!firstBannerSrc) return;
		const probe = new Image();
		const update = () => {
			if (probe.naturalWidth && probe.naturalHeight) {
				const natural = Math.round(
					(probe.naturalWidth / probe.naturalHeight) * 38,
				);
				const half = Math.max(90, Math.round(natural / 2));
				setBannerDimensions((prev) => {
					if (prev.natural === natural && prev.half === half) return prev;
					return { natural, half };
				});
			}
		};
		probe.onload = update;
		probe.src = firstBannerSrc;
		if (probe.complete) update();
	}, [sponsorHeaderItems[0]?.src]);

	useEffect(() => {
		const headerEl = headerRef.current;
		if (!headerEl) return;

		const checkFit = () => {
			if (!headerRef.current) return;
			const totalWidth = headerRef.current.clientWidth;
			const hasBanner = sponsorHeaderItems.length > 0;
			const bannerImg = headerRef.current.querySelector<HTMLImageElement>(
				"[data-header-banner] img",
			);
			let naturalBannerWidth = 0;
			if (hasBanner) {
				if (bannerImg?.naturalWidth && bannerImg.naturalHeight) {
					naturalBannerWidth = Math.round(
						(bannerImg.naturalWidth / bannerImg.naturalHeight) * 38,
					);
				} else {
					naturalBannerWidth = bannerDimensions.natural;
				}
			}
			const bannerWidth = hasBanner ? naturalBannerWidth + 2 : 0;
			const minBannerWidth = hasBanner
				? Math.max(Math.round(naturalBannerWidth * 0.5), 60)
				: 0;

			const profileEl = headerRef.current.querySelector<HTMLElement>(
				"[data-header-profile]",
			);
			const profileWidth = profileEl ? profileEl.offsetWidth : 90;
			const isFa = i18n.language?.startsWith("fa");
			const fullCalendarWidth = isFa ? 184 : 200;
			const compactCalendarWidth = 34;
			const compactControlsWidth = compactCalendarWidth + 8 + profileWidth;
			const fullControlsWidth = fullCalendarWidth + 8 + profileWidth;

			const navButtonWidth = 34;
			const isDesktop = window.innerWidth >= 768;
			const headerPadding = isDesktop ? 40 : 24;
			const hstackGap = 12;
			const navDividerGaps = 25;
			const bannerGap = hasBanner ? 10 : 0;

			const fixedOverheadFull =
				headerPadding +
				hstackGap +
				navButtonWidth +
				navDividerGaps +
				bannerGap +
				fullControlsWidth;
			const fixedOverheadCompact =
				headerPadding +
				hstackGap +
				navButtonWidth +
				navDividerGaps +
				bannerGap +
				compactControlsWidth;

			const spaceFullCalendar = totalWidth - fixedOverheadFull;
			const spaceCompactCalendar = totalWidth - fixedOverheadCompact;

			const crumbCount = breadcrumbItems.length;
			const fullBreadcrumbWidth =
				crumbCount === 0
					? 0
					: crumbCount === 1
						? measureBreadcrumbLabel(breadcrumbItems[0]?.label || "", true)
						: breadcrumbItems.reduce((acc, item, idx) => {
								const isLast = idx === crumbCount - 1;
								return (
									acc +
									measureBreadcrumbLabel(item.label || "", isLast) +
									(idx > 0 ? 24 : 0)
								);
							}, 0);

			const compactBreadcrumbWidth =
				crumbCount <= 2
					? fullBreadcrumbWidth
					: measureBreadcrumbLabel(breadcrumbItems[0]?.label || "", false) +
						24 +
						22 +
						24 +
						measureBreadcrumbLabel(
							breadcrumbItems[crumbCount - 1]?.label || "",
							true,
						);

			const minimalBreadcrumbWidth =
				crumbCount <= 1
					? measureBreadcrumbLabel(breadcrumbItems[0]?.label || "", true)
					: 22 +
						24 +
						measureBreadcrumbLabel(
							breadcrumbItems[crumbCount - 1]?.label || "",
							true,
						);

			const buffer = 20;
			const stage1Needed = fullBreadcrumbWidth + bannerWidth + buffer;
			const stage2Needed = fullBreadcrumbWidth + bannerWidth + buffer;
			const stage3Needed = compactBreadcrumbWidth + bannerWidth + buffer;
			const stage4Needed = minimalBreadcrumbWidth + bannerWidth + buffer;
			const stage5Needed = minimalBreadcrumbWidth + minBannerWidth + buffer;

			let nextCalendarCompact = true;
			let nextBreadcrumbMode: "full" | "compact" | "minimal" = "minimal";
			let nextBannerShrinkable = false;
			let nextTruncate = true;

			if (spaceFullCalendar >= stage1Needed) {
				nextCalendarCompact = false;
				nextBreadcrumbMode = "full";
				nextBannerShrinkable = false;
				nextTruncate = false;
			} else if (spaceCompactCalendar >= stage2Needed) {
				nextCalendarCompact = true;
				nextBreadcrumbMode = "full";
				nextBannerShrinkable = false;
				nextTruncate = false;
			} else if (spaceCompactCalendar >= stage3Needed) {
				nextCalendarCompact = true;
				nextBreadcrumbMode = "compact";
				nextBannerShrinkable = false;
				nextTruncate = false;
			} else if (spaceCompactCalendar >= stage4Needed) {
				nextCalendarCompact = true;
				nextBreadcrumbMode = "minimal";
				nextBannerShrinkable = false;
				nextTruncate = false;
			} else if (hasBanner && spaceCompactCalendar >= stage5Needed) {
				nextCalendarCompact = true;
				nextBreadcrumbMode = "minimal";
				nextBannerShrinkable = true;
				nextTruncate = false;
			} else {
				nextCalendarCompact = true;
				nextBreadcrumbMode = "minimal";
				nextBannerShrinkable = hasBanner;
				nextTruncate = true;
			}

			setCalendarCompact((prev) =>
				prev !== nextCalendarCompact ? nextCalendarCompact : prev,
			);
			setBreadcrumbMode((prev) =>
				prev !== nextBreadcrumbMode ? nextBreadcrumbMode : prev,
			);
			setBannerShrinkable((prev) =>
				prev !== nextBannerShrinkable ? nextBannerShrinkable : prev,
			);
			setCanTruncateLastCrumbState((prev) =>
				prev !== nextTruncate ? nextTruncate : prev,
			);
		};
		const timer = window.setTimeout(checkFit, 20);
		const ro = new ResizeObserver(checkFit);
		ro.observe(headerEl);
		return () => {
			window.clearTimeout(timer);
			ro.disconnect();
		};
	}, [
		sponsorHeaderItems.length,
		breadcrumbItems,
		i18n.language,
		bannerDimensions.natural,
	]);

	return (
		<>
			<div aria-hidden="true" className="hidden">
				<ThemeSelector minimal trigger="icon" />
			</div>
			<div
				dir={isRTL ? "rtl" : "ltr"}
				className={cn(
					"flex h-[100dvh] max-h-[100dvh] min-h-[100dvh] overflow-hidden bg-panel-app md:h-[100vh] md:max-h-[100vh] md:min-h-[100vh]",
					isRTL ? "flex-row-reverse" : "flex-row",
				)}
				style={
					{
						"--rb-sidebar-offset": isMobile
							? "0px"
							: sidebarCollapsed
								? "88px"
								: "calc(var(--rb-sidebar-width, 240px) + 20px)",
					} as CSSProperties
				}
			>
				{!isMobile ? (
					<AppSidebar
						collapsed={sidebarCollapsed}
						sponsors={sponsorSidebarLogoItems}
						sidebarBanners={sponsorSidebarBanners}
						onRequestExpand={handleSidebarExpand}
					/>
				) : null}

				<div
					ref={contentRef}
					className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-panel-main transition-[margin] duration-[220ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
					style={{
						marginLeft:
							isMobile || isRTL
								? "0px"
								: sidebarCollapsed
									? "88px"
									: "calc(var(--rb-sidebar-width, 240px) + 20px)",
						marginRight:
							isMobile || !isRTL
								? "0px"
								: sidebarCollapsed
									? "88px"
									: "calc(var(--rb-sidebar-width, 240px) + 20px)",
					}}
				>
					<div className="relative z-[100] shrink-0">
						<header
							ref={headerRef}
							dir={isRTL ? "rtl" : "ltr"}
							className="mx-3 mt-3 flex h-[52px] min-h-[52px] items-center justify-between gap-3 overflow-hidden rounded-[18px] border border-panel-border! bg-panel-surface px-3 shadow-[0_1px_2px_rgba(0,0,0,0.03),inset_0_1px_0_0_rgba(255,255,255,0.75)] select-none md:mx-4 md:px-5 dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]"
						>
							<div className="flex h-full min-w-0 flex-1 items-center gap-2.5 overflow-hidden">
								<button
									type="button"
									aria-label={t("a11y.toggleSidebar")}
									onClick={() => {
										if (isMobile) sidebarDrawer.onOpen();
										else setSidebarCollapsed(!sidebarCollapsed);
									}}
									className="inline-flex size-[34px] min-w-[34px] shrink-0 items-center justify-center rounded-full border border-panel-border! bg-panel-surface text-panel-text-secondary transition-[background-color,border-color,color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] outline-none active:scale-[0.95] focus-visible:ring-2 focus-visible:ring-panel-accent/50 md:rounded-[12px] md:hover:border-panel-border-strong! md:hover:bg-panel-elevated md:hover:text-panel-text"
								>
									<AnimatedHamburger
										isOpen={isMobile ? sidebarDrawer.isOpen : !sidebarCollapsed}
										isRTL={isRTL}
									/>
								</button>

								<span
									aria-hidden="true"
									className="mx-0.5 hidden h-4 w-px shrink-0 bg-panel-border md:block"
								/>

								<Breadcrumb
									data-header-breadcrumb="true"
									dir={isRTL ? "rtl" : "ltr"}
									className={cn(
										"hidden md:flex",
										canTruncateLastCrumb
											? "min-w-0 shrink overflow-hidden"
											: "min-w-fit shrink-0 overflow-visible",
									)}
								>
									<BreadcrumbList
										className={cn(
											canTruncateLastCrumb ? "min-w-0" : "min-w-fit",
										)}
									>
										{breadcrumbItems.length === 1 ? (
											<BreadcrumbItem
												className={cn(
													canTruncateLastCrumb
														? "min-w-0 shrink"
														: "min-w-fit shrink-0",
												)}
											>
												<BreadcrumbPage isTruncated={canTruncateLastCrumb}>
													{breadcrumbItems[0].label}
												</BreadcrumbPage>
											</BreadcrumbItem>
										) : null}

										{breadcrumbItems.length === 2 ? (
											breadcrumbMode === "minimal" ? (
												<>
													<BreadcrumbItem className="shrink-0">
														<BreadcrumbEllipsisDropdown
															items={[breadcrumbItems[0]]}
															onNavigate={(path) => navigate(path)}
														/>
													</BreadcrumbItem>
													<BreadcrumbSeparator />
													<BreadcrumbItem
														className={cn(
															canTruncateLastCrumb
																? "min-w-0 shrink"
																: "min-w-fit shrink-0",
														)}
													>
														<BreadcrumbPage isTruncated={canTruncateLastCrumb}>
															{breadcrumbItems[1].label}
														</BreadcrumbPage>
													</BreadcrumbItem>
												</>
											) : (
												<>
													<BreadcrumbItem className="shrink-0">
														<BreadcrumbLink
															isClickable={Boolean(breadcrumbItems[0].path)}
															onClick={() => {
																if (breadcrumbItems[0].path) {
																	navigate(breadcrumbItems[0].path);
																}
															}}
														>
															{breadcrumbItems[0].label}
														</BreadcrumbLink>
													</BreadcrumbItem>
													<BreadcrumbSeparator />
													<BreadcrumbItem
														className={cn(
															canTruncateLastCrumb
																? "min-w-0 shrink"
																: "min-w-fit shrink-0",
														)}
													>
														<BreadcrumbPage isTruncated={canTruncateLastCrumb}>
															{breadcrumbItems[1].label}
														</BreadcrumbPage>
													</BreadcrumbItem>
												</>
											)
										) : null}

										{breadcrumbItems.length === 3 ? (
											<>
												{breadcrumbMode === "full" ? (
													<>
														<BreadcrumbItem className="shrink-0">
															<BreadcrumbLink
																isClickable={Boolean(breadcrumbItems[0].path)}
																onClick={() => {
																	if (breadcrumbItems[0].path) {
																		navigate(breadcrumbItems[0].path);
																	}
																}}
															>
																{breadcrumbItems[0].label}
															</BreadcrumbLink>
														</BreadcrumbItem>
														<BreadcrumbSeparator />
														<BreadcrumbItem className="shrink-0">
															<BreadcrumbLink
																isClickable={Boolean(breadcrumbItems[1].path)}
																onClick={() => {
																	if (breadcrumbItems[1].path) {
																		navigate(breadcrumbItems[1].path);
																	}
																}}
															>
																{breadcrumbItems[1].label}
															</BreadcrumbLink>
														</BreadcrumbItem>
														<BreadcrumbSeparator />
														<BreadcrumbItem
															className={cn(
																canTruncateLastCrumb
																	? "min-w-0 shrink"
																	: "min-w-fit shrink-0",
															)}
														>
															<BreadcrumbPage
																isTruncated={canTruncateLastCrumb}
															>
																{breadcrumbItems[2].label}
															</BreadcrumbPage>
														</BreadcrumbItem>
													</>
												) : null}

												{breadcrumbMode === "compact" ? (
													<>
														<BreadcrumbItem className="shrink-0">
															<BreadcrumbLink
																isClickable={Boolean(breadcrumbItems[0].path)}
																onClick={() => {
																	if (breadcrumbItems[0].path) {
																		navigate(breadcrumbItems[0].path);
																	}
																}}
															>
																{breadcrumbItems[0].label}
															</BreadcrumbLink>
														</BreadcrumbItem>
														<BreadcrumbSeparator />
														<BreadcrumbItem className="shrink-0">
															<BreadcrumbEllipsisDropdown
																items={[breadcrumbItems[1]]}
																onNavigate={(path) => navigate(path)}
															/>
														</BreadcrumbItem>
														<BreadcrumbSeparator />
														<BreadcrumbItem
															className={cn(
																canTruncateLastCrumb
																	? "min-w-0 shrink"
																	: "min-w-fit shrink-0",
															)}
														>
															<BreadcrumbPage
																isTruncated={canTruncateLastCrumb}
															>
																{breadcrumbItems[2].label}
															</BreadcrumbPage>
														</BreadcrumbItem>
													</>
												) : null}

												{breadcrumbMode === "minimal" ? (
													<>
														<BreadcrumbItem className="shrink-0">
															<BreadcrumbEllipsisDropdown
																items={[breadcrumbItems[0], breadcrumbItems[1]]}
																onNavigate={(path) => navigate(path)}
															/>
														</BreadcrumbItem>
														<BreadcrumbSeparator />
														<BreadcrumbItem
															className={cn(
																canTruncateLastCrumb
																	? "min-w-0 shrink"
																	: "min-w-fit shrink-0",
															)}
														>
															<BreadcrumbPage
																isTruncated={canTruncateLastCrumb}
															>
																{breadcrumbItems[2].label}
															</BreadcrumbPage>
														</BreadcrumbItem>
													</>
												) : null}
											</>
										) : null}

										{breadcrumbItems.length === 4 ? (
											<>
												{breadcrumbMode === "full" ? (
													<>
														<BreadcrumbItem className="shrink-0">
															<BreadcrumbLink
																isClickable={Boolean(breadcrumbItems[0].path)}
																onClick={() => {
																	if (breadcrumbItems[0].path) {
																		navigate(breadcrumbItems[0].path);
																	}
																}}
															>
																{breadcrumbItems[0].label}
															</BreadcrumbLink>
														</BreadcrumbItem>
														<BreadcrumbSeparator />
														<BreadcrumbItem className="shrink-0">
															<BreadcrumbLink
																isClickable={Boolean(breadcrumbItems[1].path)}
																onClick={() => {
																	if (breadcrumbItems[1].path) {
																		navigate(breadcrumbItems[1].path);
																	}
																}}
															>
																{breadcrumbItems[1].label}
															</BreadcrumbLink>
														</BreadcrumbItem>
														<BreadcrumbSeparator />
														<BreadcrumbItem className="shrink-0">
															<BreadcrumbLink
																isClickable={Boolean(breadcrumbItems[2].path)}
																onClick={() => {
																	if (breadcrumbItems[2].path) {
																		navigate(breadcrumbItems[2].path);
																	}
																}}
															>
																{breadcrumbItems[2].label}
															</BreadcrumbLink>
														</BreadcrumbItem>
														<BreadcrumbSeparator />
														<BreadcrumbItem
															className={cn(
																canTruncateLastCrumb
																	? "min-w-0 shrink"
																	: "min-w-fit shrink-0",
															)}
														>
															<BreadcrumbPage
																isTruncated={canTruncateLastCrumb}
															>
																{breadcrumbItems[3].label}
															</BreadcrumbPage>
														</BreadcrumbItem>
													</>
												) : null}

												{breadcrumbMode === "compact" ? (
													<>
														<BreadcrumbItem className="shrink-0">
															<BreadcrumbLink
																isClickable={Boolean(breadcrumbItems[0].path)}
																onClick={() => {
																	if (breadcrumbItems[0].path) {
																		navigate(breadcrumbItems[0].path);
																	}
																}}
															>
																{breadcrumbItems[0].label}
															</BreadcrumbLink>
														</BreadcrumbItem>
														<BreadcrumbSeparator />
														<BreadcrumbItem className="shrink-0">
															<BreadcrumbEllipsisDropdown
																items={[breadcrumbItems[1], breadcrumbItems[2]]}
																onNavigate={(path) => navigate(path)}
															/>
														</BreadcrumbItem>
														<BreadcrumbSeparator />
														<BreadcrumbItem
															className={cn(
																canTruncateLastCrumb
																	? "min-w-0 shrink"
																	: "min-w-fit shrink-0",
															)}
														>
															<BreadcrumbPage
																isTruncated={canTruncateLastCrumb}
															>
																{breadcrumbItems[3].label}
															</BreadcrumbPage>
														</BreadcrumbItem>
													</>
												) : null}

												{breadcrumbMode === "minimal" ? (
													<>
														<BreadcrumbItem className="shrink-0">
															<BreadcrumbEllipsisDropdown
																items={[
																	breadcrumbItems[0],
																	breadcrumbItems[1],
																	breadcrumbItems[2],
																]}
																onNavigate={(path) => navigate(path)}
															/>
														</BreadcrumbItem>
														<BreadcrumbSeparator />
														<BreadcrumbItem
															className={cn(
																canTruncateLastCrumb
																	? "min-w-0 shrink"
																	: "min-w-fit shrink-0",
															)}
														>
															<BreadcrumbPage
																isTruncated={canTruncateLastCrumb}
															>
																{breadcrumbItems[3].label}
															</BreadcrumbPage>
														</BreadcrumbItem>
													</>
												) : null}
											</>
										) : null}

										{breadcrumbItems.length > 4 ? (
											breadcrumbMode === "minimal" ? (
												<>
													<BreadcrumbItem className="shrink-0">
														<BreadcrumbEllipsisDropdown
															items={breadcrumbItems.slice(0, -1)}
															onNavigate={(path) => navigate(path)}
														/>
													</BreadcrumbItem>
													<BreadcrumbSeparator />
													<BreadcrumbItem
														className={cn(
															canTruncateLastCrumb
																? "min-w-0 shrink"
																: "min-w-fit shrink-0",
														)}
													>
														<BreadcrumbPage isTruncated={canTruncateLastCrumb}>
															{
																breadcrumbItems[breadcrumbItems.length - 1]
																	.label
															}
														</BreadcrumbPage>
													</BreadcrumbItem>
												</>
											) : (
												<>
													<BreadcrumbItem className="shrink-0">
														<BreadcrumbLink
															isClickable={Boolean(breadcrumbItems[0].path)}
															onClick={() => {
																if (breadcrumbItems[0].path) {
																	navigate(breadcrumbItems[0].path);
																}
															}}
														>
															{breadcrumbItems[0].label}
														</BreadcrumbLink>
													</BreadcrumbItem>
													<BreadcrumbSeparator />
													<BreadcrumbItem className="shrink-0">
														<BreadcrumbEllipsisDropdown
															items={breadcrumbItems.slice(1, -1)}
															onNavigate={(path) => navigate(path)}
														/>
													</BreadcrumbItem>
													<BreadcrumbSeparator />
													<BreadcrumbItem
														className={cn(
															canTruncateLastCrumb
																? "min-w-0 shrink"
																: "min-w-fit shrink-0",
														)}
													>
														<BreadcrumbPage isTruncated={canTruncateLastCrumb}>
															{
																breadcrumbItems[breadcrumbItems.length - 1]
																	.label
															}
														</BreadcrumbPage>
													</BreadcrumbItem>
												</>
											)
										) : null}
									</BreadcrumbList>
								</Breadcrumb>

								{isMobile && mobileHeaderItems.length > 0 ? (
									<div
										data-header-mobile-banner="true"
										className="flex max-h-[38px] min-w-[40px] max-w-full shrink items-center justify-start overflow-hidden"
									>
										<SponsorCarousel
											items={mobileHeaderItems}
											variant="banner"
											animateIn={false}
										/>
									</div>
								) : null}

								{!isMobile && sponsorHeaderItems.length > 0 ? (
									<div
										data-header-banner="true"
										style={{
											width: bannerShrinkable
												? "100%"
												: `${bannerDimensions.natural}px`,
											maxWidth: `${bannerDimensions.natural}px`,
											minWidth: bannerShrinkable
												? `${Math.max(Math.round(bannerDimensions.natural * 0.5), 60)}px`
												: `${bannerDimensions.natural}px`,
										}}
										className={cn(
											"flex max-h-[38px] items-center justify-center overflow-hidden",
											bannerShrinkable ? "shrink" : "shrink-0",
										)}
									>
										<SponsorCarousel
											items={sponsorHeaderItems}
											variant="banner"
											animateIn={false}
										/>
									</div>
								) : null}
							</div>

							<div
								data-header-controls="true"
								className="flex h-full shrink-0 items-center gap-1.5 sm:gap-2"
							>
								<div className="hidden md:inline-flex">
									<HeaderCalendar isCompact={calendarCompact} />
								</div>

								{getUserIsSuccess && userData.username ? (
									<Popover
										open={userMenu.isOpen}
										onOpenChange={(open) => {
											if (open) userMenu.onOpen();
											else closeUserMenu();
										}}
									>
										<PopoverTrigger asChild>
											<Button
												type="button"
												data-header-profile="true"
												variant="outline"
												size="sm"
												aria-label={t("a11y.userMenu")}
												className="h-[34px] w-[34px] min-w-[34px] rounded-full border-panel-border! bg-panel-surface p-0 text-panel-text shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-[background-color,border-color,box-shadow,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] active:bg-panel-elevated md:w-auto md:min-w-0 md:rounded-[12px] md:px-3 md:hover:border-panel-border-strong! md:hover:bg-panel-elevated md:hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
											>
												<span className="flex items-center justify-center gap-2">
													<span className="relative inline-flex shrink-0 items-center justify-center">
														<CircleUser className="size-[18px] text-panel-text" />
														{unread > 0 ? (
															<span className="absolute -top-0.5 -end-0.5 size-2 rounded-full border-[1.5px] border-panel-surface bg-panel-accent" />
														) : null}
													</span>
													<span
														dir="ltr"
														style={{ unicodeBidi: "isolate" }}
														className="hidden max-w-[140px] truncate text-xs font-semibold leading-normal text-panel-text md:inline"
													>
														{userData.username}
													</span>
												</span>
											</Button>
										</PopoverTrigger>
										<PopoverContent
											dir={isRTL ? "rtl" : "ltr"}
											align={isRTL ? "start" : "end"}
											sideOffset={8}
											collisionPadding={12}
											id="rb-user-menu"
											data-profile-window="true"
											data-profile-menu="true"
											onOpenAutoFocus={(e) => e.preventDefault()}
											className="z-[9999] w-[240px] min-w-[240px]! max-w-[240px] rounded-[20px] border border-panel-border! bg-panel-surface p-2 text-panel-text shadow-[0_20px_48px_rgba(0,0,0,0.34)] select-none"
										>
											<div className="mb-1.5 flex items-center gap-3 rounded-[14px] border border-panel-border! bg-panel-elevated p-2.5">
												<div className="flex size-8 shrink-0 items-center justify-center rounded-[10px] border border-panel-border! bg-panel-surface text-panel-text">
													<CircleUser className="size-[18px]" />
												</div>
												<div className="flex min-w-0 flex-col">
													<span
														dir="ltr"
														style={{ unicodeBidi: "isolate" }}
														className="truncate text-[13px] font-bold text-panel-text"
													>
														{userData.username}
													</span>
													<span className="truncate text-[11px] font-medium text-panel-text-muted">
														{roleLabel}
													</span>
												</div>
											</div>

											<div className="flex flex-col gap-0.5">
												{isMobile ? (
													<HeaderCalendar
														key={`cal-menu-${isRTL ? "rtl" : "ltr"}`}
														inMenu
														isOpen={activeProfileSubmenu === "calendar"}
														isPressing={pressingProfileSubmenu === "calendar"}
														onToggle={() => toggleProfileSubmenu("calendar")}
														onClose={() => {
															if (activeProfileSubmenu === "calendar") {
																setActiveProfileSubmenu(null);
															}
														}}
													/>
												) : null}

												<NotificationMenuItem
													key={`notif-menu-${isRTL ? "rtl" : "ltr"}`}
													onNavigate={closeUserMenu}
													isOpen={activeProfileSubmenu === "notifications"}
													isPressing={
														pressingProfileSubmenu === "notifications"
													}
													onToggle={() => toggleProfileSubmenu("notifications")}
													onClose={() => {
														if (activeProfileSubmenu === "notifications") {
															setActiveProfileSubmenu(null);
														}
													}}
												/>

												<Popover
													open={activeProfileSubmenu === "language"}
													onOpenChange={(open) => {
														if (open) {
															setActiveProfileSubmenu("language");
														} else if (activeProfileSubmenu === "language") {
															setActiveProfileSubmenu(null);
														}
													}}
												>
													<PopoverTrigger asChild>
														<button
															type="button"
															data-submenu-trigger="true"
															onClick={(event: ReactMouseEvent) => {
																event.stopPropagation();
																toggleProfileSubmenu("language");
															}}
															className={cn(
																"flex h-[38px] w-full items-center justify-between gap-2.5 rounded-[12px] px-3 text-[13px] font-medium text-panel-text transition-[background-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] outline-none select-none active:scale-[0.97] active:bg-panel-elevated focus-visible:bg-panel-elevated md:hover:bg-panel-elevated",
																pressingProfileSubmenu === "language" ||
																	activeProfileSubmenu === "language"
																	? "bg-panel-elevated"
																	: "bg-transparent",
																pressingProfileSubmenu === "language" &&
																	"scale-[0.97]",
															)}
														>
															<span className="flex min-w-0 items-center gap-2.5">
																<Languages className="size-4 shrink-0 text-panel-text" />
																<span className="truncate">
																	{t("header.language")}
																</span>
															</span>
															<span className="shrink-0 text-[11px] font-semibold text-panel-text-muted">
																{languageItems.find(
																	(item) => item.code === i18n.language,
																)?.label || "English"}
															</span>
														</button>
													</PopoverTrigger>
													<PopoverContent
														dir={isRTL ? "rtl" : "ltr"}
														side={isMobile ? "bottom" : isRTL ? "left" : "right"}
														align="start"
														sideOffset={8}
														collisionPadding={12}
														data-profile-window="true"
														data-profile-submenu="true"
														data-language-menu-list="true"
														className="z-[10005] w-auto min-w-[176px]! rounded-[20px] border border-panel-border! bg-panel-surface p-1.5 text-panel-text shadow-[0_20px_48px_rgba(0,0,0,0.35)] select-none"
													>
														<div className="flex flex-col gap-0.5">
															{languageItems.map(({ code, label, flag }) => {
																const isActiveLang = i18n.language === code;
																return (
																	<button
																		key={code}
																		type="button"
																		onClick={(e) => {
																			e.preventDefault();
																			e.stopPropagation();
																			i18n.changeLanguage(code);
																			setActiveProfileSubmenu(null);
																		}}
																		className={cn(
																			"flex h-9 w-full items-center justify-between gap-3 rounded-[10px] px-2.5 text-xs transition-[background-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] outline-none active:scale-[0.98] focus-visible:bg-panel-elevated md:hover:bg-panel-elevated",
																			isActiveLang
																				? "bg-panel-elevated font-bold text-panel-text"
																				: "font-medium text-panel-text-secondary md:hover:text-panel-text",
																		)}
																	>
																		<span className="flex items-center gap-2.5">
																			{code === "fa" ? (
																				<ImperialIranFlag
																					style={{
																						width: "16px",
																						height: "12px",
																						borderRadius: "2px",
																					}}
																				/>
																			) : (
																				<ReactCountryFlag
																					countryCode={flag}
																					svg
																					style={{
																						width: "16px",
																						height: "12px",
																						borderRadius: "2px",
																					}}
																				/>
																			)}
																			<span>{label}</span>
																		</span>
																		{isActiveLang ? (
																			<Check className="size-3.5 text-panel-accent" />
																		) : null}
																	</button>
																);
															})}
														</div>
													</PopoverContent>
												</Popover>

												<ThemeSelector
													key={`theme-menu-${isRTL ? "rtl" : "ltr"}`}
													trigger="menuItem"
													triggerLabel={t("header.theme")}
													isOpen={activeProfileSubmenu === "theme"}
													isPressing={pressingProfileSubmenu === "theme"}
													onToggle={() => toggleProfileSubmenu("theme")}
													onClose={() => {
														if (activeProfileSubmenu === "theme") {
															setActiveProfileSubmenu(null);
														}
													}}
												/>

												<div className="my-1 h-px bg-panel-border opacity-70" />

												<button
													type="button"
													onClick={async () => {
														try {
															await logoutSession();
														} finally {
															clearClientSession();
															navigate("/login");
														}
													}}
													className="flex h-[38px] w-full items-center gap-2.5 rounded-[12px] px-3 text-[13px] font-semibold text-red-400 transition-[background-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] outline-none select-none active:scale-[0.98] active:bg-red-500/20 focus-visible:bg-red-500/14 md:hover:bg-red-500/14"
												>
													<LogOut className="size-4 shrink-0" />
													<span>{t("header.logout")}</span>
												</button>
											</div>
										</PopoverContent>
									</Popover>
								) : null}
							</div>
						</header>

						<div
							aria-hidden="true"
							className="pointer-events-none absolute inset-x-0 -bottom-4 z-[99] h-4 bg-gradient-to-b from-panel-main to-transparent"
						/>
					</div>

					<main
						ref={mainRef}
						onScroll={(event) => {
							if (!editorPageSection) {
								listScrollTop.current = event.currentTarget.scrollTop;
							}
						}}
						className="min-h-0 flex-1 overflow-auto overscroll-contain bg-transparent p-3 pt-2.5 pb-40 md:p-4 md:pt-3 md:pb-4"
					>
						<div className={cn(editorPageSection && "hidden")}>
							<Outlet />
						</div>
						<div
							id={EDITOR_PAGE_ID}
							className={cn(!editorPageSection && "hidden")}
						/>
					</main>
				</div>

				{isMobile ? (
					<Sheet
						open={sidebarDrawer.isOpen}
						onOpenChange={(open) =>
							open ? sidebarDrawer.onOpen() : sidebarDrawer.onClose()
						}
					>
						<SheetContent
							side={isRTL ? "right" : "left"}
							showCloseButton={false}
							data-side={isRTL ? "right" : "left"}
							className="rb-sidebar-drawer h-[100dvh] max-h-[100dvh] w-full max-w-[100vw]! gap-0 rounded-none border-0 bg-panel-surface p-0 shadow-none sm:max-w-[100vw]!"
						>
							<SheetTitle className="sr-only">
								{t("a11y.toggleSidebar")}
							</SheetTitle>
							<div className="h-full overflow-hidden">
								<AppSidebar
									collapsed={false}
									sponsors={sponsorSidebarLogoItems}
									sidebarBanners={sponsorSidebarBanners}
									inDrawer
									onRequestExpand={handleDrawerClose}
								/>
							</div>
						</SheetContent>
					</Sheet>
				) : null}

				{isMobile ? (
					<>
						{showIosPrompt ? (
							<div className="fixed inset-x-0 bottom-[86px] z-[2000] px-4 sm:bottom-[90px]">
								<div className="flex items-center gap-3 rounded-[20px] border border-panel-border! bg-panel-surface px-4 py-3 shadow-lg">
									<span className="flex size-8 items-center justify-center rounded-full bg-panel-elevated text-panel-text">
										<Share className="size-4" />
									</span>
									<div className="flex-1">
										<p className="text-sm font-semibold">
											{t("pwa.ios.title")}
										</p>
										<p className="text-xs text-panel-text-secondary">
											{t("pwa.ios.body")}
										</p>
									</div>
									<Button
										onClick={() => {
											setShowIosPrompt(false);
											localStorage.setItem("ios-pwa-tip-shown", "1");
										}}
										variant="ghost"
										size="xs"
										className="text-sm"
									>
										{t("pwa.ios.dismiss")}
									</Button>
								</div>
							</div>
						) : null}

						<div
							className={cn(
								"rb-mobile-dock pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom,0px)+12px)] z-[1500] px-3 md:hidden",
								sidebarDrawer.isOpen && "hidden",
							)}
						>
							<div
								className={cn(
									"pointer-events-auto mx-auto max-w-[min(440px,calc(100vw-20px))] rounded-[24px] border px-2 py-1.5",
									DOCK_SURFACE_CLASS,
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
											item.key === "settings"
												? activeSettingsItem?.icon
												: undefined;
										const TabIcon = customIcon ?? TAB_ICONS[item.key] ?? CircleUser;

										const tabButtonClass = cn(
											"relative z-[1] h-auto min-h-12 min-w-0 flex-1 select-none rounded-[16px] px-0 hover:bg-transparent focus:bg-transparent active:bg-transparent",
											isActive
												? "text-panel-accent"
												: "text-panel-text-secondary",
										);

										const navContent = (
											<motion.div
												whileTap={reduceMotion ? undefined : { scale: 0.9 }}
												transition={tapSpring}
												className="w-full"
											>
												<div className="flex w-full flex-col items-center gap-0.5 py-1">
													<div className="relative grid h-7 w-12 place-items-center">
														{isSelected ? (
															<motion.span
																layoutId="mobile-bottom-nav-indicator"
																transition={navSpring}
																className={cn(
																	"absolute inset-0 rounded-[14px]",
																	TINT_CLASS,
																)}
															/>
														) : null}
														<TabIcon
															className={cn(
																"relative z-[1] size-5 transition-colors duration-200",
																isSelected
																	? "text-panel-accent"
																	: "text-panel-text-secondary",
															)}
														/>
													</div>
													<span
														className={cn(
															"max-w-full truncate px-1 text-center text-[10px] leading-[1.1] transition-colors duration-200",
															isSelected
																? "font-bold text-panel-accent"
																: "font-medium text-panel-text-secondary",
														)}
													>
														{settingsLabel}
													</span>
												</div>
											</motion.div>
										);

										if (item.key === "settings") {
											return (
												<Popover
													key={item.key}
													open={settingsMenu.isOpen}
													onOpenChange={(open) => {
														if (open) openSettingsMenu();
														else handleSettingsMenuClose();
													}}
												>
													<PopoverTrigger asChild>
														<Button
															ref={(node) => {
																tabContentRefs.current[item.key] = node;
															}}
															onClick={(event) => {
																event.preventDefault();
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
															variant="ghost"
															size="sm"
															className={tabButtonClass}
														>
															{navContent}
														</Button>
													</PopoverTrigger>
													<PopoverContent
														dir={isRTL ? "rtl" : "ltr"}
														side="top"
														align="center"
														sideOffset={12}
														collisionPadding={12}
														className={cn(
															"w-[min(248px,calc(100vw-24px))] max-w-[calc(100vw-24px)] max-h-[min(62dvh,calc(100dvh-160px))] overflow-y-auto overscroll-contain rounded-[22px] border p-2.5 text-panel-text",
															DOCK_SURFACE_CLASS,
														)}
													>
														<div className="flex flex-col gap-3">
															{groupedSettingsMenu.map((group) => (
																<div key={group.id} className="flex flex-col gap-1">
																	<span className="px-2.5 text-[10.5px] font-bold tracking-wider uppercase text-panel-text-muted">
																		{group.title}
																	</span>
																	<div className="flex flex-col gap-0.5">
																		{group.items.map((entry) => {
																			const ItemIcon = entry.icon;
																			const entrySelected =
																				activeSettingsKey === entry.key;
																			return (
																				<button
																					key={entry.key}
																					type="button"
																					aria-current={
																						entrySelected ? "page" : undefined
																					}
																					onClick={() =>
																						navigateToSettingsItem(entry.to)
																					}
																					className={cn(
																						"flex min-h-[38px] w-full items-center gap-2.5 rounded-[12px] px-2.5 text-start text-[13px] transition-[background-color,color,transform] duration-150 outline-none select-none active:scale-[0.98] active:bg-panel-elevated",
																						entrySelected
																							? "bg-panel-elevated font-bold text-panel-accent"
																							: "bg-transparent font-medium text-panel-text-secondary",
																					)}
																				>
																					{ItemIcon ? (
																						<ItemIcon className="size-4 shrink-0" />
																					) : null}
																					<span className="truncate">
																						{entry.label}
																					</span>
																				</button>
																			);
																		})}
																	</div>
																</div>
															))}
														</div>
													</PopoverContent>
												</Popover>
											);
										}

										if (item.key === "myaccount") {
											return (
												<Popover
													key={item.key}
													open={accountMenu.isOpen}
													onOpenChange={(open) => {
														if (!open) handleAccountMenuClose();
													}}
												>
													<PopoverTrigger asChild>
														<Button
															ref={(node) => {
																tabContentRefs.current[item.key] = node;
															}}
															onClick={(event) => {
																event.preventDefault();
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
															variant="ghost"
															size="sm"
															className={tabButtonClass}
														>
															{navContent}
														</Button>
													</PopoverTrigger>
													<PopoverContent
														dir={isRTL ? "rtl" : "ltr"}
														side="top"
														align="center"
														sideOffset={12}
														collisionPadding={12}
														onOpenAutoFocus={(event) => event.preventDefault()}
														className={cn(
															"w-[min(188px,calc(100vw-24px))] max-w-[calc(100vw-24px)] rounded-[20px] border p-2",
															DOCK_SURFACE_CLASS,
														)}
													>
														<button
															type="button"
															onClick={async () => {
																try {
																	await logoutSession();
																} finally {
																	clearClientSession();
																	handleAccountMenuClose();
																	navigate("/login");
																}
															}}
															className="flex min-h-[38px] w-full items-center gap-2.5 rounded-[12px] px-3 text-[13px] font-semibold text-red-400 transition-[background-color,transform] duration-150 outline-none select-none active:scale-[0.98] active:bg-red-500/20"
														>
															<LogOut className="size-4 shrink-0" />
															<span>{t("header.logout")}</span>
														</button>
													</PopoverContent>
												</Popover>
											);
										}

										return (
											<Button
												key={item.key}
												ref={(node) => {
													tabContentRefs.current[item.key] = node;
												}}
												onClick={() => {
													if (item.to) handleNavClick(item.to);
												}}
												variant="ghost"
												size="sm"
												className={tabButtonClass}
											>
												{navContent}
											</Button>
										);
									})}
								</div>
							</div>
						</div>
					</>
				) : null}
			</div>
		</>
	);
}

export function AppLayout() {
	return (
		<NotificationProvider>
			<AppLayoutContent />
		</NotificationProvider>
	);
}

