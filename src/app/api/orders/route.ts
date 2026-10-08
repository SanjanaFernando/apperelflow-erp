import { NextResponse } from "next/server";
import { requireRole } from "@/server/auth";
import { isDatabaseConfigured } from "@/server/db";
import {
  createOrder as createDatabaseOrder,
  listOrdersForRole,
} from "@/server/order-repository";
import {
  getAppStore,
  getOrdersForRole,
  orderCreateSchema,
  orderFactory,
} from "@/server/store";

export async function GET(request: Request) {
  const authResult = await requireRole([
    "cutting_supervisor",
    "cutting_verifier",
  ]);
  if (!authResult.ok) {
    return authResult.response;
  }

  const store = getAppStore();
  const url = new URL(request.url);
  const statusFilter = url.searchParams.get("status");
  const rawOrders = isDatabaseConfigured()
    ? await listOrdersForRole(authResult.session.sub, authResult.session.role)
    : getOrdersForRole(store, authResult.session.sub, authResult.session.role);

  const filtered = statusFilter
    ? rawOrders.filter((order) => order.status === statusFilter)
    : rawOrders;

  const limitParam = url.searchParams.get("limit");
  const pageParam = url.searchParams.get("page");
  if (limitParam) {
    const limit = Math.max(1, parseInt(limitParam, 10) || 10);
    const page = Math.max(1, parseInt(pageParam || "1", 10) || 1);
    const startIndex = (page - 1) * limit;
    return NextResponse.json({
      orders: filtered.slice(startIndex, startIndex + limit),
      pagination: {
        page,
        limit,
        total: filtered.length,
        totalPages: Math.max(1, Math.ceil(filtered.length / limit)),
      },
    });
  }

  return NextResponse.json({ orders: filtered });
}

export async function POST(request: Request) {
  const authResult = await requireRole(["cutting_supervisor"]);
  if (!authResult.ok) {
    return authResult.response;
  }

  const body = await request.json().catch(() => ({}));
  const parsed = orderCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_ORDER",
          message: "The order payload is invalid.",
          details: parsed.error.flatten().fieldErrors,
        },
      },
      { status: 400 },
    );
  }

  const store = getAppStore();
  if (isDatabaseConfigured()) {
    try {
      const order = await createDatabaseOrder({
        actorId: authResult.session.sub,
        recipeId: parsed.data.recipeId,
        targetQty: parsed.data.targetQty,
        fabricRollId: parsed.data.fabricRollId,
        actualFabricYds: parsed.data.actualFabricYds,
      });
      return NextResponse.json({ order }, { status: 201 });
    } catch (error) {
      if (error instanceof Error && error.message === "INVALID_RECIPE") {
        return NextResponse.json(
          {
            error: {
              code: "INVALID_RECIPE",
              message: "The selected recipe does not exist.",
            },
          },
          { status: 400 },
        );
      }
      return NextResponse.json(
        {
          error: {
            code: "DATABASE_ERROR",
            message: "Unable to create the order.",
          },
        },
        { status: 500 },
      );
    }
  }

  const recipeId = parsed.data.recipeId;
  const recipe = store.recipes.find((entry) => entry.id === recipeId);

  if (!recipe) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_RECIPE",
          message: "The selected recipe does not exist.",
        },
      },
      { status: 400 },
    );
  }

  const order = orderFactory.create({
    store,
    actorId: authResult.session.sub,
    recipeId,
    targetQty: parsed.data.targetQty,
    fabricRollId: parsed.data.fabricRollId,
    actualFabricYds: parsed.data.actualFabricYds,
  });

  return NextResponse.json({ order }, { status: 201 });
}
