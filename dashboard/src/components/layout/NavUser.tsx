import { Avatar, AvatarFallback } from "components/ui/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "components/ui/dropdown-menu";
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "components/ui/sidebar";
import useGetUser from "hooks/useGetUser";
import { ChevronsUpDown, LogOut, Settings, User } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { logout as logoutSession } from "service/auth";
import { AdminRole } from "types/Admin";

function getInitials(name?: string): string {
	if (!name) return "A";
	const clean = name.replace(/[^\p{L}\p{N}]+/gu, " ").trim();
	if (!clean) return "A";
	const parts = clean.split(/\s+/);
	if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
	return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function NavUser() {
	const { t, i18n } = useTranslation();
	const navigate = useNavigate();
	const { userData, getUserIsSuccess } = useGetUser();
	const { isMobile } = useSidebar();
	const isRTL = i18n.dir(i18n.language) === "rtl";

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

	const handleLogout = async () => {
		try {
			await logoutSession();
		} finally {
			navigate("/login");
		}
	};

	if (!getUserIsSuccess || !userData.username) {
		return (
			<SidebarMenu>
				<SidebarMenuItem>
					<div className="h-12 w-full animate-pulse rounded-lg bg-sidebar-accent/50" />
				</SidebarMenuItem>
			</SidebarMenu>
		);
	}

	const initials = getInitials(userData.username);

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<SidebarMenuButton
							size="lg"
							className="h-12 w-full gap-2.5 rounded-xl border border-transparent transition-colors data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
						>
							<Avatar className="size-8 rounded-lg border border-panel-border/70">
								<AvatarFallback className="rounded-lg bg-panel-accent/15 text-xs font-semibold text-panel-accent">
									{initials}
								</AvatarFallback>
							</Avatar>
							<div className="grid min-w-0 flex-1 text-start leading-tight">
								<span className="truncate text-xs font-semibold text-panel-text">
									{userData.username}
								</span>
								<span className="truncate text-[11px] text-panel-text-muted">
									{roleLabel}
								</span>
							</div>
							<ChevronsUpDown className="ms-auto size-4 shrink-0 text-panel-text-muted opacity-70" />
						</SidebarMenuButton>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						className="w-60 rounded-2xl border border-panel-border bg-panel-surface p-1.5 text-panel-text shadow-xl"
						side={isMobile ? "bottom" : isRTL ? "left" : "right"}
						align={isRTL ? "start" : "end"}
						sideOffset={8}
					>
						<DropdownMenuLabel className="p-1 font-normal">
							<div className="flex items-center gap-2.5 px-1 py-1 text-start">
								<Avatar className="size-9 rounded-lg border border-panel-border/70">
									<AvatarFallback className="rounded-lg bg-panel-accent/15 text-xs font-semibold text-panel-accent">
										{initials}
									</AvatarFallback>
								</Avatar>
								<div className="grid min-w-0 flex-1 leading-tight">
									<span className="truncate text-sm font-semibold text-panel-text">
										{userData.username}
									</span>
									<span className="truncate text-xs text-panel-text-muted">
										{roleLabel}
									</span>
								</div>
							</div>
						</DropdownMenuLabel>
						<DropdownMenuSeparator className="my-1 bg-panel-border" />
						<DropdownMenuGroup>
							<DropdownMenuItem
								onSelect={() => navigate("/myaccount")}
								className="cursor-pointer gap-2.5 rounded-xl px-2.5 py-2 text-xs font-medium text-panel-text hover:bg-panel-elevated focus:bg-panel-elevated"
							>
								<User className="size-4 shrink-0 text-panel-text-muted" />
								<span>{t("myaccount.menu")}</span>
							</DropdownMenuItem>
							<DropdownMenuItem
								onSelect={() => navigate("/settings")}
								className="cursor-pointer gap-2.5 rounded-xl px-2.5 py-2 text-xs font-medium text-panel-text hover:bg-panel-elevated focus:bg-panel-elevated"
							>
								<Settings className="size-4 shrink-0 text-panel-text-muted" />
								<span>{t("header.integrationSettings")}</span>
							</DropdownMenuItem>
						</DropdownMenuGroup>
						<DropdownMenuSeparator className="my-1 bg-panel-border" />
						<DropdownMenuItem
							onSelect={handleLogout}
							className="cursor-pointer gap-2.5 rounded-xl px-2.5 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 focus:bg-destructive/10 focus:text-destructive"
						>
							<LogOut className="size-4 shrink-0" />
							<span>{t("header.logout")}</span>
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
