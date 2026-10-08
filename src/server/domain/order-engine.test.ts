import { describe, it, expect } from "vitest";
import {
  computeExpected,
  computeExpectedFabric,
  classifyItem,
  computeWastage,
} from "@/server/domain/order-engine";

describe("order engine", () => {
  it("computes expected component totals and fabric yards for a batch", () => {
    expect(computeExpected(50, 2)).toBe(100);
    expect(computeExpectedFabric(50, 1.8)).toBe(90);
  });

  it("classifies counts using the same rule as the brief", () => {
    expect(classifyItem(10, 10)).toBe("GREEN");
    expect(classifyItem(10, 11)).toBe("YELLOW");
    expect(classifyItem(10, 9)).toBe("RED");
  });

  it("computes wastage percentage accurately", () => {
    expect(computeWastage(90, 50, 1.8)).toBeCloseTo(0, 5);
    expect(computeWastage(100, 50, 1.8)).toBeCloseTo(11.111111, 5);
  });
});
