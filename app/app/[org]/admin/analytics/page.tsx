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
  ListFilter,
  PackageCheck,
  ReceiptText,
  RefreshCw,
  Sparkles,
} from "lucide-react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
    fulfilledOrders: number
    medianFulfillmentMinutes: number | null
    totalItems: number
    items: {
      id: string
      quantity: number
    }[]
  }[]
  fulfillmentDistribution: {
    startMinutes: number
    endMinutes: number
    midpointMinutes: number
    orders: number
  }[]
  topItems: {
    id: string
    name: string
    quantity: number
    orderValueMin: number
    orderValueMax: number
  }[]
}

type HourlyChartPoint = {
  hour: number
  orders: number
  orderValueMin: number
  orderValueMax: number
  totalItems: number
  [itemId: string]: number
}

const ITEM_COLORS = [
  "oklch(0.55 0.14 28)",
  "oklch(0.66 0.13 65)",
  "oklch(0.57 0.1 155)",
  "oklch(0.58 0.1 235)",
  "oklch(0.62 0.12 310)",
  "oklch(0.59 0.11 185)",
  "oklch(0.67 0.14 95)",
  "oklch(0.62 0.13 345)",
  "oklch(0.56 0.13 275)",
  "oklch(0.58 0.08 45)",
  "oklch(0.67 0.1 210)",
  "oklch(0.61 0.09 125)",
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

function formatDurationTick(minutes: number) {
  return minutes < 60 ? `${minutes}m` : formatDuration(minutes)
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
        <Skeleton className="h-[24rem] rounded-xl" />
        <Skeleton className="h-[24rem] rounded-xl" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  )
}

function HourlyItemChart({ data }: { data: AnalyticsData }) {
  const [selectedItemIds, setSelectedItemIds] = useState(() =>
    data.itemSeries.map((series) => series.id)
  )

  const seriesColors = new Map(
    data.itemSeries.map((series, index) => [
      series.id,
      ITEM_COLORS[index % ITEM_COLORS.length],
    ])
  )
  const seriesNames = new Map(
    data.itemSeries.map((series) => [series.id, series.name])
  )
  const selectedSeries = data.itemSeries.filter((series) =>
    selectedItemIds.includes(series.id)
  )
  const chartData = data.hourlyStats.map((hour) => {
    const point: HourlyChartPoint = {
      hour: hour.hour,
      orders: hour.orders,
      orderValueMin: hour.orderValueMin,
      orderValueMax: hour.orderValueMax,
      totalItems: hour.totalItems,
    }

    for (const item of hour.items) {
      point[item.id] = item.quantity
    }

    return point
  })
  const toggleSeries = (itemId: string) => {
    setSelectedItemIds((current) =>
      current.includes(itemId)
        ? current.filter((id) => id !== itemId)
        : [...current, itemId]
    )
  }

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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {selectedSeries.length} of {data.itemSeries.length} items shown
        </p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              aria-label="Filter items shown in the hourly sales chart"
            >
              <ListFilter aria-hidden="true" />
              Filter items
              <Badge variant="secondary" className="ml-1">
                {selectedSeries.length}
              </Badge>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuLabel>Items shown</DropdownMenuLabel>
            <DropdownMenuItem
              disabled={selectedSeries.length === data.itemSeries.length}
              onSelect={() =>
                setSelectedItemIds(
                  data.itemSeries.map((series) => series.id)
                )
              }
            >
              Show all items
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {data.itemSeries.map((series, index) => (
              <DropdownMenuCheckboxItem
                key={series.id}
                checked={selectedItemIds.includes(series.id)}
                onCheckedChange={() => toggleSeries(series.id)}
                onSelect={(event) => event.preventDefault()}
              >
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{
                    backgroundColor:
                      ITEM_COLORS[index % ITEM_COLORS.length],
                  }}
                />
                <span className="truncate">{series.name}</span>
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {selectedSeries.length === 0 ? (
        <div className="rounded-xl border border-dashed px-6 py-14 text-center">
          <p className="font-medium">Choose an item to graph</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Use Filter items to select one or more menu items.
          </p>
        </div>
      ) : (
        <div
          className="h-80 w-full"
          role="img"
          aria-label={`Stacked items sold by hour on ${formatPopupDate(
            data.date
          )}`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 12, right: 12, bottom: 4, left: 0 }}
              accessibilityLayer
            >
              <CartesianGrid
                vertical={false}
                stroke="var(--border)"
                strokeDasharray="4 4"
              />
              <XAxis
                dataKey="hour"
                tickFormatter={(hour) => formatHour(Number(hour))}
                tickLine={false}
                axisLine={false}
                tickMargin={10}
                minTickGap={24}
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                width={40}
              />
              <Tooltip
                cursor={{
                  stroke: "var(--muted-foreground)",
                  strokeDasharray: "4 4",
                  strokeOpacity: 0.5,
                }}
                content={({ active, label, payload }) => {
                  if (!active || !payload?.length) return null

                  const point = payload[0]?.payload as
                    | HourlyChartPoint
                    | undefined
                  if (!point) return null
                  const visibleItems = payload.reduce(
                    (sum, entry) => sum + Number(entry.value ?? 0),
                    0
                  )

                  return (
                    <div className="min-w-48 rounded-lg border bg-background p-3 text-xs shadow-xl">
                      <p className="font-semibold text-foreground">
                        {formatHourRange(Number(label))}
                      </p>
                      <p className="mt-1 text-muted-foreground">
                        {visibleItems} items in view ·{" "}
                        {point.orders}{" "}
                        {point.orders === 1 ? "order" : "orders"} ·{" "}
                        {formatPriceRange(
                          point.orderValueMin,
                          point.orderValueMax
                        )}
                      </p>
                      <div className="mt-2 space-y-1.5">
                        {payload.map((entry) => {
                          const itemId = String(entry.dataKey)
                          const quantity = Number(entry.value ?? 0)
                          if (quantity === 0) return null

                          return (
                            <p
                              key={itemId}
                              className="flex items-center justify-between gap-4"
                            >
                              <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
                                <span
                                  className="size-2 shrink-0 rounded-full"
                                  style={{
                                    backgroundColor:
                                      seriesColors.get(itemId),
                                  }}
                                />
                                <span className="truncate">
                                  {seriesNames.get(itemId)}
                                </span>
                              </span>
                              <span className="font-medium tabular-nums text-foreground">
                                {quantity}
                              </span>
                            </p>
                          )
                        })}
                      </div>
                    </div>
                  )
                }}
              />
              {selectedSeries.map((series) => (
                <Area
                  key={series.id}
                  type="monotone"
                  dataKey={series.id}
                  name={series.name}
                  stackId="items"
                  stroke={seriesColors.get(series.id)}
                  fill={seriesColors.get(series.id)}
                  fillOpacity={0.28}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                  isAnimationActive={false}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {selectedSeries.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
          {selectedSeries.map((series) => (
            <div
              key={series.id}
              className="flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <span
                className="size-2.5 rounded-sm"
                style={{
                  backgroundColor: seriesColors.get(series.id),
                }}
              />
              {series.name}
            </div>
          ))}
        </div>
      )}
      <p className="mt-4 text-xs text-muted-foreground">
        Item bands stack into each hour&apos;s total. Use the filter to compare
        only the items you care about.
      </p>
    </>
  )
}

function HourlyFulfillmentChart({ data }: { data: AnalyticsData }) {
  const chartData = data.hourlyStats.map((hour) => ({
    hour: hour.hour,
    orders: hour.orders,
    fulfilledOrders: hour.fulfilledOrders,
    medianMinutes: hour.medianFulfillmentMinutes,
  }))
  const hasFulfillmentData = chartData.some(
    (hour) => hour.medianMinutes !== null
  )

  if (!hasFulfillmentData) {
    return (
      <div className="rounded-xl border border-dashed px-6 py-14 text-center">
        <p className="font-medium">No fulfillment data for this day</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Times appear after orders are marked Ready.
        </p>
      </div>
    )
  }

  return (
    <>
      <div
        className="h-72 w-full"
        role="img"
        aria-label={`Median fulfillment time by hour on ${formatPopupDate(
          data.date
        )}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 12, right: 12, bottom: 4, left: 0 }}
            accessibilityLayer
          >
            <CartesianGrid
              vertical={false}
              stroke="var(--border)"
              strokeDasharray="4 4"
            />
            <XAxis
              dataKey="hour"
              tickFormatter={(hour) => formatHour(Number(hour))}
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              minTickGap={24}
            />
            <YAxis
              allowDecimals={false}
              tickFormatter={(minutes) => `${minutes}m`}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={48}
            />
            <Tooltip
              cursor={{
                stroke: "var(--muted-foreground)",
                strokeDasharray: "4 4",
                strokeOpacity: 0.5,
              }}
              content={({ active, label, payload }) => {
                if (!active || !payload?.length) return null

                const point = payload[0]?.payload as
                  | (typeof chartData)[number]
                  | undefined
                if (!point) return null

                return (
                  <div className="min-w-44 rounded-lg border bg-background p-3 text-xs shadow-xl">
                    <p className="font-semibold text-foreground">
                      {formatHourRange(Number(label))}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      {formatDuration(point.medianMinutes)} median ·{" "}
                      {point.fulfilledOrders} ready{" "}
                      {point.fulfilledOrders === 1 ? "order" : "orders"}
                    </p>
                  </div>
                )
              }}
            />
            {data.service.medianFulfillmentMinutes !== null && (
              <ReferenceLine
                y={data.service.medianFulfillmentMinutes}
                stroke="var(--muted-foreground)"
                strokeDasharray="5 5"
                strokeOpacity={0.65}
              />
            )}
            <Line
              type="monotone"
              dataKey="medianMinutes"
              name="Median fulfillment"
              stroke="var(--primary)"
              strokeWidth={2.5}
              dot={{
                r: 3,
                fill: "var(--background)",
                strokeWidth: 2,
              }}
              activeDot={{ r: 5 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="h-0.5 w-5 rounded-full bg-primary" />
          Hourly median
        </div>
        {data.service.medianFulfillmentMinutes !== null && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="w-5 border-t border-dashed border-muted-foreground" />
            Popup median:{" "}
            {formatDuration(data.service.medianFulfillmentMinutes)}
          </div>
        )}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Median time from order placement to the latest Ready update, grouped
        by the hour the order was placed.
      </p>
    </>
  )
}

function FulfillmentDistributionChart({ data }: { data: AnalyticsData }) {
  const buckets = data.fulfillmentDistribution
  const totalOrders = buckets.reduce(
    (sum, bucket) => sum + bucket.orders,
    0
  )

  if (buckets.length === 0) {
    return (
      <div className="rounded-xl border border-dashed px-6 py-14 text-center">
        <p className="font-medium">No fulfillment data for this day</p>
        <p className="mt-1 text-sm text-muted-foreground">
          The distribution appears after orders are marked Ready.
        </p>
      </div>
    )
  }

  const firstBucket = buckets[0]
  const lastBucket = buckets[buckets.length - 1]
  const chartData = [
    {
      minutes: firstBucket.startMinutes,
      orders: 0,
      startMinutes: firstBucket.startMinutes,
      endMinutes: firstBucket.startMinutes,
      boundary: true,
    },
    ...buckets.map((bucket) => ({
      minutes: bucket.midpointMinutes,
      orders: bucket.orders,
      startMinutes: bucket.startMinutes,
      endMinutes: bucket.endMinutes,
      boundary: false,
    })),
    {
      minutes: lastBucket.endMinutes,
      orders: 0,
      startMinutes: lastBucket.endMinutes,
      endMinutes: lastBucket.endMinutes,
      boundary: true,
    },
  ]

  return (
    <>
      <div
        className="h-72 w-full"
        role="img"
        aria-label={`Fulfillment time distribution on ${formatPopupDate(
          data.date
        )}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 12, right: 12, bottom: 4, left: 0 }}
            accessibilityLayer
          >
            <CartesianGrid
              vertical={false}
              stroke="var(--border)"
              strokeDasharray="4 4"
            />
            <XAxis
              type="number"
              dataKey="minutes"
              domain={[0, "dataMax"]}
              tickFormatter={(minutes) =>
                formatDurationTick(Number(minutes))
              }
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              tickCount={5}
              allowDecimals={false}
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={40}
            />
            <Tooltip
              cursor={{
                stroke: "var(--muted-foreground)",
                strokeDasharray: "4 4",
                strokeOpacity: 0.5,
              }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null

                const point = payload[0]?.payload as
                  | (typeof chartData)[number]
                  | undefined
                if (!point || point.boundary) return null

                const share =
                  totalOrders > 0
                    ? Math.round((point.orders / totalOrders) * 100)
                    : 0

                return (
                  <div className="min-w-40 rounded-lg border bg-background p-3 text-xs shadow-xl">
                    <p className="font-semibold text-foreground">
                      {point.startMinutes}–{point.endMinutes} min
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      {point.orders}{" "}
                      {point.orders === 1 ? "order" : "orders"} · {share}%
                    </p>
                  </div>
                )
              }}
            />
            {data.service.medianFulfillmentMinutes !== null && (
              <ReferenceLine
                x={data.service.medianFulfillmentMinutes}
                stroke="var(--muted-foreground)"
                strokeDasharray="5 5"
                strokeOpacity={0.65}
              />
            )}
            <Area
              type="monotone"
              dataKey="orders"
              name="Ready orders"
              stroke="var(--primary)"
              fill="var(--primary)"
              fillOpacity={0.2}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="size-2.5 rounded-sm bg-primary/70" />
          Ready orders
        </div>
        {data.service.medianFulfillmentMinutes !== null && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="w-5 border-t border-dashed border-muted-foreground" />
            Median: {formatDuration(data.service.medianFulfillmentMinutes)}
          </div>
        )}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Smoothed duration buckets across {totalOrders} ready{" "}
        {totalOrders === 1 ? "order" : "orders"} reveal the typical cluster
        and the slow tail.
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
              <HourlyItemChart key={data.date} data={data} />
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Fulfillment time, hour by hour</CardTitle>
                <CardDescription>
                  How long completed orders took as service moved along
                </CardDescription>
              </CardHeader>
              <CardContent>
                <HourlyFulfillmentChart data={data} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Fulfillment time distribution</CardTitle>
                <CardDescription>
                  Where Ready times clustered and where they stretched
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FulfillmentDistributionChart data={data} />
              </CardContent>
            </Card>
          </div>

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
              Every sold item stays separate and can be filtered in the hourly
              chart.
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
