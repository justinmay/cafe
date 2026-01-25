import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

const updateSettingsSchema = z.object({
  checkoutMessage: z.string().max(500).nullable().optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ org: string }> }
) {
  const { org: orgSlug } = await params;
  const session = await getSession();

  if (!session || session.organizationSlug !== orgSlug) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const organization = await prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: { checkoutMessage: true },
    });

    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    return NextResponse.json({ checkoutMessage: organization.checkoutMessage });
  } catch (error) {
    console.error("Settings fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ org: string }> }
) {
  const { org: orgSlug } = await params;
  const session = await getSession();

  if (!session || session.organizationSlug !== orgSlug) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const data = updateSettingsSchema.parse(body);

    const organization = await prisma.organization.update({
      where: { id: session.organizationId },
      data: { checkoutMessage: data.checkoutMessage },
      select: { checkoutMessage: true },
    });

    return NextResponse.json({ checkoutMessage: organization.checkoutMessage });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Settings update error:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
