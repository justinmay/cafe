import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const VALID_RANGES = new Set([7, 30])

function startOfUtcDay(date: Date) {
  const result = new Date(date)
  result.setUTCHours(0, 0, 0, 0)
  return result
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

  const requestedRange = Number(request.nextUrl.searchParams.get("range"))
  const rangeDays = VALID_RANGES.has(requestedRange) ? requestedRange : 7
  const today = startOfUtcDay(new Date())
  const periodStart = new Date(today)
  periodStart.setUTCDate(periodStart.getUTCDate() - (rangeDays - 1))

  try {
    const orders = await prisma.order.findMany({
      where: {
        organizationId: session.organizationId,
        createdAt: { gte: periodStart },
      },
      select: {
        total: true,
        status: true,
        createdAt: true,
        items: {
          select: {
            quantity: true,
            unitPrice: true,
            menuItemId: true,
            menuItem: {
              select: { name: true },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    })

    const grossSales = orders.reduce((sum, order) => sum + order.total, 0)
    const itemsSold = orders.reduce(
      (sum, order) =>
        sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
      0
    )

    const ordersByStatus = {
      RECEIVED: 0,
      PREPARING: 0,
      READY: 0,
    }

    for (const order of orders) {
      ordersByStatus[order.status] += 1
    }

    const itemSales = new Map<
      string,
      { id: string; name: string; quantity: number; grossSales: number }
    >()

    for (const order of orders) {
      for (const item of order.items) {
        const existing = itemSales.get(item.menuItemId)
        itemSales.set(item.menuItemId, {
          id: item.menuItemId,
          name: item.menuItem.name,
          quantity: (existing?.quantity ?? 0) + item.quantity,
          grossSales:
            (existing?.grossSales ?? 0) + item.unitPrice * item.quantity,
        })
      }
    }

    const dailyTotals = new Map<
      string,
      { grossSales: number; orders: number }
    >()

    for (const order of orders) {
      const date = order.createdAt.toISOString().slice(0, 10)
      const existing = dailyTotals.get(date)
      dailyTotals.set(date, {
        grossSales: (existing?.grossSales ?? 0) + order.total,
        orders: (existing?.orders ?? 0) + 1,
      })
    }

    const dailyStats = Array.from({ length: rangeDays }, (_, index) => {
      const date = new Date(periodStart)
      date.setUTCDate(date.getUTCDate() + index)
      const dateKey = date.toISOString().slice(0, 10)
      const totals = dailyTotals.get(dateKey)

      return {
        date: dateKey,
        grossSales: totals?.grossSales ?? 0,
        orders: totals?.orders ?? 0,
      }
    })

    return NextResponse.json({
      rangeDays,
      summary: {
        grossSales,
        orders: orders.length,
        averageOrderValue:
          orders.length > 0 ? Math.round(grossSales / orders.length) : 0,
        itemsSold,
      },
      ordersByStatus,
      dailyStats,
      topItems: [...itemSales.values()]
        .sort(
          (first, second) =>
            second.quantity - first.quantity ||
            second.grossSales - first.grossSales
        )
        .slice(0, 5),
    })
  } catch (error) {
    console.error("Analytics fetch error:", error)
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    )
  }
}
