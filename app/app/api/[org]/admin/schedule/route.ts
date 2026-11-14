import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { Prisma } from "@/app/generated/prisma/client"
import { getSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { nameLimit, shiftEnd, stations } from "@/lib/schedule"

type Context = { params: Promise<{ org: string }> }

async function scheduleOrganization({ params }: Context) {
  const { org } = await params
  const session = await getSession()
  return session?.organizationSlug === org ? session.organizationId : null
}

const editSchema = z.object({
  station: z.enum(stations.map((station) => station.id)),
  startMinute: z.number().int(),
  previousName: z.string().min(1).max(nameLimit).nullable(),
  name: z.string().trim().min(1).max(nameLimit).nullable(),
}).refine(({ station, startMinute }) =>
  stations.some(({ id, starts }) => id === station && shiftEnd(starts, startMinute) !== null)
)

export async function GET(_request: NextRequest, context: Context) {
  const organizationId = await scheduleOrganization(context)
  if (!organizationId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const signups = await prisma.shiftSignup.findMany({
      where: { organizationId },
      select: { station: true, startMinute: true, name: true },
    })
    return NextResponse.json(signups)
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {
      return NextResponse.json({ error: "Signups will open when the schedule database migration is applied." }, { status: 503 })
    }
    throw error
  }
}

export async function PUT(request: NextRequest, context: Context) {
  const organizationId = await scheduleOrganization(context)
  if (!organizationId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const edit = editSchema.safeParse(await request.json().catch(() => null))
  if (!edit.success) return NextResponse.json({ error: "Invalid signup" }, { status: 400 })

  const { station, startMinute, previousName, name } = edit.data
  const slot = { organizationId, station, startMinute }
  let changed
  if (previousName === null) {
    if (name === null) return NextResponse.json({ error: "Enter a name" }, { status: 400 })
    changed = await prisma.shiftSignup.createMany({ data: { ...slot, name }, skipDuplicates: true })
  } else {
    const where = { ...slot, name: previousName }
    changed = name === null
      ? await prisma.shiftSignup.deleteMany({ where })
      : await prisma.shiftSignup.updateMany({ where, data: { name } })
  }

  if (!changed.count) {
    const current = await prisma.shiftSignup.findUnique({
      where: { organizationId_station_startMinute: slot },
      select: { name: true },
    })
    return NextResponse.json({ name: current?.name ?? null }, { status: 409 })
  }
  return new NextResponse(null, { status: 204 })
}
