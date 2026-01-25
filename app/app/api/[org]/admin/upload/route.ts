import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { uploadToS3 } from "@/lib/s3";
import { randomUUID } from "crypto";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ org: string }> }
) {
  const { org: orgSlug } = await params;
  const session = await getSession();

  if (!session || session.organizationSlug !== orgSlug) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const ext = file.name.split(".").pop() || "";
    const key = `${session.organizationId}/${randomUUID()}.${ext}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const publicUrl = await uploadToS3(key, buffer, file.type);

    return NextResponse.json({ publicUrl });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Invalid content type")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload image" },
      { status: 500 }
    );
  }
}
