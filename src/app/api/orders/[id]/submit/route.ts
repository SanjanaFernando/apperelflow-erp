import { NextResponse } from "next/server";
import { requireRole } from "@/server/auth";
import { isDatabaseConfigured } from "@/server/db";
import { submitDatabaseOrder } from "@/server/order-repository";
import { getAppStore, getOrderById, submitOrder } from "@/server/store";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireRole(["cutting_supervisor"]);
  if (!authResult.ok) {
    return authResult.response;
  }

  const { id } = await params;
  if (isDatabaseConfigured()) {
    try {
      const order = await submitDatabaseOrder(id, authResult.session.sub);
      return NextResponse.json({ order });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "INVALID_TRANSITION";
      return NextResponse.json(
        {
          error: {
            code: message === "INVALID_TRANSITION" ? message : "DATABASE_ERROR",
            message,
          },
        },
        { status: message === "INVALID_TRANSITION" ? 409 : 500 },
      );
    }
  }

  const store = getAppStore();
  const order = getOrderById(store, id);

  if (!order) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Order not found." } },
      { status: 404 },
    );
  }

  if (order.createdById !== authResult.session.sub) {
    return NextResponse.json(
      {
        error: { code: "FORBIDDEN", message: "You cannot submit this order." },
      },
      { status: 403 },
    );
  }

  if (order.status !== "CUTTING_IN_PROGRESS") {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_TRANSITION",
          message: "This order is not in cutting progress.",
        },
      },
      { status: 409 },
    );
  }

  try {
    const updated = submitOrder(store, id, authResult.session.sub);
    return NextResponse.json({ order: updated });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to submit order.";
    return NextResponse.json(
      { error: { code: "INVALID_TRANSITION", message } },
      { status: 409 },
    );
  }
}
