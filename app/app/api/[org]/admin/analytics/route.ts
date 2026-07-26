import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const HOUR_IN_MS = 60 * 60 * 1000
const OTHER_ITEMS_ID = "__other_items__"

function isValidDateKey(value: string | null): value is string {
  if (!value || !DATE_PATTERN.test(value)) return false

  const date = new Date(`${value}T00:00:00.000Z`)
  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  )
}

function resolveTimeZone(value: string | null) {
  if (!value) return "UTC"

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date())
    return value
  } catch {
    return "UTC"
  }
}

function getDateKey(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  }).formatToParts(date)
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  )

  return `${values.year}-${values.month}-${values.day}`
}

function getHour(date: Date, timeZone: string) {
  const hour = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    hourCycle: "h23",
    timeZone,
  })
    .formatToParts(date)
    .find((part) => part.type === "hour")?.value

  return Number(hour ?? 0)
}

function median(values: number[]) {
  if (values.length === 0) return null

  const sorted = [...values].sort((first, second) => first - second)
  const middle = Math.floor(sorted.length / 2)

  if (sorted.length % 2 === 1) return sorted[middle]
  return Math.round((sorted[middle - 1] + sorted[middle]) / 2)
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ org: string }> }
) {
  const { org: orgSlug } = await params
  const session = await getSession()

  if (!session || session.organizationSlug !== orgSlug) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const timeZone = resolveTimeZone(
    request.nextUrl.searchParams.get("timezone")
  )
  const requestedDate = request.nextUrl.searchParams.get("date")

  try {
    const orderDates = await prisma.order.findMany({
      where: { organizationId: session.organizationId },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    })
    const availableDates = [
      ...new Set(
        orderDates.map((order) => getDateKey(order.createdAt, timeZone))
      ),
    ].sort()
    const latestDate = availableDates[availableDates.length - 1]
    const selectedDate = isValidDateKey(requestedDate)
      ? requestedDate
      : latestDate ?? getDateKey(new Date(), timeZone)

    let previousDate: string | null = null
    let nextDate: string | null = null
    for (const date of availableDates) {
      if (date < selectedDate) previousDate = date
      if (date > selectedDate && nextDate === null) nextDate = date
    }

    // This broad UTC window safely contains a full local day for every IANA
    // timezone. The final filter below applies the organization viewer's day.
    const utcAnchor = new Date(`${selectedDate}T00:00:00.000Z`)
    const queryStart = new Date(utcAnchor.getTime() - 15 * HOUR_IN_MS)
    const queryEnd = new Date(utcAnchor.getTime() + 39 * HOUR_IN_MS)
    const candidateOrders = await prisma.order.findMany({
      where: {
        organizationId: session.organizationId,
        createdAt: {
          gte: queryStart,
          lt: queryEnd,
        },
      },
      select: {
        totalMin: true,
        totalMax: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        items: {
          select: {
            quantity: true,
            unitPriceMin: true,
            unitPriceMax: true,
            usesSuggestedPriceRange: true,
            priceRangeCaptured: true,
            menuItemId: true,
            menuItem: {
              select: { name: true },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    })
    const orders = candidateOrders.filter(
      (order) => getDateKey(order.createdAt, timeZone) === selectedDate
    )

    const orderValueMin = orders.reduce(
      (sum, order) => sum + order.totalMin,
      0
    )
    const orderValueMax = orders.reduce(
      (sum, order) => sum + order.totalMax,
      0
    )
    const hasSuggestedPricing = orders.some((order) =>
      order.items.some((item) => item.usesSuggestedPriceRange)
    )
    const hasUncapturedPricing = orders.some((order) =>
      order.items.some((item) => !item.priceRangeCaptured)
    )
    const orderItemCounts = orders.map((order) =>
      order.items.reduce((sum, item) => sum + item.quantity, 0)
    )
    const itemsSold = orderItemCounts.reduce((sum, count) => sum + count, 0)
    const itemSales = new Map<
      string,
      {
        id: string
        name: string
        quantity: number
        orderValueMin: number
        orderValueMax: number
      }
    >()
    const hourlyTotals = new Map<
      number,
      {
        orders: number
        orderValueMin: number
        orderValueMax: number
        itemQuantities: Map<string, number>
      }
    >()

    for (const order of orders) {
      const hour = getHour(order.createdAt, timeZone)
      const hourData = hourlyTotals.get(hour) ?? {
        orders: 0,
        orderValueMin: 0,
        orderValueMax: 0,
        itemQuantities: new Map<string, number>(),
      }
      hourData.orders += 1
      hourData.orderValueMin += order.totalMin
      hourData.orderValueMax += order.totalMax

      for (const item of order.items) {
        const existing = itemSales.get(item.menuItemId)
        itemSales.set(item.menuItemId, {
          id: item.menuItemId,
          name: item.menuItem.name,
          quantity: (existing?.quantity ?? 0) + item.quantity,
          orderValueMin:
            (existing?.orderValueMin ?? 0) +
            item.unitPriceMin * item.quantity,
          orderValueMax:
            (existing?.orderValueMax ?? 0) +
            item.unitPriceMax * item.quantity,
        })
        hourData.itemQuantities.set(
          item.menuItemId,
          (hourData.itemQuantities.get(item.menuItemId) ?? 0) + item.quantity
        )
      }

      hourlyTotals.set(hour, hourData)
    }

    const rankedItems = [...itemSales.values()].sort(
      (first, second) =>
        second.quantity - first.quantity ||
        second.orderValueMax - first.orderValueMax
    )
    const primarySeries = rankedItems.slice(0, 5).map((item) => ({
      id: item.id,
      name: item.name,
    }))
    const primarySeriesIds = new Set(primarySeries.map((item) => item.id))
    const itemSeries =
      rankedItems.length > primarySeries.length
        ? [
            ...primarySeries,
            { id: OTHER_ITEMS_ID, name: "Other items" },
          ]
        : primarySeries

    const activeHours = [...hourlyTotals.keys()].sort(
      (first, second) => first - second
    )
    const firstHour = activeHours[0]
    const lastHour = activeHours[activeHours.length - 1]
    const hourlyStats =
      firstHour === undefined
        ? []
        : Array.from(
            { length: lastHour - firstHour + 1 },
            (_, index) => {
              const hour = firstHour + index
              const totals = hourlyTotals.get(hour)
              const otherQuantity = totals
                ? [...totals.itemQuantities.entries()].reduce(
                    (sum, [itemId, quantity]) =>
                      primarySeriesIds.has(itemId) ? sum : sum + quantity,
                    0
                  )
                : 0

              return {
                hour,
                orders: totals?.orders ?? 0,
                orderValueMin: totals?.orderValueMin ?? 0,
                orderValueMax: totals?.orderValueMax ?? 0,
                totalItems: totals
                  ? [...totals.itemQuantities.values()].reduce(
                      (sum, quantity) => sum + quantity,
                      0
                    )
                  : 0,
                items: itemSeries.map((series) => ({
                  id: series.id,
                  quantity:
                    series.id === OTHER_ITEMS_ID
                      ? otherQuantity
                      : totals?.itemQuantities.get(series.id) ?? 0,
                })),
              }
            }
          )

    const peakHour = hourlyStats.reduce<
      { hour: number; orders: number } | null
    >((peak, hour) => {
      if (!peak || hour.orders > peak.orders) {
        return { hour: hour.hour, orders: hour.orders }
      }
      return peak
    }, null)
    const fulfillmentMinutes = orders
      .filter((order) => order.status === "READY")
      .map((order) =>
        Math.max(
          0,
          Math.round(
            (order.updatedAt.getTime() - order.createdAt.getTime()) / 60_000
          )
        )
      )

    return NextResponse.json({
      date: selectedDate,
      timeZone,
      previousDate,
      nextDate,
      summary: {
        orderValueMin,
        orderValueMax,
        hasSuggestedPricing,
        hasUncapturedPricing,
        orders: orders.length,
        averageOrderValueMin:
          orders.length > 0 ? Math.round(orderValueMin / orders.length) : 0,
        averageOrderValueMax:
          orders.length > 0 ? Math.round(orderValueMax / orders.length) : 0,
        itemsSold,
      },
      service: {
        firstOrderAt: orders[0]?.createdAt ?? null,
        lastOrderAt: orders[orders.length - 1]?.createdAt ?? null,
        peakHour,
        medianFulfillmentMinutes: median(fulfillmentMinutes),
        averageItemsPerOrder:
          orders.length > 0
            ? Number((itemsSold / orders.length).toFixed(1))
            : 0,
      },
      orderSizeMix: {
        single: orderItemCounts.filter((count) => count === 1).length,
        double: orderItemCounts.filter((count) => count === 2).length,
        threePlus: orderItemCounts.filter((count) => count >= 3).length,
      },
      itemSeries,
      hourlyStats,
      topItems: rankedItems.slice(0, 8),
    })
  } catch (error) {
    console.error("Analytics fetch error:", error)
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    )
  }
}
