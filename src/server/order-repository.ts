import { prisma } from "@/server/db";
import { computeExpected } from "@/server/domain/order-engine";
import type { AppRole, OrderRecord } from "@/server/store";
import type { OrderStatus as PrismaOrderStatus, Prisma } from "@prisma/client";

const orderQuery = {
  include: {
    recipe: true,
    items: { include: { component: true } },
    events: true,
  },
} as const;

const orderListQuery = {
  include: { recipe: true },
} as const;

type DatabaseOrder = Prisma.CuttingOrderGetPayload<typeof orderQuery>;
type DatabaseOrderSummary = Prisma.CuttingOrderGetPayload<
  typeof orderListQuery
>;

function toOrderRecord(order: DatabaseOrder | null): OrderRecord | null {
  if (!order) return null;

  return {
    id: order.id,
    orderNo: order.orderNo,
    recipeId: order.recipeId,
    recipeCode: order.recipe.recipeCode,
    createdById: order.createdById,
    targetQty: order.targetQty,
    fabricRollId: order.fabricRollId ?? "",
    actualFabricYds: Number(order.actualFabricYds),
    status: order.status,
    submittedAt: order.submittedAt?.toISOString() ?? null,
    rejectionCount: order.rejectionCount,
    items: order.items.map((item) => ({
      id: item.id,
      componentId: item.componentId,
      componentName: item.component.componentName,
      expectedQty: item.expectedQty,
      actualQty: item.actualQty,
      status: item.status,
    })),
    events: order.events.map((event) => ({
      id: event.id,
      fromStatus: event.fromStatus,
      toStatus: event.toStatus,
      actorId: event.actorId ?? "",
    })),
  };
}

function toOrderSummary(order: DatabaseOrderSummary): OrderRecord {
  return {
    id: order.id,
    orderNo: order.orderNo,
    recipeId: order.recipeId,
    recipeCode: order.recipe.recipeCode,
    createdById: order.createdById,
    targetQty: order.targetQty,
    fabricRollId: order.fabricRollId ?? "",
    actualFabricYds: Number(order.actualFabricYds),
    status: order.status,
    submittedAt: order.submittedAt?.toISOString() ?? null,
    rejectionCount: order.rejectionCount,
    items: [],
    events: [],
  };
}

export async function listOrdersForRole(userId: string, role: AppRole) {
  const where: Prisma.CuttingOrderWhereInput =
    role === "cutting_supervisor"
      ? { createdById: userId }
      : role === "sewing_supervisor"
        ? {
            status: {
              in: [
                "VERIFIED",
                "SEWING_IN_PROGRESS",
              ] as PrismaOrderStatus[],
            },
          }
        : role === "cutting_verifier"
          ? {
              status: {
                in: [
                  "PENDING_VERIFICATION",
                  "VERIFIED",
                  "REJECTED",
                  "SEWING_IN_PROGRESS",
                ] as PrismaOrderStatus[],
              },
            }
          : { id: "__no_orders__" };

  const orders = await prisma.cuttingOrder.findMany({
    where,
    ...orderListQuery,
    orderBy: { createdAt: "desc" },
  });
  return orders.map(toOrderSummary);
}

export async function getOrderMetricsForRole(userId: string, role: AppRole) {
  const ownerFilter: Prisma.CuttingOrderWhereInput =
    role === "cutting_supervisor" ? { createdById: userId } : {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [ordersInCutting, awaitingQc, rejected, verifiedToday] =
    await Promise.all([
      prisma.cuttingOrder.count({
        where: { ...ownerFilter, status: "CUTTING_IN_PROGRESS" },
      }),
      prisma.cuttingOrder.count({
        where: { ...ownerFilter, status: "PENDING_VERIFICATION" },
      }),
      prisma.cuttingOrder.count({
        where: { ...ownerFilter, status: "REJECTED" },
      }),
      prisma.verificationLog.count({
        where: {
          decision: "APPROVED",
          timestamp: { gte: today },
          order: ownerFilter,
        },
      }),
    ]);

  return { ordersInCutting, awaitingQc, rejected, verifiedToday };
}

export async function getOrderForRole(
  orderId: string,
  userId: string,
  role: AppRole,
) {
  const order = await prisma.cuttingOrder.findUnique({
    where: { id: orderId },
    ...orderQuery,
  });
  const record = toOrderRecord(order);
  if (!record) return null;
  if (role === "cutting_supervisor" && record.createdById !== userId)
    return null;
  if (
    role === "cutting_verifier" &&
    ![
      "PENDING_VERIFICATION",
      "VERIFIED",
      "REJECTED",
      "SEWING_IN_PROGRESS",
    ].includes(record.status)
  ) {
    return null;
  }
  if (
    role === "sewing_supervisor" &&
    !["VERIFIED", "SEWING_IN_PROGRESS"].includes(record.status)
  ) {
    return null;
  }
  return record;
}

export async function createOrder(input: {
  actorId: string;
  recipeId: string;
  targetQty: number;
  fabricRollId: string;
  actualFabricYds: number;
}) {
  const recipe = await prisma.recipe.findUnique({
    where: { id: input.recipeId },
    include: { components: true },
  });
  if (!recipe) throw new Error("INVALID_RECIPE");

  const created = await prisma.$transaction(
    async (transaction) => {
      const count = await transaction.cuttingOrder.count({
        where: { orderNo: { startsWith: `CUT-${new Date().getFullYear()}-` } },
      });
      const orderNo = `CUT-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;
      return transaction.cuttingOrder.create({
        data: {
          orderNo,
          recipeId: input.recipeId,
          createdById: input.actorId,
          targetQty: input.targetQty,
          fabricRollId: input.fabricRollId,
          actualFabricYds: input.actualFabricYds,
          items: {
            create: recipe.components.map((component) => ({
              componentId: component.id,
              expectedQty: computeExpected(
                input.targetQty,
                component.piecesPerGarment,
              ),
            })),
          },
          events: {
            create: {
              fromStatus: null,
              toStatus: "CUTTING_IN_PROGRESS",
              actorId: input.actorId,
            },
          },
        },
        ...orderQuery,
      });
    },
    { maxWait: 15000, timeout: 30000 },
  );

  return toOrderRecord(created);
}

export async function listRecipes() {
  const recipes = await prisma.recipe.findMany({
    include: { components: true },
    orderBy: { recipeCode: "asc" },
  });
  return recipes.map((recipe) => ({
    id: recipe.id,
    recipeCode: recipe.recipeCode,
    name: recipe.name,
    category: recipe.category,
    stdFabricYards: Number(recipe.stdFabricYards),
    wastageCap: Number(recipe.wastageCap),
    components: recipe.components.map((component) => ({
      id: component.id,
      componentName: component.componentName,
      piecesPerGarment: component.piecesPerGarment,
    })),
  }));
}

export async function submitDatabaseOrder(orderId: string, actorId: string) {
  const result = await prisma.$transaction(
    async (transaction) => {
      const updated = await transaction.cuttingOrder.updateMany({
        where: {
          id: orderId,
          createdById: actorId,
          status: "CUTTING_IN_PROGRESS",
        },
        data: { status: "PENDING_VERIFICATION", submittedAt: new Date() },
      });
      if (updated.count !== 1) throw new Error("INVALID_TRANSITION");
      await transaction.orderEvent.create({
        data: {
          orderId,
          actorId,
          fromStatus: "CUTTING_IN_PROGRESS",
          toStatus: "PENDING_VERIFICATION",
        },
      });
      return transaction.cuttingOrder.findUnique({
        where: { id: orderId },
        ...orderQuery,
      });
    },
    { maxWait: 15000, timeout: 30000 },
  );
  return toOrderRecord(result);
}

export async function recutDatabaseOrder(orderId: string, actorId: string) {
  const result = await prisma.$transaction(
    async (transaction) => {
      const updated = await transaction.cuttingOrder.updateMany({
        where: { id: orderId, createdById: actorId, status: "REJECTED" },
        data: { status: "CUTTING_IN_PROGRESS" },
      });
      if (updated.count !== 1) throw new Error("INVALID_TRANSITION");
      await transaction.verificationItem.updateMany({
        where: { orderId },
        data: { actualQty: null, status: null },
      });
      await transaction.orderEvent.create({
        data: {
          orderId,
          actorId,
          fromStatus: "REJECTED",
          toStatus: "CUTTING_IN_PROGRESS",
        },
      });
      return transaction.cuttingOrder.findUnique({
        where: { id: orderId },
        ...orderQuery,
      });
    },
    { maxWait: 15000, timeout: 30000 },
  );
  return toOrderRecord(result);
}
