import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { hashPassword } from "@/lib/auth"

const registerSchema = z.object({
  orgName: z.string().min(1).max(100),
  orgSlug: z
    .string()
    .min(3)
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens only"),
  username: z.string().min(3).max(50),
  password: z.string().min(6).max(100),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { orgName, orgSlug, username, password } = registerSchema.parse(body)

    // Check if slug is already taken
    const existingOrg = await prisma.organization.findUnique({
      where: { slug: orgSlug },
    })

    if (existingOrg) {
      return NextResponse.json(
        { error: "This URL is already taken" },
        { status: 400 }
      )
    }

    // Check if username is already taken
    const existingUser = await prisma.user.findUnique({
      where: { username },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "This username is already taken" },
        { status: 400 }
      )
    }

    const passwordHash = await hashPassword(password)

    // Create user, organization, and membership in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          username,
          passwordHash,
        },
      })

      const organization = await tx.organization.create({
        data: {
          name: orgName,
          slug: orgSlug,
          members: {
            create: {
              userId: user.id,
              role: "owner",
            },
          },
        },
      })

      return { user, organization }
    })

    return NextResponse.json(
      {
        success: true,
        organization: {
          id: result.organization.id,
          name: result.organization.name,
          slug: result.organization.slug,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 }
      )
    }
    console.error("Registration error:", error)
    return NextResponse.json(
      { error: "Failed to create organization" },
      { status: 500 }
    )
  }
}
