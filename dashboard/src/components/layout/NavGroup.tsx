import { Badge } from "components/ui/badge";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "components/ui/collapsible";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "components/ui/dropdown-menu";
import {
	SidebarGroup,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
	useSidebar,
} from "components/ui/sidebar";
import { cn } from "lib/cn";
import { ChevronRight } from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";

export type NavSubItem = {
	title: string;
	url: string;
	icon?: ComponentType<{ className?: string }>;
	badge?: ReactNode;
};

export type NavItemData = {
	title: string;
	url: string;
	icon?: ComponentType<{ className?: string }>;
	badge?: ReactNode;
	items?: NavSubItem[];
};

export type NavGroupProps = {
	title?: string;
	items: NavItemData[];
};

function isRouteActive(
	pathname: string,
	url: string,
	hash = "",
	isParent = false,
): boolean {
	if (isParent) {
		const base = url.split("?")[0].split("#")[0];
		return pathname.startsWith(base) && base !== "/";
	}
	const [targetPath, targetHash] = url.split("#");
	if (targetHash && hash) {
		return pathname === targetPath && `#${targetHash}` === hash;
	}
	if (url === "/") {
		return pathname === "/";
	}
	return pathname === targetPath || pathname.startsWith(`${targetPath}/`);
}

function NavSingleLink({ item }: { item: NavItemData }) {
	const location = useLocation();
	const { setOpenMobile } = useSidebar();
	const active = isRouteActive(
		location.pathname,
		item.url,
		location.hash,
		false,
	);
	const Icon = item.icon;

	return (
		<SidebarMenuItem>
			<SidebarMenuButton
				asChild
				isActive={active}
				tooltip={item.title}
				className={cn(
					"h-9 w-full gap-3 rounded-xl px-3 font-medium transition-colors text-panel-text-muted hover:bg-panel-elevated hover:text-panel-text",
					active &&
						"bg-panel-accent! text-white! font-semibold shadow-xs hover:bg-panel-accent! hover:text-white!",
				)}
			>
				<Link to={item.url} onClick={() => setOpenMobile(false)}>
					{Icon ? <Icon className="size-4 shrink-0" /> : null}
					<span className="truncate text-xs">{item.title}</span>
					{item.badge ? (
						<span className="ms-auto flex shrink-0 items-center">
							{item.badge}
						</span>
					) : null}
				</Link>
			</SidebarMenuButton>
		</SidebarMenuItem>
	);
}

function NavCollapsibleItem({ item }: { item: NavItemData }) {
	const location = useLocation();
	const { setOpenMobile } = useSidebar();
	const Icon = item.icon;
	const isAnyChildActive = Boolean(
		item.items?.some((sub) =>
			isRouteActive(location.pathname, sub.url, location.hash, false),
		),
	);

	return (
		<Collapsible
			asChild
			defaultOpen={isAnyChildActive}
			className="group/collapsible"
		>
			<SidebarMenuItem>
				<CollapsibleTrigger asChild>
					<SidebarMenuButton
						tooltip={item.title}
						isActive={isAnyChildActive}
						className={cn(
							"h-9 w-full gap-3 rounded-xl px-3 font-medium transition-colors text-panel-text-muted hover:bg-panel-elevated hover:text-panel-text",
							isAnyChildActive && "text-panel-text font-semibold",
						)}
					>
						{Icon ? <Icon className="size-4 shrink-0" /> : null}
						<span className="truncate text-xs">{item.title}</span>
						<ChevronRight className="ms-auto size-4 shrink-0 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 rtl:rotate-180 rtl:group-data-[state=open]/collapsible:rotate-90 text-panel-text-muted opacity-60" />
					</SidebarMenuButton>
				</CollapsibleTrigger>
				<CollapsibleContent>
					<SidebarMenuSub className="ms-4 my-1 gap-1 border-s border-panel-border/70 ps-2.5 py-0.5">
						{item.items?.map((sub) => {
							const subActive = isRouteActive(
								location.pathname,
								sub.url,
								location.hash,
								false,
							);
							const SubIcon = sub.icon;
							return (
								<SidebarMenuSubItem key={sub.url}>
									<SidebarMenuSubButton
										asChild
										isActive={subActive}
										className={cn(
											"h-8 gap-2 rounded-lg px-2.5 text-xs text-panel-text-muted hover:bg-panel-elevated hover:text-panel-text transition-colors",
											subActive &&
												"bg-panel-accent/15! text-panel-accent! font-semibold hover:bg-panel-accent/20!",
										)}
									>
										<Link to={sub.url} onClick={() => setOpenMobile(false)}>
											{SubIcon ? <SubIcon className="size-3.5 shrink-0" /> : null}
											<span className="truncate">{sub.title}</span>
											{sub.badge ? (
												<span className="ms-auto flex shrink-0 items-center">
													{sub.badge}
												</span>
											) : null}
										</Link>
									</SidebarMenuSubButton>
								</SidebarMenuSubItem>
							);
						})}
					</SidebarMenuSub>
				</CollapsibleContent>
			</SidebarMenuItem>
		</Collapsible>
	);
}

function NavCollapsedDropdownItem({ item }: { item: NavItemData }) {
	const location = useLocation();
	const { i18n } = useTranslation();
	const isRTL = i18n.dir(i18n.language) === "rtl";
	const Icon = item.icon;
	const isAnyChildActive = Boolean(
		item.items?.some((sub) =>
			isRouteActive(location.pathname, sub.url, location.hash, false),
		),
	);

	return (
		<SidebarMenuItem>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<SidebarMenuButton
						tooltip={item.title}
						isActive={isAnyChildActive}
						className={cn(
							"h-9 w-full gap-3 rounded-xl px-3 font-medium transition-colors text-panel-text-muted hover:bg-panel-elevated hover:text-panel-text",
							isAnyChildActive && "bg-panel-accent/15 text-panel-accent font-semibold",
						)}
					>
						{Icon ? <Icon className="size-4 shrink-0" /> : null}
						<span className="truncate text-xs">{item.title}</span>
						<ChevronRight className="ms-auto size-4" />
					</SidebarMenuButton>
				</DropdownMenuTrigger>
				<DropdownMenuContent
					side={isRTL ? "left" : "right"}
					align="start"
					sideOffset={8}
					className="min-w-48 rounded-xl border border-panel-border bg-panel-surface p-1.5 shadow-xl text-panel-text"
				>
					<DropdownMenuLabel className="px-2 py-1 text-xs font-semibold text-panel-text">
						{item.title}
					</DropdownMenuLabel>
					<DropdownMenuSeparator className="my-1 bg-panel-border" />
					{item.items?.map((sub) => {
						const subActive = isRouteActive(
							location.pathname,
							sub.url,
							location.hash,
							false,
						);
						const SubIcon = sub.icon;
						return (
							<DropdownMenuItem key={sub.url} asChild>
								<Link
									to={sub.url}
									className={cn(
										"flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-panel-text-muted hover:bg-panel-elevated hover:text-panel-text transition-colors cursor-pointer",
										subActive &&
											"bg-panel-accent/15 font-semibold text-panel-accent hover:bg-panel-accent/20 hover:text-panel-accent",
									)}
								>
									{SubIcon ? <SubIcon className="size-3.5 shrink-0" /> : null}
									<span className="truncate">{sub.title}</span>
								</Link>
							</DropdownMenuItem>
						);
					})}
				</DropdownMenuContent>
			</DropdownMenu>
		</SidebarMenuItem>
	);
}

export function NavGroup({ title, items }: NavGroupProps) {
	const { state, isMobile } = useSidebar();
	if (items.length === 0) return null;

	return (
		<SidebarGroup className="py-1 px-2">
			{title ? (
				<SidebarGroupLabel className="px-2.5 text-[10px] font-bold uppercase tracking-wider text-panel-text-muted/70">
					{title}
				</SidebarGroupLabel>
			) : null}
			<SidebarMenu className="gap-0.5">
				{items.map((item) => {
					const key = `${item.title}-${item.url}`;
					if (!item.items || item.items.length === 0) {
						return <NavSingleLink key={key} item={item} />;
					}
					if (state === "collapsed" && !isMobile) {
						return <NavCollapsedDropdownItem key={key} item={item} />;
					}
					return <NavCollapsibleItem key={key} item={item} />;
				})}
			</SidebarMenu>
		</SidebarGroup>
	);
}
