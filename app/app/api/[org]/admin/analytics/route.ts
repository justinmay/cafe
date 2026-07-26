import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ org: string }> }
) {
  const { org: orgSlug } = await params
  const session = await getSession()

  if (!session || session.organizationSlug !== orgSlug) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Get all orders for this organization
    const orders = await prisma.order.findMany({
      where: { organizationId: session.organizationId },
      include: {
        items: {
          include: {
            menuItem: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    // Calculate total revenue
    const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0)

    // Calculate order count
    const totalOrders = orders.length

    // Calculate average order value
    const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0

    // Count orders by status
    const ordersByStatus = {
      RECEIVED: orders.filter((o) => o.status === "RECEIVED").length,
      PREPARING: orders.filter((o) => o.status === "PREPARING").length,
      READY: orders.filter((o) => o.status === "READY").length,
    }

    // Calculate top selling items
    const itemSales: Record<string, { name: string; quantity: number; revenue: number }> = {}
    for (const order of orders) {
      for (const item of order.items) {
        const menuItemId = item.menuItemId
        if (!itemSales[menuItemId]) {
          itemSales[menuItemId] = {
            name: item.menuItem.name,
            quantity: 0,
            revenue: 0,
          }
        }
        itemSales[menuItemId].quantity += item.quantity
        itemSales[menuItemId].revenue += item.unitPrice * item.quantity
      }
    }

    const topItems = Object.entries(itemSales)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5)

    // Calculate daily stats for last 7 days
    const now = new Date()
    const sevenDaysAgo = new Date(now)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
    sevenDaysAgo.setHours(0, 0, 0, 0)

    const dailyStats: { date: string; revenue: number; orders: number }[] = []

    for (let i = 0; i < 7; i++) {
      const date = new Date(sevenDaysAgo)
      date.setDate(date.getDate() + i)
      const dateStr = date.toISOString().split("T")[0]

      const dayOrders = orders.filter((order) => {
        const orderDate = new Date(order.createdAt)
        return orderDate.toISOString().split("T")[0] === dateStr
      })

      dailyStats.push({
        date: dateStr,
        revenue: dayOrders.reduce((sum, order) => sum + order.total, 0),
        orders: dayOrders.length,
      })
    }

    return NextResponse.json({
      totalRevenue,
      totalOrders,
      avgOrderValue,
      ordersByStatus,
      topItems,
      dailyStats,
    })
  } catch (error) {
    console.error("Analytics fetch error:", error)
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    )
  }
}
