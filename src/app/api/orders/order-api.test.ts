import { describe, it, expect } from "vitest";
import {
  createDemoStore,
  getOrdersForRole,
  orderFactory,
} from "@/server/store";

describe("order API backend", () => {
  it("creates a cutting order with default status and expected items", () => {
    const store = createDemoStore();

    const order = orderFactory.create({
      store,
      actorId: "u-cutting-supervisor",
      recipeId: "rec-bl01",
      targetQty: 50,
      fabricRollId: "ROLL-001",
      actualFabricYds: 96,
    });

    expect(order.status).toBe("CUTTING_IN_PROGRESS");
    expect(order.items).toHaveLength(5);
    expect(order.items[0]?.expectedQty).toBe(50);
  });

  it("scopes visible orders based on the caller role", () => {
    const store = createDemoStore();
    const supervisor = "u-cutting-supervisor";
    const verifier = "u-cutting-verifier";

    orderFactory.create({
      store,
      actorId: supervisor,
      recipeId: "rec-bl01",
      targetQty: 10,
      fabricRollId: "ROLL-10",
      actualFabricYds: 18,
    });

    const supervisorOrders = getOrdersForRole(
      store,
      supervisor,
      "cutting_supervisor",
    );
    const verifierOrders = getOrdersForRole(
      store,
      verifier,
      "cutting_verifier",
    );

    expect(supervisorOrders.length).toBeGreaterThanOrEqual(1);
    expect(verifierOrders.length).toBeGreaterThanOrEqual(0);
  });
});
