"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Gauge,
  Layers3,
  PackageCheck,
  ReceiptText,
  RefreshCw,
  Sparkles,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { formatPriceRange } from "@/lib/format"

interface AnalyticsData {
  date: string
  timeZone: string
  previousDate: string | null
  nextDate: string | null
  summary: {
    orderValueMin: number
    orderValueMax: number
    hasSuggestedPricing: boolean
    hasUncapturedPricing: boolean
    orders: number
    averageOrderValueMin: number
    averageOrderValueMax: number
    itemsSold: number
  }
  service: {
    firstOrderAt: string | null
    lastOrderAt: string | null
    peakHour: {
      hour: number
      orders: number
    } | null
    medianFulfillmentMinutes: number | null
    averageItemsPerOrder: number
  }
  orderSizeMix: {
    single: number
    double: number
    threePlus: number
  }
  itemSeries: {
    id: string
    name: string
  }[]
  hourlyStats: {
    hour: number
    orders: number
    orderValueMin: number
    orderValueMax: number
    totalItems: number
    items: {
      id: string
      quantity: number
    }[]
  }[]
  topItems: {
    id: string
    name: string
    quantity: number
    orderValueMin: number
    orderValueMax: number
  }[]
}

const ITEM_COLORS = [
  "oklch(0.55 0.14 28)",
  "oklch(0.66 0.13 65)",
  "oklch(0.57 0.1 155)",
  "oklch(0.58 0.1 235)",
  "oklch(0.62 0.12 310)",
  "oklch(0.76 0.02 70)",
]

function formatPopupDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00.000Z`))
}

function formatShortDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00.000Z`))
}

function formatTime(value: string | null, timeZone: string) {
  if (!value) return "—"

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(new Date(value))
}

function formatHour(hour: number) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2026, 0, 1, hour)))
}

function formatHourRange(hour: number) {
  return `${formatHour(hour)}–${formatHour((hour + 1) % 24)}`
}

function formatDuration(minutes: number | null) {
  if (minutes === null) return "—"
  if (minutes < 60) return `${minutes} min`

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return remainingMinutes > 0
    ? `${hours}h ${remainingMinutes}m`
    : `${hours}h`
}

function SummaryCard({
  label,
  value,
  description,
  icon: Icon,
}: {
  label: string
  value: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <Card className="gap-4 py-5">
      <CardHeader className="flex-row items-start justify-between gap-3 px-5">
        <div>
          <CardDescription>{label}</CardDescription>
          <CardTitle className="mt-1.5 text-2xl tabular-nums">{value}</CardTitle>
        </div>
        <span
          className="flex size-9 items-center justify-center rounded-xl bg-accent text-accent-foreground"
          aria-hidden="true"
        >
          <Icon className="size-4.5" />
        </span>
      </CardHeader>
      <CardContent className="px-5">
        <p className="text-xs leading-5 text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}

function LoadingState() {
  return (
    <div className="space-y-6" aria-label="Loading analytics">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-36 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-[28rem] rounded-xl" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  )
}

function HourlyItemChart({ data }: { data: AnalyticsData }) {
  const maxHourlyItems = Math.max(
    ...data.hourlyStats.map((hour) => hour.totalItems),
    1
  )
  const seriesColors = new Map(
    data.itemSeries.map((series, index) => [
      series.id,
      ITEM_COLORS[index % ITEM_COLORS.length],
    ])
  )

  if (data.hourlyStats.length === 0) {
    return (
      <div className="rounded-xl border border-dashed px-6 py-14 text-center">
        <p className="font-medium">No orders on this popup day</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Use the arrows above to move to another day.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="overflow-x-auto pb-3">
        <div
          className="flex h-72 items-stretch gap-2 border-b border-l px-3 pt-5"
          style={{
            minWidth: `${Math.max(560, data.hourlyStats.length * 72)}px`,
          }}
          role="img"
          aria-label={`Items sold by hour on ${formatPopupDate(data.date)}`}
        >
          {data.hourlyStats.map((hour) => {
            const barHeight = Math.max(
              (hour.totalItems / maxHourlyItems) * 100,
              hour.totalItems > 0 ? 4 : 1
            )

            return (
              <div
                key={hour.hour}
                className="flex min-w-14 flex-1 flex-col"
              >
                <div className="flex min-h-0 flex-1 items-end justify-center">
                  <div
                    className="group relative w-10 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    style={{ height: `${barHeight}%` }}
                    tabIndex={0}
                  >
                    <div className="flex h-full flex-col-reverse overflow-hidden rounded-t-md bg-muted">
                      {hour.items.map((item) =>
                        item.quantity > 0 ? (
                          <div
                            key={item.id}
                            style={{
                              height: `${(item.quantity / hour.totalItems) * 100}%`,
                              backgroundColor: seriesColors.get(item.id),
                            }}
                          />
                        ) : null
                      )}
                    </div>
                    <span className="absolute bottom-full left-1/2 mb-1 -translate-x-1/2 text-[0.65rem] font-semibold tabular-nums text-muted-foreground">
                      {hour.orders}
                    </span>
                    <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-7 hidden w-44 -translate-x-1/2 rounded-lg bg-foreground p-2.5 text-xs text-background shadow-xl group-hover:block group-focus:block">
                      <p className="font-semibold">
                        {formatHourRange(hour.hour)}
                      </p>
                      <p className="mt-1 opacity-75">
                        {hour.orders}{" "}
                        {hour.orders === 1 ? "order" : "orders"} ·{" "}
                        {hour.totalItems} items ·{" "}
                        {formatPriceRange(
                          hour.orderValueMin,
                          hour.orderValueMax
                        )}
                      </p>
                      <div className="mt-2 space-y-1">
                        {hour.items.map((item) => {
                          const series = data.itemSeries.find(
                            (entry) => entry.id === item.id
                          )
                          return item.quantity > 0 ? (
                            <p
                              key={item.id}
                              className="flex justify-between gap-3"
                            >
                              <span className="truncate opacity-75">
                                {series?.name}
                              </span>
                              <span className="font-medium tabular-nums">
                                {item.quantity}
                              </span>
                            </p>
                          ) : null
                        })}
                      </div>
                    </div>
                    <span className="sr-only">
                      {formatHourRange(hour.hour)}: {hour.orders} orders,{" "}
                      {hour.totalItems} items,{" "}
                      {formatPriceRange(
                        hour.orderValueMin,
                        hour.orderValueMax
                      )}
                    </span>
                  </div>
                </div>
                <span className="h-9 pt-2 text-center text-[0.68rem] text-muted-foreground">
                  {formatHour(hour.hour)}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
        {data.itemSeries.map((series, index) => (
          <div
            key={series.id}
            className="flex items-center gap-1.5 text-xs text-muted-foreground"
          >
            <span
              className="size-2.5 rounded-sm"
              style={{
                backgroundColor: ITEM_COLORS[index % ITEM_COLORS.length],
              }}
            />
            {series.name}
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Bar height shows total items. The number above each bar is the order
        count.
      </p>
    </>
  )
}

function ServiceSnapshot({ data }: { data: AnalyticsData }) {
  const insights = [
    {
      label: "Service window",
      value:
        data.service.firstOrderAt && data.service.lastOrderAt
          ? `${formatTime(
              data.service.firstOrderAt,
              data.timeZone
            )}–${formatTime(data.service.lastOrderAt, data.timeZone)}`
          : "—",
      note: "First order to last order",
    },
    {
      label: "Busiest hour",
      value: data.service.peakHour
        ? formatHourRange(data.service.peakHour.hour)
        : "—",
      note: data.service.peakHour
        ? `${data.service.peakHour.orders} ${
            data.service.peakHour.orders === 1 ? "order" : "orders"
          }`
        : "No orders",
    },
    {
      label: "Median fulfillment",
      value: formatDuration(data.service.medianFulfillmentMinutes),
      note: "Placed to Ready",
    },
    {
      label: "Items per order",
      value: data.service.averageItemsPerOrder.toFixed(1),
      note: "Average basket size",
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Service snapshot</CardTitle>
        <CardDescription>
          A quick read on the pace of this popup
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {insights.map((insight) => (
          <div key={insight.label} className="rounded-xl border bg-muted/20 p-4">
            <p className="text-xs font-medium text-muted-foreground">
              {insight.label}
            </p>
            <p className="mt-1.5 text-xl font-semibold tabular-nums">
              {insight.value}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {insight.note}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function OrderSizeMix({ data }: { data: AnalyticsData }) {
  const sizes = [
    { label: "1 item", value: data.orderSizeMix.single },
    { label: "2 items", value: data.orderSizeMix.double },
    { label: "3+ items", value: data.orderSizeMix.threePlus },
  ]
  const maxOrders = Math.max(...sizes.map((size) => size.value), 1)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Order size</CardTitle>
        <CardDescription>
          How guests grouped items into each order
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {sizes.map((size) => (
          <div key={size.label}>
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="font-medium">{size.label}</span>
              <span className="tabular-nums text-muted-foreground">
                {size.value} {size.value === 1 ? "order" : "orders"}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary/75"
                style={{ width: `${(size.value / maxOrders) * 100}%` }}
              />
            </div>
          </div>
        ))}
        {data.summary.orders === 0 && (
          <p className="text-sm text-muted-foreground">
            No order-size data for this day.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

export default function AnalyticsPage() {
  const params = useParams()
  const org = params.org as string
  const [timeZone, setTimeZone] = useState<string | null>(null)
  const [requestedDate, setRequestedDate] = useState<string | null>(null)
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC")
  }, [])

  const loadAnalytics = useCallback(
    async (signal?: AbortSignal) => {
      if (!timeZone) return

      setLoading(true)
      setError(false)

      const searchParams = new URLSearchParams({ timezone: timeZone })
      if (requestedDate) searchParams.set("date", requestedDate)

      try {
        const response = await fetch(
          `/api/${org}/admin/analytics?${searchParams.toString()}`,
          { cache: "no-store", signal }
        )

        if (!response.ok) {
          throw new Error("Failed to load analytics")
        }

        setData(await response.json())
      } catch (fetchError) {
        if (
          fetchError instanceof DOMException &&
          fetchError.name === "AbortError"
        ) {
          return
        }
        setError(true)
      } finally {
        if (!signal?.aborted) {
          setLoading(false)
        }
      }
    },
    [org, requestedDate, timeZone]
  )

  useEffect(() => {
    if (!timeZone) return

    const controller = new AbortController()
    loadAnalytics(controller.signal)
    return () => controller.abort()
  }, [loadAnalytics, timeZone])

  const maxItemQuantity = useMemo(
    () => Math.max(...(data?.topItems.map((item) => item.quantity) ?? [0]), 1),
    [data]
  )

  return (
    <div className="mx-auto max-w-6xl px-4 py-7 sm:py-9">
      <div className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge variant="secondary" className="mb-3">
            <Sparkles aria-hidden="true" />
            Popup performance
          </Badge>
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Analytics
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Understand what sold, when the rush hit, and how service moved.
          </p>
        </div>

        {data && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              disabled={!data.previousDate || loading}
              onClick={() => setRequestedDate(data.previousDate)}
              aria-label={
                data.previousDate
                  ? `View ${formatShortDate(data.previousDate)}`
                  : "No earlier popup"
              }
            >
              <ChevronLeft aria-hidden="true" />
            </Button>
            <div className="min-w-0 flex-1 rounded-lg border bg-card px-4 py-2 text-center shadow-xs sm:min-w-64">
              <p className="flex items-center justify-center gap-2 text-sm font-semibold">
                <CalendarDays className="size-4" aria-hidden="true" />
                {formatPopupDate(data.date)}
              </p>
              <p className="mt-0.5 text-[0.68rem] text-muted-foreground">
                Times shown in {data.timeZone.replaceAll("_", " ")}
              </p>
            </div>
            <Button
              variant="outline"
              size="icon"
              disabled={!data.nextDate || loading}
              onClick={() => setRequestedDate(data.nextDate)}
              aria-label={
                data.nextDate
                  ? `View ${formatShortDate(data.nextDate)}`
                  : "Showing latest popup"
              }
            >
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
        )}
      </div>

      {loading ? (
        <LoadingState />
      ) : error || !data ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <p className="font-medium">Analytics couldn&apos;t be loaded.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Check the connection and try again.
            </p>
            <Button
              variant="outline"
              className="mt-5"
              onClick={() => loadAnalytics()}
            >
              <RefreshCw aria-hidden="true" />
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              label={
                data.summary.hasSuggestedPricing
                  ? "Suggested order value"
                  : "Order value"
              }
              value={formatPriceRange(
                data.summary.orderValueMin,
                data.summary.orderValueMax
              )}
              description={
                data.summary.hasUncapturedPricing
                  ? "Legacy orders use their stored configured-price fallback."
                  : data.summary.hasSuggestedPricing
                  ? "Customer-visible range; actual payments are not tracked."
                  : "Configured order totals; payment status is not tracked."
              }
              icon={CircleDollarSign}
            />
            <SummaryCard
              label="Orders"
              value={data.summary.orders.toLocaleString()}
              description="Orders placed during this popup day."
              icon={ReceiptText}
            />
            <SummaryCard
              label="Average order"
              value={formatPriceRange(
                data.summary.averageOrderValueMin,
                data.summary.averageOrderValueMax
              )}
              description="Order-value range divided by orders."
              icon={Gauge}
            />
            <SummaryCard
              label="Items sold"
              value={data.summary.itemsSold.toLocaleString()}
              description="Total menu-item quantity across orders."
              icon={PackageCheck}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>What sold, hour by hour</CardTitle>
              <CardDescription>
                Item mix and order volume across the service window
              </CardDescription>
            </CardHeader>
            <CardContent>
              <HourlyItemChart data={data} />
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <ServiceSnapshot data={data} />
            <OrderSizeMix data={data} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Menu performance</CardTitle>
              <CardDescription>
                Ranked by quantity sold during this popup
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.topItems.length === 0 ? (
                <div className="rounded-xl border border-dashed px-6 py-10 text-center">
                  <p className="font-medium">No item data for this day</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Item performance appears after an order is placed.
                  </p>
                </div>
              ) : (
                <ol className="space-y-5">
                  {data.topItems.map((item, index) => {
                    const share =
                      data.summary.itemsSold > 0
                        ? Math.round(
                            (item.quantity / data.summary.itemsSold) * 100
                          )
                        : 0

                    return (
                      <li
                        key={item.id}
                        className="grid gap-2 sm:grid-cols-[2rem_minmax(0,1fr)_auto] sm:items-center sm:gap-3"
                      >
                        <span className="text-sm font-semibold text-muted-foreground">
                          {index + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="mb-1.5 flex items-center justify-between gap-3">
                            <span className="truncate font-medium">
                              {item.name}
                            </span>
                            <span className="text-sm tabular-nums sm:hidden">
                              {item.quantity} sold
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary/75"
                              style={{
                                width: `${(item.quantity / maxItemQuantity) * 100}%`,
                              }}
                            />
                          </div>
                        </div>
                        <div className="hidden min-w-36 text-right sm:block">
                          <p className="text-sm font-medium tabular-nums">
                            {item.quantity} sold · {share}%
                          </p>
                          <p className="text-xs tabular-nums text-muted-foreground">
                            {formatPriceRange(
                              item.orderValueMin,
                              item.orderValueMax
                            )}
                          </p>
                        </div>
                      </li>
                    )
                  })}
                </ol>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-3 text-xs text-muted-foreground sm:grid-cols-3">
            <p className="flex items-start gap-2">
              <Clock3 className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              Fulfillment runs from order placement to the latest Ready update.
            </p>
            <p className="flex items-start gap-2">
              <Layers3
                className="mt-0.5 size-3.5 shrink-0"
                aria-hidden="true"
              />
              Item colors represent the five best sellers plus an Other group.
            </p>
            <p className="flex items-start gap-2">
              <CircleDollarSign
                className="mt-0.5 size-3.5 shrink-0"
                aria-hidden="true"
              />
              Values preserve fixed totals or suggested ranges; payments are
              not tracked. Legacy orders may predate range capture.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
