import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"

const updateOrderItemSchema = z.object({
  completed: z.boolean(),
})

export async function PATCH(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{ org: string; id: string; itemId: string }>
  }
) {
  const { org: orgSlug, id: orderId, itemId } = await params
  const session = await getSession()

  if (!session || session.organizationSlug !== orgSlug) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { completed } = updateOrderItemSchema.parse(body)

    const existingItem = await prisma.orderItem.findFirst({
      where: {
        id: itemId,
        orderId,
        order: {
          organizationId: session.organizationId,
        },
      },
      include: {
        order: {
          select: {
            status: true,
          },
        },
      },
    })

    if (!existingItem) {
      return NextResponse.json(
        { error: "Order item not found" },
        { status: 404 }
      )
    }

    if (existingItem.order.status !== "PREPARING") {
      return NextResponse.json(
        { error: "Start preparing the order before updating its items" },
        { status: 409 }
      )
    }

    const orderItem = await prisma.orderItem.update({
      where: { id: itemId },
      data: { completed },
    })

    return NextResponse.json(orderItem)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid item status" },
        { status: 400 }
      )
    }

    console.error("Order item update error:", error)
    return NextResponse.json(
      { error: "Failed to update order item" },
      { status: 500 }
    )
  }
}
