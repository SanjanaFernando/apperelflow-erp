import { describe, expect, it } from "vitest";
import {
  canApprove,
  classifyItem,
  computeWastage,
} from "@/server/domain/verification";

describe("verification gate", () => {
  it("allows counted GREEN and YELLOW items", () => {
    expect(
      canApprove([
        { componentName: "Front", expected: 10, actual: 10 },
        { componentName: "Cuffs", expected: 10, actual: 11 },
      ]),
    ).toEqual({ ok: true, blockers: [] });
  });

  it("blocks shortages and uncounted components", () => {
    const result = canApprove([
      { componentName: "Sleeves", expected: 20, actual: 19 },
      { componentName: "Collar", expected: 10, actual: null },
    ]);
    expect(result.ok).toBe(false);
    expect(result.blockers).toEqual([
      "Sleeves is short by 1.",
      "Collar is uncounted.",
    ]);
  });

  it("keeps traffic-light and wastage formulas deterministic", () => {
    expect(classifyItem(10, 10)).toBe("GREEN");
    expect(classifyItem(10, 11)).toBe("YELLOW");
    expect(classifyItem(10, 9)).toBe("RED");
    expect(computeWastage(90, 45, 1.8)).toBeCloseTo(11.11, 2);
  });
});
