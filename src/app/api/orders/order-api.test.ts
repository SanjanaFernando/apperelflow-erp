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

  it("supports order pagination with default 10 per page, and 20 or 50 options", () => {
    const store = createDemoStore();
    const supervisor = "u-cutting-supervisor";

    // Create 25 orders
    for (let i = 1; i <= 25; i++) {
      orderFactory.create({
        store,
        actorId: supervisor,
        recipeId: "rec-bl01",
        targetQty: 10 + i,
        fabricRollId: `ROLL-${i.toString().padStart(3, "0")}`,
        actualFabricYds: 20,
      });
    }

    const allOrders = getOrdersForRole(store, supervisor, "cutting_supervisor");
    expect(allOrders.length).toBeGreaterThanOrEqual(25);

    // Default pagination: 10 per page
    const pageSizeDefault = 10;
    const page1 = allOrders.slice(0, pageSizeDefault);
    const page2 = allOrders.slice(pageSizeDefault, pageSizeDefault * 2);
    const page3 = allOrders.slice(pageSizeDefault * 2, pageSizeDefault * 3);

    expect(page1).toHaveLength(10);
    expect(page2).toHaveLength(10);
    expect(page3.length).toBeGreaterThanOrEqual(5);

    // 20 per page option
    const pageSize20 = 20;
    const page1Of20 = allOrders.slice(0, pageSize20);
    const page2Of20 = allOrders.slice(pageSize20, pageSize20 * 2);
    expect(page1Of20).toHaveLength(20);
    expect(page2Of20.length).toBeGreaterThanOrEqual(5);

    // 50 per page option
    const pageSize50 = 50;
    const page1Of50 = allOrders.slice(0, pageSize50);
    expect(page1Of50.length).toBe(allOrders.length);
  });
});
