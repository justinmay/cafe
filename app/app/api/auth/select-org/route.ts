import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { createSession, getSession } from "@/lib/auth"

const selectOrgSchema = z.object({
  userId: z.string().optional(),
  orgId: z.string(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { userId: bodyUserId, orgId } = selectOrgSchema.parse(body)

    // Get userId from session or body (for initial login flow)
    const session = await getSession()
    const userId = session?.userId || bodyUserId

    if (!userId) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      )
    }

    // Verify user has access to this org
    const membership = await prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId: orgId,
        },
      },
      include: {
        organization: true,
      },
    })

    if (!membership) {
      return NextResponse.json(
        { error: "You don't have access to this organization" },
        { status: 403 }
      )
    }

    await createSession(userId, membership.organization.id, membership.organization.slug)

    return NextResponse.json({
      success: true,
      orgSlug: membership.organization.slug,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input" },
        { status: 400 }
      )
    }
    console.error("Select org error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
