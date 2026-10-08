import { NextResponse } from "next/server";
import { requireRole } from "@/server/auth";
import { isDatabaseConfigured } from "@/server/db";
import { getOrderForRole } from "@/server/order-repository";
import { getVerificationHistory } from "@/server/verification-repository";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireRole([
    "cutting_supervisor",
    "cutting_verifier",
  ]);
  if (!authResult.ok) return authResult.response;
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      {
        error: {
          code: "DATABASE_REQUIRED",
          message: "History requires database mode.",
        },
      },
      { status: 503 },
    );
  }

  const { id } = await params;
  const order = await getOrderForRole(
    id,
    authResult.session.sub,
    authResult.session.role,
  );
  if (!order) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Order not found." } },
      { status: 404 },
    );
  }

  const history = await getVerificationHistory(id);
  return NextResponse.json(history);
}
