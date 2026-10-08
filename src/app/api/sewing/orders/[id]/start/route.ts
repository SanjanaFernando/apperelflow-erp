import { NextResponse } from "next/server";
import { requireRole } from "@/server/auth";
import { isDatabaseConfigured } from "@/server/db";
import { startSewing } from "@/server/sewing-repository";
import { VerificationError } from "@/server/verification-repository";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireRole(["sewing_supervisor"]);
  if (!authResult.ok) return authResult.response;
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      {
        error: {
          code: "DATABASE_REQUIRED",
          message: "Sewing requires database mode.",
        },
      },
      { status: 503 },
    );
  }

  try {
    const { id } = await params;
    const order = await startSewing(id, authResult.session.sub);
    return NextResponse.json({ order });
  } catch (error) {
    if (error instanceof VerificationError) {
      const status = error.code === "NOT_FOUND" ? 404 : 409;
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status },
      );
    }
    return NextResponse.json(
      { error: { code: "DATABASE_ERROR", message: "Unable to start sewing." } },
      { status: 500 },
    );
  }
}
