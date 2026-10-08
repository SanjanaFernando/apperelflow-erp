import { NextResponse } from "next/server";
import { requireRole } from "@/server/auth";
import { isDatabaseConfigured } from "@/server/db";
import { getOrderMetricsForRole as getDatabaseMetrics } from "@/server/order-repository";
import {
  getAppStore,
  getOrderMetricsForRole as getDemoMetrics,
} from "@/server/store";

export async function GET() {
  const authResult = await requireRole([
    "cutting_supervisor",
    "cutting_verifier",
    "sewing_supervisor",
  ]);
  if (!authResult.ok) return authResult.response;

  const metrics = isDatabaseConfigured()
    ? await getDatabaseMetrics(authResult.session.sub, authResult.session.role)
    : getDemoMetrics(
        getAppStore(),
        authResult.session.sub,
        authResult.session.role,
      );

  return NextResponse.json({ metrics });
}
