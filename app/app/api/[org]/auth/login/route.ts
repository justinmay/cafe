import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { verifyPassword, createSession } from "@/lib/auth"

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ org: string }> }
) {
  try {
    const { org: orgSlug } = await params
    const body = await req.json()
    const { username, password } = loginSchema.parse(body)

    // Find organization by slug
    const organization = await prisma.organization.findUnique({
      where: { slug: orgSlug },
      include: {
        members: {
          include: {
            user: true,
          },
        },
      },
    })

    if (!organization) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      )
    }

    // Find user with matching username who is a member of this org
    const membership = organization.members.find(
      (m) => m.user.username === username
    )

    if (!membership) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      )
    }

    // Verify password
    const valid = await verifyPassword(password, membership.user.passwordHash)
    if (!valid) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      )
    }

    await createSession(
      membership.user.id,
      organization.id,
      organization.slug
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input" },
        { status: 400 }
      )
    }
    console.error("Login error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
