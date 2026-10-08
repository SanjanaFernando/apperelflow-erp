import { NextResponse } from "next/server";
import { requireRole } from "@/server/auth";
import { isDatabaseConfigured } from "@/server/db";
import { getSewingActive } from "@/server/sewing-repository";

export async function GET() {
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
  return NextResponse.json({ orders: await getSewingActive() });
}
