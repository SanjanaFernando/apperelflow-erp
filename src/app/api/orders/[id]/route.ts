import { NextResponse } from "next/server";
import { requireRole } from "@/server/auth";
import { isDatabaseConfigured } from "@/server/db";
import { getOrderForRole } from "@/server/order-repository";
import { getAppStore, getOrderById, getOrdersForRole } from "@/server/store";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireRole([
    "cutting_supervisor",
    "cutting_verifier",
    "sewing_supervisor",
  ]);
  if (!authResult.ok) {
    return authResult.response;
  }

  const { id } = await params;
  if (isDatabaseConfigured()) {
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
    return NextResponse.json({ order });
  }

  const store = getAppStore();
  const order = getOrderById(store, id);

  if (!order) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Order not found." } },
      { status: 404 },
    );
  }

  if (
    authResult.session.role === "cutting_supervisor" &&
    order.createdById !== authResult.session.sub
  ) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Order not found." } },
      { status: 404 },
    );
  }

  if (authResult.session.role === "cutting_verifier") {
    const allowedStatuses = [
      "PENDING_VERIFICATION",
      "VERIFIED",
      "REJECTED",
      "SEWING_IN_PROGRESS",
    ];
    if (!allowedStatuses.includes(order.status)) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Order not found." } },
        { status: 404 },
      );
    }
  }

  if (authResult.session.role === "sewing_supervisor") {
    const allowedStatuses = ["VERIFIED", "SEWING_IN_PROGRESS"];
    if (!allowedStatuses.includes(order.status)) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Order not found." } },
        { status: 404 },
      );
    }
  }

  const orderList = getOrdersForRole(
    store,
    authResult.session.sub,
    authResult.session.role,
  );
  if (!orderList.some((entry) => entry.id === order.id)) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Order not found." } },
      { status: 404 },
    );
  }

  return NextResponse.json({ order });
}
