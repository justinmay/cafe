"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  CircleDollarSign,
  ClipboardList,
  PackageCheck,
  ReceiptText,
  RefreshCw,
  TrendingUp,
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
import { cn } from "@/lib/utils"
import { formatPrice } from "@/lib/format"
import { useParams } from "next/navigation"

type RangeDays = 7 | 30

interface AnalyticsData {
  rangeDays: RangeDays
  summary: {
    grossSales: number
    orders: number
    averageOrderValue: number
    itemsSold: number
  }
  ordersByStatus: {
    RECEIVED: number
    PREPARING: number
    READY: number
  }
  dailyStats: {
    date: string
    grossSales: number
    orders: number
  }[]
  topItems: {
    id: string
    name: string
    quantity: number
    grossSales: number
  }[]
}

const rangeOptions: { value: RangeDays; label: string }[] = [
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
]

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    weekday: "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`))
}

function formatAxisDate(date: string, rangeDays: RangeDays) {
  return new Intl.DateTimeFormat("en-US", {
    month: rangeDays === 30 ? "numeric" : undefined,
    day: rangeDays === 30 ? "numeric" : undefined,
    weekday: rangeDays === 7 ? "short" : undefined,
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`))
}

function formatCompactPrice(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: cents >= 100_000 ? "compact" : "standard",
    maximumFractionDigits: 0,
  }).format(cents / 100)
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
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.8fr)]">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  )
}

export default function AnalyticsPage() {
  const params = useParams()
  const org = params.org as string
  const [rangeDays, setRangeDays] = useState<RangeDays>(7)
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const loadAnalytics = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true)
      setError(false)

      try {
        const response = await fetch(
          `/api/${org}/admin/analytics?range=${rangeDays}`,
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
    [org, rangeDays]
  )

  useEffect(() => {
    const controller = new AbortController()
    loadAnalytics(controller.signal)
    return () => controller.abort()
  }, [loadAnalytics])

  const maxDailySales = useMemo(
    () => Math.max(...(data?.dailyStats.map((day) => day.grossSales) ?? [0]), 1),
    [data]
  )
  const maxItemQuantity = useMemo(
    () => Math.max(...(data?.topItems.map((item) => item.quantity) ?? [0]), 1),
    [data]
  )

  return (
    <div className="mx-auto max-w-6xl px-4 py-7 sm:py-9">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Badge variant="secondary" className="mb-3">
            <TrendingUp aria-hidden="true" />
            Sales overview
          </Badge>
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Analytics
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            See order volume, gross sales, and which menu items are moving.
          </p>
        </div>

        <div
          className="inline-flex w-fit rounded-lg border bg-muted/40 p-1"
          aria-label="Analytics date range"
        >
          {rangeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setRangeDays(option.value)}
              aria-pressed={rangeDays === option.value}
              className={cn(
                "h-8 rounded-md px-3 text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                rangeDays === option.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
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
              label="Gross sales"
              value={formatPrice(data.summary.grossSales)}
              description="Order totals recorded; payment status is not tracked."
              icon={CircleDollarSign}
            />
            <SummaryCard
              label="Orders"
              value={data.summary.orders.toLocaleString()}
              description={`Orders placed in the last ${data.rangeDays} days.`}
              icon={ReceiptText}
            />
            <SummaryCard
              label="Average order"
              value={formatPrice(data.summary.averageOrderValue)}
              description="Gross sales divided by orders in this period."
              icon={ClipboardList}
            />
            <SummaryCard
              label="Items sold"
              value={data.summary.itemsSold.toLocaleString()}
              description="Total item quantity across orders in this period."
              icon={PackageCheck}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.8fr)]">
            <Card>
              <CardHeader>
                <CardTitle>Gross sales by day</CardTitle>
                <CardDescription>
                  Daily order totals for the selected period, grouped in UTC
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  className="flex h-52 items-end gap-1.5 border-b border-l px-2 pt-4 sm:gap-2"
                  role="img"
                  aria-label={`Daily gross sales for the last ${data.rangeDays} days`}
                >
                  {data.dailyStats.map((day, index) => {
                    const height = Math.max(
                      (day.grossSales / maxDailySales) * 100,
                      day.grossSales > 0 ? 4 : 1
                    )
                    const showLabel =
                      data.rangeDays === 7 ||
                      index === 0 ||
                      index === data.dailyStats.length - 1 ||
                      index % 5 === 0

                    return (
                      <div
                        key={day.date}
                        className="group relative flex h-full min-w-0 flex-1 items-end"
                      >
                        <div
                          className={cn(
                            "w-full rounded-t-sm bg-primary/75 transition-colors group-hover:bg-primary",
                            day.grossSales === 0 && "bg-muted"
                          )}
                          style={{ height: `${height}%` }}
                        />
                        <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs text-background shadow-lg group-hover:block group-focus-within:block">
                          {formatDate(day.date)} ·{" "}
                          {formatPrice(day.grossSales)} · {day.orders}{" "}
                          {day.orders === 1 ? "order" : "orders"}
                        </div>
                        {showLabel && (
                          <span className="absolute top-full left-1/2 mt-2 -translate-x-1/2 whitespace-nowrap text-[0.65rem] text-muted-foreground">
                            {formatAxisDate(day.date, data.rangeDays)}
                          </span>
                        )}
                        <span className="sr-only">
                          {formatDate(day.date)}:{" "}
                          {formatPrice(day.grossSales)}, {day.orders} orders
                        </span>
                      </div>
                    )
                  })}
                </div>
                <div className="mt-10 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{formatCompactPrice(0)}</span>
                  <span>
                    Peak day {formatCompactPrice(maxDailySales)}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Order status</CardTitle>
                <CardDescription>
                  Current status of orders placed in this period
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  {
                    label: "Received",
                    value: data.ordersByStatus.RECEIVED,
                    className: "bg-sky-500",
                  },
                  {
                    label: "Preparing",
                    value: data.ordersByStatus.PREPARING,
                    className: "bg-amber-500",
                  },
                  {
                    label: "Ready",
                    value: data.ordersByStatus.READY,
                    className: "bg-emerald-500",
                  },
                ].map((status) => {
                  const percentage =
                    data.summary.orders > 0
                      ? (status.value / data.summary.orders) * 100
                      : 0

                  return (
                    <div key={status.label}>
                      <div className="mb-1.5 flex items-center justify-between text-sm">
                        <span className="font-medium">{status.label}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {status.value}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            status.className
                          )}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
                {data.summary.orders === 0 && (
                  <p className="pt-2 text-sm text-muted-foreground">
                    No orders were placed in this period.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Top menu items</CardTitle>
              <CardDescription>
                Ranked by quantity sold in the selected period
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.topItems.length === 0 ? (
                <div className="rounded-xl border border-dashed px-6 py-10 text-center">
                  <p className="font-medium">No sales in this period</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Item performance will appear after an order is placed.
                  </p>
                </div>
              ) : (
                <ol className="space-y-5">
                  {data.topItems.map((item, index) => (
                    <li key={item.id} className="grid gap-2 sm:grid-cols-[2rem_minmax(0,1fr)_auto] sm:items-center sm:gap-3">
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
                      <div className="hidden min-w-32 text-right sm:block">
                        <p className="text-sm font-medium tabular-nums">
                          {item.quantity} sold
                        </p>
                        <p className="text-xs tabular-nums text-muted-foreground">
                          {formatPrice(item.grossSales)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
