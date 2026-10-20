import { Search } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useMatches, useNavigate } from "react-router-dom"

import { LanguageSwitcher } from "@/components/layout/language-switcher"
import { ThemeToggle } from "@/components/layout/theme-toggle"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"

type RouteHandle = { titleKey?: string }

export function AppHeader() {
  const { t } = useTranslation()
  const matches = useMatches()
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [term, setTerm] = useState("")

  const titleKey = [...matches].reverse().find((match) => (match.handle as RouteHandle)?.titleKey)
    ?.handle as RouteHandle | undefined

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
      if (event.key === "Escape" && document.activeElement === inputRef.current) {
        inputRef.current?.blur()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-3 md:px-4">
      <SidebarTrigger className="-ms-1 size-8 text-muted-foreground hover:text-foreground" />
      <Separator orientation="vertical" className="me-1 hidden h-5 sm:block" />
      <div className="flex min-w-0 items-center gap-1.5 text-[0.8125rem]">
        <span className="hidden truncate text-muted-foreground sm:inline">Rebecca</span>
        <span className="hidden text-muted-foreground/40 sm:inline">/</span>
        <span className="truncate font-medium text-foreground/90">
          {titleKey?.titleKey ? t(titleKey.titleKey) : "Rebecca"}
        </span>
      </div>

      <div className="ms-auto flex items-center gap-1.5">
        <form
          className="group relative hidden md:block"
          onSubmit={(event) => {
            event.preventDefault()
            navigate(term.trim() ? `/users?search=${encodeURIComponent(term.trim())}` : "/users")
            inputRef.current?.blur()
          }}
        >
          <Search className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={inputRef}
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder={t("next.header.searchPlaceholder")}
            className="h-8 w-56 rounded-md border border-border bg-muted/40 pe-16 ps-8 text-[0.8125rem] text-foreground placeholder:text-muted-foreground/80 focus:w-64 focus:border-ring/60 focus:bg-background focus:outline-none focus:ring-2 focus:ring-ring/25 transition-[width,background-color,border-color,box-shadow] duration-200"
            aria-label={t("next.header.searchPlaceholder")}
          />
          <kbd dir="ltr" className="pointer-events-none absolute end-2 top-1/2 -translate-y-1/2 rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[0.625rem] leading-none text-muted-foreground">
            {t("next.header.shortcut")}
          </kbd>
        </form>

        <LanguageSwitcher />
        <ThemeToggle />
      </div>
    </header>
  )
}
