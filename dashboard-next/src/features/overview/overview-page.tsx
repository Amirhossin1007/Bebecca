import {
  Activity,
  ArrowUpRight,
  Cpu,
  Gauge,
  MemoryStick,
  Network,
  RefreshCw,
  Server,
  Users,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"

import { Num } from "@/components/num"
import { PageHeader } from "@/components/layout/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useSystemStats } from "@/features/overview/api"
import { Sparkline } from "@/features/overview/sparkline"
import { useFormat } from "@/lib/use-format"
import { cn } from "@/lib/utils"

function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  loading,
  tone = "text-muted-foreground",
  children,
}: {
  label: string
  value: string
  hint?: string
  icon: LucideIcon
  loading?: boolean
  tone?: string
  children?: React.ReactNode
}) {
  return (
    <Card className="panel-glow overflow-hidden">
      <CardContent className="flex flex-col gap-1 p-4">
        <div className="flex items-center justify-between">
          <span className="text-[0.6875rem] font-medium uppercase tracking-[0.1em] text-muted-foreground">
            {label}
          </span>
          <Icon className={cn("size-3.5", tone)} strokeWidth={1.9} />
        </div>
        {loading ? (
          <Skeleton className="mt-1 h-7 w-20" />
        ) : (
          <span className="mt-0.5 text-[1.375rem] font-semibold leading-tight tracking-tight tabular">{value}</span>
        )}
        {hint ? <span className="text-[0.6875rem] text-muted-foreground tabular">{hint}</span> : null}
        {children}
      </CardContent>
    </Card>
  )
}

function MetricRow({
  label,
  percent,
  detail,
  values,
  tone,
}: {
  label: string
  percent: number
  detail: string
  values: number[]
  tone: string
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[0.75rem] text-muted-foreground">{label}</span>
        <div className="flex items-baseline gap-2">
          <Num className="text-[0.8125rem] font-medium">{detail}</Num>
          <Num className="text-[0.6875rem] text-muted-foreground">{percent.toFixed(1)}%</Num>
        </div>
      </div>
      <Sparkline series={[{ values, tone }]} max={100} height={34} />
    </div>
  )
}

export function OverviewPage() {
  const { t } = useTranslation()
  const format = useFormat()
  const { data, isPending, isError, refetch, isFetching, dataUpdatedAt } = useSystemStats()

  const statusRows = data
    ? [
        { key: "status.active", value: data.users_active, tone: "bg-success" },
        { key: "status.expired", value: data.users_expired, tone: "bg-destructive" },
        { key: "status.limited", value: data.users_limited, tone: "bg-warning" },
        { key: "status.on_hold", value: data.users_on_hold, tone: "bg-info" },
        { key: "status.disabled", value: data.users_disabled, tone: "bg-muted-foreground/45" },
      ]
    : []
  const statusTotal = statusRows.reduce((sum, row) => sum + (row.value ?? 0), 0)

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("next.nav.dashboard")}
        description={t("next.page.dashboard.desc")}
        actions={
          <>
            <Badge
              variant="outline"
              className={cn(
                "h-7 gap-1.5 border px-2 text-[0.6875rem] font-medium",
                data?.xray_running
                  ? "border-success/30 bg-success/10 text-success"
                  : "border-border bg-muted/50 text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  data?.xray_running ? "animate-pulse bg-success" : "bg-muted-foreground/60",
                )}
              />
              Xray {data?.xray_running ? t("online") : t("next.users.offline")}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={cn("size-3.5", isFetching && "animate-spin")} />
              {t("refresh")}
            </Button>
          </>
        }
      />

      {isError ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-[0.8125rem] text-muted-foreground">
            {t("next.overview.unavailable")}
          </CardContent>
        </Card>
      ) : null}

      <div className="stagger-in grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label={t("next.stat.online")}
          value={format.number(data?.online_users)}
          hint={t("next.stat.totalCount", { count: format.number(data?.total_user) })}
          icon={Activity}
          loading={isPending}
          tone="text-success"
        />
        <StatTile
          label={t("next.stat.active")}
          value={format.number(data?.users_active)}
          hint={t("next.stat.totalCount", { count: format.number(statusTotal) })}
          icon={Users}
          loading={isPending}
          tone="text-primary"
        />
        <StatTile
          label={t("next.overview.uptime")}
          value={format.duration(data?.panel_uptime_seconds)}
          hint={`Xray ${format.duration(data?.xray_uptime_seconds)}`}
          icon={Gauge}
          loading={isPending}
        />
        <StatTile
          label={t("next.overview.version")}
          value={data?.version ?? "—"}
          hint={
            dataUpdatedAt
              ? t("next.overview.updated", { time: format.date(dataUpdatedAt / 1000, "time") })
              : undefined
          }
          icon={Server}
          loading={isPending}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-[0.8125rem] font-medium">
              <Cpu className="size-3.5 text-muted-foreground" />
              {t("next.overview.cpu")} · {t("next.overview.memory")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <MetricRow
              label={t("next.overview.cpu")}
              percent={data?.cpu_usage ?? 0}
              detail={`${format.number(data?.cpu_threads)} ${t("next.overview.threads")}`}
              values={(data?.cpu_history ?? []).map((point) => point.value)}
              tone="var(--chart-1)"
            />
            <MetricRow
              label={t("next.overview.memory")}
              percent={data?.memory?.percent ?? 0}
              detail={`${format.bytes(data?.memory?.current)} / ${format.bytes(data?.memory?.total)}`}
              values={(data?.memory_history ?? []).map((point) => point.value)}
              tone="var(--chart-2)"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-[0.8125rem] font-medium">
              <Network className="size-3.5 text-muted-foreground" />
              {t("next.overview.network")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-[0.75rem] text-muted-foreground">
                <span className="size-1.5 rounded-full bg-chart-1" />
                Down
              </span>
              <Num className="text-[0.8125rem] font-medium">
                {format.bytes(data?.incoming_bandwidth_speed)}
                <span className="text-[0.6875rem] text-muted-foreground">/s</span>
              </Num>
            </div>
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-[0.75rem] text-muted-foreground">
                <span className="size-1.5 rounded-full bg-chart-3" />
                Up
              </span>
              <Num className="text-[0.8125rem] font-medium">
                {format.bytes(data?.outgoing_bandwidth_speed)}
                <span className="text-[0.6875rem] text-muted-foreground">/s</span>
              </Num>
            </div>
            <Sparkline
              series={[
                { values: (data?.network_history ?? []).map((point) => point.incoming), tone: "var(--chart-1)" },
                { values: (data?.network_history ?? []).map((point) => point.outgoing), tone: "var(--chart-3)" },
              ]}
              height={56}
            />
            <p className="text-[0.6875rem] text-muted-foreground">
              <Num>{format.bytes(data?.panel_total_bandwidth)}</Num> {t("next.users.remaining")}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-[0.8125rem] font-medium">
              <Users className="size-3.5 text-muted-foreground" />
              {t("usersStatusBreakdown")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex h-1.5 w-full gap-px overflow-hidden rounded-full bg-muted">
              {statusRows.map((row) =>
                row.value ? (
                  <span
                    key={row.key}
                    className={cn("h-full first:rounded-s-full last:rounded-e-full", row.tone)}
                    style={{ width: `${((row.value ?? 0) / Math.max(statusTotal, 1)) * 100}%` }}
                  />
                ) : null,
              )}
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
              {statusRows.map((row) => (
                <div key={row.key} className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[0.75rem] text-muted-foreground">
                    <span className={cn("size-1.5 rounded-full", row.tone)} />
                    {t(row.key)}
                  </span>
                  <span className="text-[0.75rem] font-medium tabular">{format.number(row.value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-[0.8125rem] font-medium">
              <ArrowUpRight className="size-3.5 text-muted-foreground" />
              {t("next.overview.quick")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {[
              { to: "/users", label: t("next.overview.quickUsers"), icon: Users },
              { to: "/nodes", label: t("next.overview.quickNodes"), icon: Network },
              { to: "/services", label: t("next.overview.quickServices"), icon: MemoryStick },
            ].map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="group flex items-center gap-2.5 rounded-md border border-transparent px-2 py-2 text-[0.8125rem] transition-colors hover:border-border hover:bg-muted/50"
              >
                <item.icon className="size-4 text-muted-foreground" />
                <span className="flex-1">{item.label}</span>
                <ArrowUpRight className="size-3.5 text-muted-foreground/60 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5" />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
