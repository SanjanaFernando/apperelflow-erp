import {
  canApprove,
  classifyItem,
  computeWastage,
} from "@/server/domain/verification";
import { prisma } from "@/server/db";
import type { OrderStatus as PrismaOrderStatus, Prisma } from "@prisma/client";

const orderQuery = {
  include: {
    recipe: { include: { components: true } },
    items: { include: { component: true } },
    events: true,
  },
} as const;

export class VerificationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details: string[] = [],
  ) {
    super(message);
  }
}

type VerificationOrder = Prisma.CuttingOrderGetPayload<typeof orderQuery>;

async function lockOrder(
  transaction: Prisma.TransactionClient,
  orderId: string,
) {
  const rows = await transaction.$queryRaw<
    Array<{ id: string; status: PrismaOrderStatus }>
  >`SELECT "id", "status" FROM "CuttingOrder" WHERE "id" = ${orderId} FOR UPDATE`;
  const order = rows[0];
  if (!order) throw new VerificationError("Order not found.", "NOT_FOUND");
  if (order.status !== "PENDING_VERIFICATION") {
    throw new VerificationError(
      "This order is not pending verification.",
      "INVALID_TRANSITION",
    );
  }
  return order;
}

function getVariances(order: VerificationOrder) {
  return order.items.map((item) => ({
    componentId: item.componentId,
    component: item.component.componentName,
    expected: item.expectedQty,
    actual: item.actualQty,
    variance:
      item.actualQty === null ? null : item.actualQty - item.expectedQty,
    status:
      item.actualQty === null
        ? null
        : classifyItem(item.expectedQty, item.actualQty),
  }));
}

async function getLockedOrder(
  transaction: Prisma.TransactionClient,
  orderId: string,
) {
  return transaction.cuttingOrder.findUnique({
    where: { id: orderId },
    ...orderQuery,
  });
}

export async function updateVerificationCount(
  orderId: string,
  componentId: string,
  actualQty: number,
) {
  return prisma.$transaction(async (transaction) => {
    const order = await transaction.cuttingOrder.findUnique({
      where: { id: orderId },
      select: { status: true },
    });
    if (!order) throw new VerificationError("Order not found.", "NOT_FOUND");
    if (order.status !== "PENDING_VERIFICATION") {
      throw new VerificationError(
        "Counts can only be edited while verification is pending.",
        "INVALID_TRANSITION",
      );
    }

    const item = await transaction.verificationItem.findFirst({
      where: { orderId, componentId },
      select: { expectedQty: true },
    });
    if (!item) throw new VerificationError("Component not found.", "NOT_FOUND");

    const updated = await transaction.verificationItem.update({
      where: { orderId_componentId: { orderId, componentId } },
      data: {
        actualQty,
        status: classifyItem(item.expectedQty, actualQty),
      },
      include: { component: true },
    });
    return updated;
  });
}

export async function approveOrder(orderId: string, verifierId: string) {
  return prisma.$transaction(async (transaction) => {
    await lockOrder(transaction, orderId);
    const order = await getLockedOrder(transaction, orderId);
    if (!order) throw new VerificationError("Order not found.", "NOT_FOUND");

    const blockers = canApprove(
      order.items.map((item) => ({
        componentName: item.component.componentName,
        expected: item.expectedQty,
        actual: item.actualQty,
      })),
    ).blockers;
    if (order.items.length !== order.recipe.components.length) {
      blockers.push("One or more recipe components are missing.");
    }
    if (blockers.length > 0) {
      throw new VerificationError(
        "Approval is blocked until every component is counted without shortage.",
        "SHORTAGE_BLOCKED",
        blockers,
      );
    }

    const expectedFabricYds =
      order.targetQty * Number(order.recipe.stdFabricYards);
    const actualFabricYds = Number(order.actualFabricYds);
    const wastagePct = computeWastage(
      actualFabricYds,
      order.targetQty,
      Number(order.recipe.stdFabricYards),
    );
    await transaction.verificationLog.create({
      data: {
        orderId,
        verifierId,
        decision: "APPROVED",
        wastagePct,
        expectedFabricYds,
        actualFabricYds,
        componentVariances: getVariances(order),
      },
    });
    const updated = await transaction.cuttingOrder.updateMany({
      where: { id: orderId, status: "PENDING_VERIFICATION" },
      data: { status: "VERIFIED" },
    });
    if (updated.count !== 1) {
      throw new VerificationError(
        "The order changed before approval.",
        "INVALID_TRANSITION",
      );
    }
    await transaction.orderEvent.create({
      data: {
        orderId,
        actorId: verifierId,
        fromStatus: "PENDING_VERIFICATION",
        toStatus: "VERIFIED",
      },
    });
    return transaction.cuttingOrder.findUnique({
      where: { id: orderId },
      ...orderQuery,
    });
  });
}

export async function rejectOrder(
  orderId: string,
  verifierId: string,
  rejectionNote: string,
) {
  return prisma.$transaction(async (transaction) => {
    await lockOrder(transaction, orderId);
    const order = await getLockedOrder(transaction, orderId);
    if (!order) throw new VerificationError("Order not found.", "NOT_FOUND");

    const expectedFabricYds =
      order.targetQty * Number(order.recipe.stdFabricYards);
    await transaction.verificationLog.create({
      data: {
        orderId,
        verifierId,
        decision: "REJECTED",
        rejectionNote,
        wastagePct: computeWastage(
          Number(order.actualFabricYds),
          order.targetQty,
          Number(order.recipe.stdFabricYards),
        ),
        expectedFabricYds,
        actualFabricYds: Number(order.actualFabricYds),
        componentVariances: getVariances(order),
      },
    });
    const updated = await transaction.cuttingOrder.updateMany({
      where: { id: orderId, status: "PENDING_VERIFICATION" },
      data: { status: "REJECTED", rejectionCount: { increment: 1 } },
    });
    if (updated.count !== 1) {
      throw new VerificationError(
        "The order changed before rejection.",
        "INVALID_TRANSITION",
      );
    }
    await transaction.orderEvent.create({
      data: {
        orderId,
        actorId: verifierId,
        fromStatus: "PENDING_VERIFICATION",
        toStatus: "REJECTED",
      },
    });
    return transaction.cuttingOrder.findUnique({
      where: { id: orderId },
      ...orderQuery,
    });
  });
}

export async function getVerificationHistory(orderId: string) {
  const [logs, events] = await Promise.all([
    prisma.verificationLog.findMany({
      where: { orderId },
      include: { verifier: { select: { id: true, fullName: true } } },
      orderBy: { timestamp: "desc" },
    }),
    prisma.orderEvent.findMany({
      where: { orderId },
      orderBy: { at: "desc" },
    }),
  ]);
  return { logs, events };
}
