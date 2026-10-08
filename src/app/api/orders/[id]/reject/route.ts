import { NextResponse } from "next/server";
import { rejectionRequestSchema } from "@/lib/validators";
import { requireRole } from "@/server/auth";
import { isDatabaseConfigured } from "@/server/db";
import {
  rejectOrder,
  VerificationError,
} from "@/server/verification-repository";

export async function POST(
  request: Request,
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

  const body = await request.json().catch(() => ({}));
  const parsed = rejectionRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_REJECTION_NOTE",
          message: "A rejection reason of at least 10 characters is required.",
          details: parsed.error.flatten().fieldErrors,
        },
      },
      { status: 400 },
    );
  }

  try {
    const { id } = await params;
    const order = await rejectOrder(
      id,
      authResult.session.sub,
      parsed.data.note,
    );
    return NextResponse.json({
      order: { id: order?.id, status: order?.status },
    });
  } catch (error) {
    if (error instanceof VerificationError) {
      const status = error.code === "NOT_FOUND" ? 404 : 409;
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
          message: "Unable to reject the order.",
        },
      },
      { status: 500 },
    );
  }
}
