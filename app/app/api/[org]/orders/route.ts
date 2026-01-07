import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"

const createOrderSchema = z.object({
  customerName: z.string().min(1).max(100),
  items: z.array(
    z.object({
      menuItemId: z.string(),
      quantity: z.number().int().min(1),
      modifiers: z.array(
        z.object({
          optionId: z.string(),
        })
      ),
    })
  ).min(1),
})

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
    const orders = await prisma.order.findMany({
      where: { organizationId: session.organizationId },
      include: {
        items: {
          include: {
            menuItem: true,
            modifiers: {
              include: {
                modifierOption: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(orders)
  } catch (error) {
    console.error("Orders fetch error:", error)
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 }
    )
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ org: string }> }
) {
  try {
    const { org: orgSlug } = await params

    // Find organization
    const organization = await prisma.organization.findUnique({
      where: { slug: orgSlug },
    })

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      )
    }

    const body = await req.json()
    const { customerName, items } = createOrderSchema.parse(body)

    // Fetch menu items and modifier options to calculate prices
    const menuItemIds = items.map((i) => i.menuItemId)
    const modifierOptionIds = items.flatMap((i) => i.modifiers.map((m) => m.optionId))

    const [menuItems, modifierOptions] = await Promise.all([
      prisma.menuItem.findMany({
        where: {
          id: { in: menuItemIds },
          organizationId: organization.id,
          available: true,
        },
      }),
      prisma.modifierOption.findMany({
        where: { id: { in: modifierOptionIds } },
      }),
    ])

    const menuItemMap = new Map(menuItems.map((m) => [m.id, m] as const))
    const optionMap = new Map(modifierOptions.map((o) => [o.id, o] as const))

    // Validate all items exist and belong to this org
    for (const item of items) {
      if (!menuItemMap.has(item.menuItemId)) {
        return NextResponse.json(
          { error: "Menu item not found or unavailable" },
          { status: 400 }
        )
      }
      for (const mod of item.modifiers) {
        if (!optionMap.has(mod.optionId)) {
          return NextResponse.json(
            { error: "Modifier option not found" },
            { status: 400 }
          )
        }
      }
    }

    // Calculate total
    let total = 0
    const orderItemsData = items.map((item) => {
      const menuItem = menuItemMap.get(item.menuItemId)!
      const modifiersTotal = item.modifiers.reduce((sum, mod) => {
        const option = optionMap.get(mod.optionId)!
        return sum + option.priceAdjustment
      }, 0)
      const unitPrice = menuItem.price + modifiersTotal
      total += unitPrice * item.quantity

      return {
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        unitPrice,
        modifiers: item.modifiers.map((mod) => ({
          modifierOptionId: mod.optionId,
          priceAdjustment: optionMap.get(mod.optionId)!.priceAdjustment,
        })),
      }
    })

    // Create order with items
    const order = await prisma.order.create({
      data: {
        customerName,
        total,
        organizationId: organization.id,
        items: {
          create: orderItemsData.map((item) => ({
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            modifiers: {
              create: item.modifiers,
            },
          })),
        },
      },
      include: {
        items: {
          include: {
            menuItem: true,
            modifiers: {
              include: {
                modifierOption: true,
              },
            },
          },
        },
      },
    })

    return NextResponse.json(order, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid order data", details: error.issues },
        { status: 400 }
      )
    }
    console.error("Order creation error:", error)
    return NextResponse.json(
      { error: "Failed to create order" },
      { status: 500 }
    )
  }
}
