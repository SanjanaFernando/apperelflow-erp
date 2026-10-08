import { prisma } from "@/server/db";
import { VerificationError } from "@/server/verification-repository";
import type { Prisma } from "@prisma/client";

const sewingQuery = {
  include: {
    recipe: true,
    items: { include: { component: true } },
    logs: {
      where: { decision: "APPROVED" },
      include: { verifier: { select: { fullName: true } } },
      orderBy: { timestamp: "desc" },
      take: 1,
    },
  },
} as const;

type SewingOrder = Prisma.CuttingOrderGetPayload<typeof sewingQuery>;

export type SewingOrderRecord = {
  id: string;
  orderNo: string;
  recipeCode: string;
  targetQty: number;
  fabricRollId: string;
  actualFabricYds: number;
  status: "VERIFIED" | "SEWING_IN_PROGRESS";
  items: Array<{
    id: string;
    componentName: string;
    expectedQty: number;
    actualQty: number | null;
    variance: number | null;
  }>;
  approval: {
    verifierName: string;
    verifiedAt: string;
    wastagePct: number | null;
    componentVariances: unknown;
  } | null;
};

function toSewingOrder(order: SewingOrder): SewingOrderRecord {
  const approval = order.logs[0];
  return {
    id: order.id,
    orderNo: order.orderNo,
    recipeCode: order.recipe.recipeCode,
    targetQty: order.targetQty,
    fabricRollId: order.fabricRollId ?? "",
    actualFabricYds: Number(order.actualFabricYds),
    status: order.status as "VERIFIED" | "SEWING_IN_PROGRESS",
    items: order.items.map((item) => ({
      id: item.id,
      componentName: item.component.componentName,
      expectedQty: item.expectedQty,
      actualQty: item.actualQty,
      variance:
        item.actualQty === null ? null : item.actualQty - item.expectedQty,
    })),
    approval: approval
      ? {
          verifierName: approval.verifier.fullName,
          verifiedAt: approval.timestamp.toISOString(),
          wastagePct:
            approval.wastagePct === null ? null : Number(approval.wastagePct),
          componentVariances: approval.componentVariances,
        }
      : null,
  };
}

export async function getSewingQueue() {
  const orders = await prisma.cuttingOrder.findMany({
    where: { status: "VERIFIED" },
    ...sewingQuery,
    orderBy: { updatedAt: "asc" },
  });
  return orders.map(toSewingOrder);
}

export async function getSewingActive() {
  const orders = await prisma.cuttingOrder.findMany({
    where: { status: "SEWING_IN_PROGRESS" },
    ...sewingQuery,
    orderBy: { updatedAt: "desc" },
  });
  return orders.map(toSewingOrder);
}

export async function startSewing(orderId: string, actorId: string) {
  return prisma
    .$transaction(
      async (transaction) => {
        const existing = await transaction.cuttingOrder.findUnique({
          where: { id: orderId },
          select: { status: true },
        });
        if (!existing || existing.status !== "VERIFIED") {
          throw new VerificationError(
            "Only verified orders can enter sewing.",
            "NOT_FOUND",
          );
        }

        const updated = await transaction.cuttingOrder.updateMany({
          where: { id: orderId, status: "VERIFIED" },
          data: { status: "SEWING_IN_PROGRESS" },
        });
        if (updated.count !== 1) {
          throw new VerificationError(
            "The order changed before sewing started.",
            "INVALID_TRANSITION",
          );
        }

        await transaction.orderEvent.create({
          data: {
            orderId,
            actorId,
            fromStatus: "VERIFIED",
            toStatus: "SEWING_IN_PROGRESS",
          },
        });

        return transaction.cuttingOrder.findUnique({
          where: { id: orderId },
          ...sewingQuery,
        });
      },
      { maxWait: 15000, timeout: 30000 },
    )
    .then((order) => (order ? toSewingOrder(order) : null));
}
