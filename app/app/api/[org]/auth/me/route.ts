import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ org: string }> }
) {
  const { org: orgSlug } = await params
  const session = await getSession()

  if (!session || session.organizationSlug !== orgSlug) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      username: true,
      memberships: {
        where: { organizationId: session.organizationId },
        select: {
          role: true,
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      },
    },
  })

  if (!user || user.memberships.length === 0) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const membership = user.memberships[0]

  return NextResponse.json({
    id: user.id,
    username: user.username,
    role: membership.role,
    organization: membership.organization,
  })
}
