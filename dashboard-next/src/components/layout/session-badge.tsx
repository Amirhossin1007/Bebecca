import { ChevronsUpDown, LogOut, UserRound } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"
import { useCurrentAdmin, useLogout } from "@/features/auth/api"

function initials(name: string): string {
  const clean = name.replace(/[^\p{L}\p{N}]+/gu, " ").trim()
  if (!clean) return "?"
  const parts = clean.split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

const ROLE_LABEL: Record<string, string> = {
  full_access: "Full access",
  sudo: "Sudo",
  reseller: "Reseller",
  standard: "Standard",
}

export function SessionBadge() {
  const { t } = useTranslation()
  const admin = useCurrentAdmin()
  const logout = useLogout()
  const navigate = useNavigate()

  if (!admin) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <div className="h-12 animate-pulse rounded-md bg-sidebar-accent/60" />
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  const role = ROLE_LABEL[admin.role] ?? admin.role

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="h-12 gap-2.5 data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="size-8 rounded-md">
                <AvatarFallback className="rounded-md bg-sidebar-primary/12 text-[0.7rem] font-semibold text-sidebar-primary">
                  {initials(admin.username)}
                </AvatarFallback>
              </Avatar>
              <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5 leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate text-[0.8125rem] font-medium">{admin.username}</span>
                <span className="truncate text-[0.6875rem] text-muted-foreground">{role}</span>
              </span>
              <ChevronsUpDown className="size-3.5 text-muted-foreground group-data-[collapsible=icon]:hidden" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" sideOffset={8} className="w-56">
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">{admin.username}</span>
              <span className="text-xs font-normal text-muted-foreground">{role}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navigate("/settings")}>
              <UserRound className="size-4" />
              {t("next.account.title")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              disabled={logout.isPending}
              onSelect={() => logout.mutate()}
            >
              <LogOut className="size-4" />
              {t("logout")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
