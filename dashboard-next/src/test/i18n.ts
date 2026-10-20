import { createInstance } from "i18next"
import { initReactI18next } from "react-i18next"

const en = {
  "next.nav.users": "Users",
  "next.page.users.desc":
    "Search, filter and act on every account. Paging and sorting run on the server, so the list stays fast with thousands of users.",
  refresh: "Refresh",

  "next.stat.total": "Total users",
  "next.stat.online": "Online now",
  "next.stat.traffic": "Traffic used",
  "next.users.remaining": "remaining",
  usersStatusBreakdown: "Users by status",

  "status.active": "Active",
  "status.disabled": "Disabled",
  "status.limited": "Limited",
  "status.expired": "Expired",
  "status.on_hold": "On Hold",
  "status.unknown": "Unknown",

  "next.users.searchPlaceholder": "Search by username…",
  "next.users.clear": "Clear filters",
  "next.users.allStatuses": "All statuses",
  "next.users.showing": "{{from}}–{{to}} of {{total}}",

  "next.users.emptyTitle": "No users match these filters",
  "next.users.emptyBody": "Try a different search term, or clear the filters.",
  "next.users.errorTitle": "Could not load users",
  "next.table.error": "Request failed",
  "next.table.retry": "Retry",

  "next.users.rowsPerPage": "Rows",
  "next.users.pageOf": "Page {{page}} of {{count}}",
  "next.users.prev": "Previous",
  "next.users.next": "Next",

  "next.users.columnUser": "User",
  "next.users.columnStatus": "Status",
  "next.users.columnUsage": "Usage",
  "next.users.columnExpiry": "Expiry",
  "next.users.columnService": "Service",
  "next.users.columnOwner": "Owner",
  "next.users.columnCreated": "Created",

  unlimited: "Unlimited",
  "next.users.noExpiry": "No expiry",
  "next.users.expired": "Expired",
  "next.users.daysLeft": "{{days}} days left",

  actions: "Actions",
  "next.users.copySubscription": "Copy subscription",
  "next.users.resetUsage": "Reset usage",
  "next.users.enable": "Enable",
  "next.users.disable": "Disable",
  "next.users.delete": "Delete user",
  "next.users.deleteConfirm": "Delete {{username}}? This cannot be undone.",
  cancel: "Cancel",
  delete: "Delete",
  "next.toast.copied": "Copied to clipboard",
  "next.toast.copyFailed": "Copy failed",
} satisfies Record<string, string>

/**
 * A synchronous, backend-free i18n instance holding only the English keys the
 * covered screens read. Keys are flat because the shipped locale JSON files in
 * `public/statics/locales` are flat too (i18next resolves a flat key before
 * splitting it on the separator).
 */
export const testI18n = createInstance()

void testI18n.use(initReactI18next).init({
  lng: "en",
  fallbackLng: false,
  resources: { en: { translation: en } },
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
  // Everything is in memory, so finish initialisation synchronously.
  initAsync: false,
})
