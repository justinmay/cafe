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

    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT "id"
        FROM "Order"
        WHERE "id" = ${orderId}
        FOR UPDATE
      `

      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: { status: true },
      })

      if (order?.status !== "PREPARING") {
        throw new Error("ORDER_NOT_PREPARING")
      }

      const orderItem = await tx.orderItem.update({
        where: { id: itemId },
        data: { completed },
      })

      let orderStatus: "PREPARING" | "READY" = order.status

      if (completed) {
        const remainingItems = await tx.orderItem.count({
          where: {
            orderId,
            completed: false,
          },
        })

        if (remainingItems === 0) {
          await tx.order.update({
            where: { id: orderId },
            data: { status: "READY" },
          })
          orderStatus = "READY"
        }
      }

      return { orderItem, orderStatus }
    })

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid item status" },
        { status: 400 }
      )
    }

    if (error instanceof Error && error.message === "ORDER_NOT_PREPARING") {
      return NextResponse.json(
        { error: "Start preparing the order before updating its items" },
        { status: 409 }
      )
    }

    console.error("Order item update error:", error)
    return NextResponse.json(
      { error: "Failed to update order item" },
      { status: 500 }
    )
  }
}
