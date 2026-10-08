export type ItemStatus = "GREEN" | "YELLOW" | "RED";

export function computeExpected(targetQty: number, piecesPerGarment: number) {
  return targetQty * piecesPerGarment;
}

export function classifyItem(expected: number, actual: number): ItemStatus {
  if (actual === expected) return "GREEN";
  if (actual > expected) return "YELLOW";
  return "RED";
}

export function computeWastage(
  actualYds: number,
  targetQty: number,
  stdYds: number,
) {
  const expected = targetQty * stdYds;

  if (expected === 0) return 0;

  return ((actualYds - expected) / expected) * 100;
}

export function canApprove(
  items: Array<{
    componentName?: string;
    expected: number;
    actual: number | null;
  }>,
) {
  const blockers: string[] = [];

  for (const item of items) {
    if (item.actual === null) {
      blockers.push(`${item.componentName ?? "Component"} is uncounted.`);
      continue;
    }

    if (item.actual < 0) {
      blockers.push(
        `${item.componentName ?? "Component"} has a negative count.`,
      );
    }

    if (item.actual < item.expected) {
      blockers.push(
        `${item.componentName ?? "Component"} is short by ${item.expected - item.actual}.`,
      );
    }
  }

  return {
    ok: blockers.length === 0,
    blockers,
  };
}
