import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"

const updateMenuItemSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  image: z.string().url().nullable().optional(),
  price: z.number().int().min(0).optional(),
  allergens: z.string().max(500).nullable().optional(),
  available: z.boolean().optional(),
  modifiers: z.array(
    z.object({
      id: z.string().optional(),
      name: z.string().min(1).max(50),
      options: z.array(
        z.object({
          id: z.string().optional(),
          name: z.string().min(1).max(50),
          priceAdjustment: z.number().int(),
        })
      ),
    })
  ).optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ org: string; id: string }> }
) {
  const { org: orgSlug, id } = await params
  const session = await getSession()

  if (!session || session.organizationSlug !== orgSlug) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await req.json()
    const data = updateMenuItemSchema.parse(body)

    // Verify menu item belongs to this organization
    const existingItem = await prisma.menuItem.findFirst({
      where: {
        id,
        organizationId: session.organizationId,
      },
    })

    if (!existingItem) {
      return NextResponse.json(
        { error: "Menu item not found" },
        { status: 404 }
      )
    }

    // If modifiers are being updated, delete existing and recreate
    if (data.modifiers !== undefined) {
      await prisma.modifier.deleteMany({
        where: { menuItemId: id },
      })
    }

    const menuItem = await prisma.menuItem.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.image !== undefined && { image: data.image }),
        ...(data.price !== undefined && { price: data.price }),
        ...(data.allergens !== undefined && { allergens: data.allergens }),
        ...(data.available !== undefined && { available: data.available }),
        ...(data.modifiers !== undefined && {
          modifiers: {
            create: data.modifiers.map((mod) => ({
              name: mod.name,
              options: {
                create: mod.options.map((opt) => ({
                  name: opt.name,
                  priceAdjustment: opt.priceAdjustment,
                })),
              },
            })),
          },
        }),
      },
      include: {
        modifiers: {
          include: {
            options: true,
          },
        },
      },
    })

    return NextResponse.json(menuItem)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 }
      )
    }
    console.error("Menu item update error:", error)
    return NextResponse.json(
      { error: "Failed to update menu item" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ org: string; id: string }> }
) {
  const { org: orgSlug, id } = await params
  const session = await getSession()

  if (!session || session.organizationSlug !== orgSlug) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Verify menu item belongs to this organization
    const existingItem = await prisma.menuItem.findFirst({
      where: {
        id,
        organizationId: session.organizationId,
      },
    })

    if (!existingItem) {
      return NextResponse.json(
        { error: "Menu item not found" },
        { status: 404 }
      )
    }

    await prisma.menuItem.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Menu item deletion error:", error)
    return NextResponse.json(
      { error: "Failed to delete menu item" },
      { status: 500 }
    )
  }
}
