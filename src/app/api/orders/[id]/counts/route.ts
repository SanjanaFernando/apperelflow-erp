import { NextResponse } from "next/server";
import { verificationCountSchema } from "@/lib/validators";
import { requireRole } from "@/server/auth";
import { isDatabaseConfigured } from "@/server/db";
import {
  updateVerificationCount,
  VerificationError,
} from "@/server/verification-repository";

export async function PUT(
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
  const parsed = verificationCountSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_COUNT",
          message: "Component count must be a non-negative integer.",
          details: parsed.error.flatten().fieldErrors,
        },
      },
      { status: 400 },
    );
  }

  try {
    const { id } = await params;
    const item = await updateVerificationCount(
      id,
      parsed.data.componentId,
      parsed.data.actualQty,
    );
    return NextResponse.json({ item });
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
        error: { code: "DATABASE_ERROR", message: "Unable to save the count." },
      },
      { status: 500 },
    );
  }
}
