import { NextResponse } from "next/server";
import { requireRole } from "@/server/auth";
import { isDatabaseConfigured } from "@/server/db";
import {
  approveOrder,
  VerificationError,
} from "@/server/verification-repository";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireRole(["cutting_verifier"]);
  if (!authResult.ok) return authResult.response;
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      {
        error: {
          code: "DATABASE_REQUIRED",
          message: "Verification requires database mode.",
        },
      },
      { status: 503 },
    );
  }

  try {
    const { id } = await params;
    const order = await approveOrder(id, authResult.session.sub);
    return NextResponse.json({
      order: { id: order?.id, status: order?.status },
    });
  } catch (error) {
    if (error instanceof VerificationError) {
      const status =
        error.code === "SHORTAGE_BLOCKED"
          ? 422
          : error.code === "NOT_FOUND"
            ? 404
            : 409;
      return NextResponse.json(
        {
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
          },
        },
        { status },
      );
    }
    return NextResponse.json(
      {
        error: {
          code: "DATABASE_ERROR",
          message: "Unable to approve the order.",
        },
      },
      { status: 500 },
    );
  }
}
