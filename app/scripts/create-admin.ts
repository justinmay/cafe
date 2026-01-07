import "dotenv/config"
import { PrismaClient } from "../app/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import bcrypt from "bcryptjs"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  const orgSlug = process.argv[2]
  const orgName = process.argv[3]
  const username = process.argv[4]
  const password = process.argv[5]

  if (!orgSlug || !orgName || !username || !password) {
    console.error("Usage: npx tsx scripts/create-admin.ts <org-slug> <org-name> <username> <password>")
    console.error("Example: npx tsx scripts/create-admin.ts joes-coffee \"Joe's Coffee\" admin password123")
    process.exit(1)
  }

  const passwordHash = await bcrypt.hash(password, 12)

  // Check if org exists
  const existingOrg = await prisma.organization.findUnique({
    where: { slug: orgSlug },
  })

  if (existingOrg) {
    console.error(`Organization with slug "${orgSlug}" already exists`)
    process.exit(1)
  }

  // Check if username exists
  const existingUser = await prisma.user.findUnique({
    where: { username },
  })

  if (existingUser) {
    console.error(`User with username "${username}" already exists`)
    process.exit(1)
  }

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
        slug: orgSlug,
        name: orgName,
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

  console.log(`Organization "${result.organization.name}" created successfully!`)
  console.log(`  Slug: ${result.organization.slug}`)
  console.log(`  Admin: ${result.user.username}`)
  console.log(`\nCustomers can order at: /${result.organization.slug}/menu`)
  console.log(`Admin login at: /login`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
