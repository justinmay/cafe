import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"

const createMenuItemSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
  image: z.string().url().nullable().optional(),
  price: z.number().int().min(0),
  allergens: z.string().max(500).nullable().optional(),
  available: z.boolean().optional().default(true),
  modifiers: z.array(
    z.object({
      name: z.string().min(1).max(50),
      options: z.array(
        z.object({
          name: z.string().min(1).max(50),
          priceAdjustment: z.number().int(),
        })
      ),
    })
  ).optional().default([]),
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
    const menuItems = await prisma.menuItem.findMany({
      where: { organizationId: session.organizationId },
      include: {
        modifiers: {
          include: {
            options: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    })

    return NextResponse.json(menuItems)
  } catch (error) {
    console.error("Menu fetch error:", error)
    return NextResponse.json(
      { error: "Failed to fetch menu items" },
      { status: 500 }
    )
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ org: string }> }
) {
  const { org: orgSlug } = await params
  const session = await getSession()

  if (!session || session.organizationSlug !== orgSlug) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await req.json()
    const data = createMenuItemSchema.parse(body)

    const menuItem = await prisma.menuItem.create({
      data: {
        name: data.name,
        description: data.description,
        image: data.image,
        price: data.price,
        allergens: data.allergens,
        available: data.available,
        organizationId: session.organizationId,
        modifiers: {
          create: data.modifiers.map((mod) => ({
            name: mod.name,
            options: {
              create: mod.options,
            },
          })),
        },
      },
      include: {
        modifiers: {
          include: {
            options: true,
          },
        },
      },
    })

    return NextResponse.json(menuItem, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 }
      )
    }
    console.error("Menu item creation error:", error)
    return NextResponse.json(
      { error: "Failed to create menu item" },
      { status: 500 }
    )
  }
}
