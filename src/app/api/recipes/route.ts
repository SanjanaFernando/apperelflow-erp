import { NextResponse } from "next/server";
import { requireRole } from "@/server/auth";
import { isDatabaseConfigured } from "@/server/db";
import { listRecipes } from "@/server/order-repository";
import { getAppStore } from "@/server/store";

export async function GET() {
  const authResult = await requireRole([
    "cutting_supervisor",
    "cutting_verifier",
    "sewing_supervisor",
  ]);
  if (!authResult.ok) return authResult.response;

  if (isDatabaseConfigured()) {
    return NextResponse.json({ recipes: await listRecipes() });
  }

  return NextResponse.json({
    recipes: getAppStore().recipes,
  });
}