import { z } from "zod";
import { computeExpected } from "@/server/domain/order-engine";

export type AppRole =
  | "cutting_supervisor"
  | "cutting_verifier"
  | "sewing_supervisor";
export type OrderStatus =
  | "CUTTING_IN_PROGRESS"
  | "PENDING_VERIFICATION"
  | "VERIFIED"
  | "REJECTED"
  | "SEWING_IN_PROGRESS";

export type UserRecord = {
  id: string;
  email: string;
  name: string;
  role: AppRole;
  password: string;
};

export type ComponentRecord = {
  id: string;
  recipeId: string;
  componentName: string;
  piecesPerGarment: number;
};

export type RecipeRecord = {
  id: string;
  recipeCode: string;
  name: string;
  category: string;
  stdFabricYards: number;
  wastageCap: number;
  components: ComponentRecord[];
};

export type OrderItem = {
  id: string;
  componentId: string;
  componentName: string;
  expectedQty: number;
  actualQty: number | null;
  status: "GREEN" | "YELLOW" | "RED" | null;
};

export type OrderEvent = {
  id: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  actorId: string;
};

export type OrderRecord = {
  id: string;
  orderNo: string;
  recipeId: string;
  recipeCode: string;
  createdById: string;
  targetQty: number;
  fabricRollId: string;
  actualFabricYds: number;
  status: OrderStatus;
  submittedAt: string | null;
  rejectionCount: number;
  items: OrderItem[];
  events: OrderEvent[];
};

export type AppStore = {
  users: UserRecord[];
  recipes: RecipeRecord[];
  orders: OrderRecord[];
  nextOrderNumber: number;
};

export const orderCreateSchema = z.object({
  recipeId: z.string().min(1, "Select a recipe."),
  targetQty: z.number().int().positive().max(100000),
  fabricRollId: z
    .string()
    .regex(/^[A-Z0-9-]{3,30}$/i, "Use a valid fabric roll code."),
  actualFabricYds: z
    .number()
    .positive()
    .max(999999)
    .refine(
      (value) => Number.isInteger(value * 100),
      "Use at most 2 decimal places.",
    ),
  status: z.string().optional(),
});

const recipeCatalog: RecipeRecord[] = [
  {
    id: "rec-bl01",
    recipeCode: "REC-BL01",
    name: "Casual Blouse",
    category: "Topwear",
    stdFabricYards: 1.8,
    wastageCap: 5,
    components: [
      {
        id: "cmp-bl01-front",
        recipeId: "rec-bl01",
        componentName: "Front Body",
        piecesPerGarment: 1,
      },
      {
        id: "cmp-bl01-back",
        recipeId: "rec-bl01",
        componentName: "Back Body",
        piecesPerGarment: 1,
      },
      {
        id: "cmp-bl01-sleeves",
        recipeId: "rec-bl01",
        componentName: "Sleeves",
        piecesPerGarment: 2,
      },
      {
        id: "cmp-bl01-collar",
        recipeId: "rec-bl01",
        componentName: "Collar & Stand",
        piecesPerGarment: 1,
      },
      {
        id: "cmp-bl01-cuffs",
        recipeId: "rec-bl01",
        componentName: "Cuffs",
        piecesPerGarment: 2,
      },
    ],
  },
  {
    id: "rec-ct02",
    recipeCode: "REC-CT02",
    name: "Crop Top",
    category: "Topwear",
    stdFabricYards: 1.1,
    wastageCap: 8,
    components: [
      {
        id: "cmp-ct02-front",
        recipeId: "rec-ct02",
        componentName: "Front Chest",
        piecesPerGarment: 1,
      },
      {
        id: "cmp-ct02-back",
        recipeId: "rec-ct02",
        componentName: "Back Support",
        piecesPerGarment: 1,
      },
      {
        id: "cmp-ct02-neck",
        recipeId: "rec-ct02",
        componentName: "Neck Binding",
        piecesPerGarment: 1,
      },
      {
        id: "cmp-ct02-hem",
        recipeId: "rec-ct02",
        componentName: "Hem Elastic Casing",
        piecesPerGarment: 1,
      },
      {
        id: "cmp-ct02-side",
        recipeId: "rec-ct02",
        componentName: "Side Strap Accents",
        piecesPerGarment: 2,
      },
    ],
  },
];

export const defaultUsers: UserRecord[] = [
  {
    id: "u-cutting-supervisor",
    email: "supervisor@apparelflow.demo",
    name: "Ava Chen",
    role: "cutting_supervisor",
    password: "Supervisor#2026",
  },
  {
    id: "u-cutting-verifier",
    email: "verifier@apparelflow.demo",
    name: "Milo Ortiz",
    role: "cutting_verifier",
    password: "Verifier#2026",
  },
  {
    id: "u-sewing-supervisor",
    email: "sewing@apparelflow.demo",
    name: "Nia Patel",
    role: "sewing_supervisor",
    password: "Sewing#2026",
  },
];

export function createDemoStore(): AppStore {
  return {
    users: [...defaultUsers],
    recipes: [...recipeCatalog],
    orders: [],
    nextOrderNumber: 1,
  };
}

export function getAppStore() {
  const globalStore = globalThis as typeof globalThis & {
    __appStore?: AppStore;
  };

  if (!globalStore.__appStore) {
    globalStore.__appStore = createDemoStore();
  }

  return globalStore.__appStore;
}

export function findRecipeById(store: AppStore, recipeId: string) {
  return store.recipes.find((recipe) => recipe.id === recipeId) ?? null;
}

export function getOrdersForRole(
  store: AppStore,
  userId: string,
  role: AppRole,
) {
  if (role === "cutting_supervisor") {
    return store.orders.filter((order) => order.createdById === userId);
  }

  if (role === "cutting_verifier") {
    return store.orders.filter((order) =>
      [
        "PENDING_VERIFICATION",
        "VERIFIED",
        "REJECTED",
        "SEWING_IN_PROGRESS",
      ].includes(order.status),
    );
  }

  if (role === "sewing_supervisor") {
    return store.orders.filter((order) =>
      ["VERIFIED", "SEWING_IN_PROGRESS"].includes(order.status),
    );
  }

  return [];
}

export function getOrderMetricsForRole(
  store: AppStore,
  userId: string,
  role: AppRole,
) {
  const orders = getOrdersForRole(store, userId, role);
  return {
    ordersInCutting: orders.filter(
      (order) => order.status === "CUTTING_IN_PROGRESS",
    ).length,
    awaitingQc: orders.filter(
      (order) => order.status === "PENDING_VERIFICATION",
    ).length,
    rejected: orders.filter((order) => order.status === "REJECTED").length,
    verifiedToday: orders.filter(
      (order) =>
        order.status === "VERIFIED" || order.status === "SEWING_IN_PROGRESS",
    ).length,
  };
}

export function getOrderById(store: AppStore, orderId: string) {
  return store.orders.find((order) => order.id === orderId) ?? null;
}

export function createNarrativeEvent(
  fromStatus: OrderStatus | null,
  toStatus: OrderStatus,
  actorId: string,
): OrderEvent {
  return {
    id: `evt-${Math.random().toString(36).slice(2, 10)}`,
    fromStatus,
    toStatus,
    actorId,
  };
}

export const orderFactory = {
  create({
    store,
    actorId,
    recipeId,
    targetQty,
    fabricRollId,
    actualFabricYds,
  }: {
    store: AppStore;
    actorId: string;
    recipeId: string;
    targetQty: number;
    fabricRollId: string;
    actualFabricYds: number;
  }) {
    const recipe = findRecipeById(store, recipeId);
    if (!recipe) {
      throw new Error("Recipe not found.");
    }

    const items: OrderItem[] = recipe.components.map((component) => ({
      id: `item-${Math.random().toString(36).slice(2, 10)}`,
      componentId: component.id,
      componentName: component.componentName,
      expectedQty: computeExpected(targetQty, component.piecesPerGarment),
      actualQty: null,
      status: null,
    }));

    const orderNo = `CUT-${new Date().getFullYear()}-${String(store.nextOrderNumber).padStart(4, "0")}`;
    store.nextOrderNumber += 1;

    const order: OrderRecord = {
      id: `ord-${Math.random().toString(36).slice(2, 10)}`,
      orderNo,
      recipeId,
      recipeCode: recipe.recipeCode,
      createdById: actorId,
      targetQty,
      fabricRollId,
      actualFabricYds,
      status: "CUTTING_IN_PROGRESS",
      submittedAt: null,
      rejectionCount: 0,
      items,
      events: [createNarrativeEvent(null, "CUTTING_IN_PROGRESS", actorId)],
    };

    store.orders.push(order);
    return order;
  },
};

export function submitOrder(store: AppStore, orderId: string, actorId: string) {
  const order = getOrderById(store, orderId);
  if (!order) throw new Error("ORDER_NOT_FOUND");
  if (order.createdById !== actorId) throw new Error("FORBIDDEN");
  if (order.status !== "CUTTING_IN_PROGRESS")
    throw new Error("INVALID_TRANSITION");

  order.status = "PENDING_VERIFICATION";
  order.submittedAt = new Date().toISOString();
  order.events.push(
    createNarrativeEvent(
      "CUTTING_IN_PROGRESS",
      "PENDING_VERIFICATION",
      actorId,
    ),
  );
  return order;
}

export function recutOrder(store: AppStore, orderId: string, actorId: string) {
  const order = getOrderById(store, orderId);
  if (!order) throw new Error("ORDER_NOT_FOUND");
  if (order.createdById !== actorId) throw new Error("FORBIDDEN");
  if (order.status !== "REJECTED") throw new Error("INVALID_TRANSITION");

  order.status = "CUTTING_IN_PROGRESS";
  order.items = order.items.map((item) => ({
    ...item,
    actualQty: null,
    status: null,
  }));
  order.events.push(
    createNarrativeEvent("REJECTED", "CUTTING_IN_PROGRESS", actorId),
  );
  return order;
}
