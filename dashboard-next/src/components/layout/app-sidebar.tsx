import { ChevronRight } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useLocation } from "react-router-dom"

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
import { cn } from "@/lib/utils"

const STORAGE_KEY = "rebecca.nav.closed"

function readClosedGroups(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {}
  } catch {
    return {}
  }
}

export function AppSidebar() {
  const { t } = useTranslation()
  const location = useLocation()
  const { state, isMobile } = useSidebar()
  const collapsed = state === "collapsed" && !isMobile
  const [closedGroups, setClosedGroups] = useState<Record<string, boolean>>(readClosedGroups)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(closedGroups))
  }, [closedGroups])

  const toggleGroup = useCallback((key: string) => {
    setClosedGroups((current) => ({ ...current, [key]: !current[key] }))
  }, [])

  const isActive = (to: string, end?: boolean) =>
    end ? location.pathname === to : location.pathname === to || location.pathname.startsWith(`${to}/`)

  const activeGroup = NAV_GROUPS.find((group) =>
    group.items.some((item) => isActive(item.to, item.end)),
  )

  return (
    <Sidebar
      collapsible="icon"
      side={document.documentElement.dir === "rtl" ? "right" : "left"}
      className="border-e border-sidebar-border/80"
    >
      <SidebarHeader className="gap-2 px-3 pb-3 pt-4">
        <Link
          to="/"
          className="flex items-center gap-2.5 rounded-lg px-1 py-0.5 outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring/60"
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

      <SidebarContent className="gap-0 px-2">
        {NAV_GROUPS.map((group, groupIndex) => {
          const open = collapsed || !closedGroups[group.labelKey]
          const isCurrentGroup = activeGroup?.labelKey === group.labelKey

          return (
            <SidebarGroup
              key={group.labelKey}
              className={cn(
                "p-0",
                groupIndex > 0 && "mt-1 border-t border-sidebar-border/60 pt-2",
                collapsed && "border-t-0 pt-0",
              )}
            >
              <SidebarGroupLabel asChild>
                <button
                  type="button"
                  onClick={() => !collapsed && toggleGroup(group.labelKey)}
                  className={cn(
                    "group/label flex h-7 w-full items-center gap-1.5 rounded-md px-2 text-[0.6875rem] font-medium uppercase tracking-[0.12em] transition-colors",
                    isCurrentGroup ? "text-sidebar-foreground/70" : "text-muted-foreground/70",
                    !collapsed && "hover:text-sidebar-foreground",
                    collapsed && "justify-center pointer-events-none",
                  )}
                  aria-expanded={open}
                >
                  <span className="truncate group-data-[collapsible=icon]:hidden">
                    {t(group.labelKey)}
                  </span>
                  <ChevronRight
                    className={cn(
                      "size-3 shrink-0 opacity-0 transition-all group-hover/label:opacity-60 group-data-[collapsible=icon]:hidden",
                      open ? "rotate-90" : "rotate-0",
                    )}
                  />

                </button>
              </SidebarGroupLabel>

              <SidebarGroupContent
                className={cn(
                  "grid transition-[grid-template-rows,opacity] duration-200",
                  open ? "grid-rows-[1fr] opacity-100" : "pointer-events-none grid-rows-[0fr] opacity-0",
                )}
              >
                <div className="min-h-0 overflow-hidden">
                  <SidebarMenu className="gap-0.5">
                    {group.items.map((item) => {
                      const active = isActive(item.to, item.end)
                      const Icon = item.icon
                      return (
                        <SidebarMenuItem key={item.to}>
                          <SidebarMenuButton
                            asChild
                            isActive={active}
                            tooltip={collapsed ? t(item.labelKey) : undefined}
                            className={cn(
                              "relative h-9 gap-2.5 rounded-lg ps-2.5 text-[0.8125rem] transition-colors",
                              active
                                ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                                : "text-sidebar-foreground/80 hover:bg-sidebar-accent/55 hover:text-sidebar-accent-foreground",
                            )}
                          >
                            <Link to={item.to} aria-current={active ? "page" : undefined}>
                              {active ? (
                                <span className="absolute inset-y-1.5 start-0 w-0.5 rounded-full bg-sidebar-primary" />
                              ) : null}
                              <Icon
                                className={cn(
                                  "size-4 shrink-0",
                                  active ? "text-sidebar-primary" : "text-muted-foreground/80",
                                )}
                                strokeWidth={1.9}
                              />
                              <span className="truncate">{t(item.labelKey)}</span>
                            </Link>
                          </SidebarMenuButton>
                          {item.soon ? (
                            <SidebarMenuBadge
                              className={cn(
                                "rounded-full border border-sidebar-border/80 px-1.5 py-0 text-[0.5625rem] font-medium uppercase tracking-wide",
                                active
                                  ? "border-primary/30 bg-primary/10 text-primary"
                                  : "text-muted-foreground/70",
                                "group-data-[collapsible=icon]:hidden",
                              )}
                            >
                              {t("next.nav.soon")}
                            </SidebarMenuBadge>
                          ) : null}
                        </SidebarMenuItem>
                      )
                    })}
                  </SidebarMenu>
                </div>
              </SidebarGroupContent>
            </SidebarGroup>
          )
        })}
      </SidebarContent>

      <SidebarFooter className="gap-1 p-2">
        <SessionBadge />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
