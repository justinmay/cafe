import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(
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

    const menuItems = await prisma.menuItem.findMany({
      where: {
        organizationId: organization.id,
        available: true,
      },
      include: {
        modifiers: {
          include: {
            options: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    })

    return NextResponse.json({
      organization: { name: organization.name, checkoutMessage: organization.checkoutMessage },
      menuItems,
    })
  } catch (error) {
    console.error("Menu fetch error:", error)
    return NextResponse.json(
      { error: "Failed to fetch menu" },
      { status: 500 }
    )
  }
}
