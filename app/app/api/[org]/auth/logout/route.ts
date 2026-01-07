import { NextRequest, NextResponse } from "next/server"
import { clearSession } from "@/lib/auth"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ org: string }> }
) {
  const { org: orgSlug } = await params
  await clearSession()
  return NextResponse.redirect(new URL(`/${orgSlug}/login`, req.url))
}
