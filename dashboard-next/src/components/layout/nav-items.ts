import type { LucideIcon } from "lucide-react"
import {
  Boxes,
  Gauge,
  Layers,
  Network,
  Plug,
  ServerCog,
  Settings2,
  ShieldCheck,
  UsersRound,
} from "lucide-react"

export type NavItem = {
  to: string
  labelKey: string
  icon: LucideIcon
  end?: boolean
  soon?: boolean
}

export type NavGroup = {
  labelKey: string
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    labelKey: "next.nav.group.overview",
    items: [
      { to: "/", labelKey: "next.nav.dashboard", icon: Gauge, end: true },
      { to: "/users", labelKey: "next.nav.users", icon: UsersRound },
    ],
  },
  {
    labelKey: "next.nav.group.access",
    items: [
      { to: "/admins", labelKey: "next.nav.admins", icon: ShieldCheck },
      { to: "/hosts", labelKey: "next.nav.hosts", icon: ServerCog },
      { to: "/nodes", labelKey: "next.nav.nodes", icon: Network },
      { to: "/services", labelKey: "next.nav.services", icon: Layers },
    ],
  },
  {
    labelKey: "next.nav.group.platform",
    items: [
      { to: "/settings/core", labelKey: "next.nav.core", icon: Boxes, soon: true },
      { to: "/settings/integrations", labelKey: "next.nav.integrations", icon: Plug, soon: true },
      { to: "/settings", labelKey: "next.nav.settings", icon: Settings2, soon: true },
    ],
  },
]

/** Flat list, used by the command palette and by the document title. */
export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items)
