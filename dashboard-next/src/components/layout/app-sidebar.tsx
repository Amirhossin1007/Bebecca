import { Link, useLocation } from "react-router-dom"
import { useTranslation } from "react-i18next"

import { BrandMark } from "@/components/layout/brand-mark"
import { NAV_GROUPS } from "@/components/layout/nav-items"
import { SessionBadge } from "@/components/layout/session-badge"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"

export function AppSidebar() {
  const { t } = useTranslation()
  const location = useLocation()
  const { state } = useSidebar()

  const isActive = (to: string, end?: boolean) =>
    end ? location.pathname === to : location.pathname === to || location.pathname.startsWith(`${to}/`)

  return (
    <Sidebar collapsible="icon" side={document.documentElement.dir === "rtl" ? "right" : "left"}>
      <SidebarHeader className="gap-1 px-3 py-4">
        <Link
          to="/"
          className="flex items-center gap-2.5 rounded-md px-1 outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          aria-label="Rebecca"
        >
          <BrandMark className="size-8 shrink-0" />
          <span className="flex min-w-0 flex-col group-data-[collapsible=icon]:hidden">
            <span className="truncate text-[0.9375rem] font-semibold leading-tight tracking-tight">
              Rebecca
            </span>
            <span className="truncate text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              {t("next.brand.tagline")}
            </span>
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-1">
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.labelKey}>
            <SidebarGroupLabel className="text-[0.6875rem] uppercase tracking-[0.12em]">
              {t(group.labelKey)}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {group.items.map((item) => {
                  const active = isActive(item.to, item.end)
                  const Icon = item.icon
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={state === "collapsed" ? t(item.labelKey) : undefined}
                        className="h-9 gap-2.5 data-[active=true]:font-medium"
                      >
                        <Link to={item.to} aria-current={active ? "page" : undefined}>
                          <Icon className="size-4 shrink-0" strokeWidth={1.9} />
                          <span className="truncate">{t(item.labelKey)}</span>
                        </Link>
                      </SidebarMenuButton>
                      {item.soon ? (
                        <SidebarMenuBadge className="text-[0.625rem] font-medium uppercase tracking-wide text-muted-foreground group-data-[collapsible=icon]:hidden">
                          {t("next.nav.soon")}
                        </SidebarMenuBadge>
                      ) : null}
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="p-2">
        <SessionBadge />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
