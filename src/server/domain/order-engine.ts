export function computeExpected(targetQty: number, piecesPerGarment: number) {
  return targetQty * piecesPerGarment;
}

export function computeExpectedFabric(
  targetQty: number,
  stdFabricYards: number,
) {
  return targetQty * stdFabricYards;
}

export function classifyItem(expected: number, actual: number) {
  if (actual === expected) return "GREEN" as const;
  if (actual > expected) return "YELLOW" as const;
  return "RED" as const;
}

export function computeWastage(
  actualYds: number,
  targetQty: number,
  stdYds: number,
) {
  const expected = computeExpectedFabric(targetQty, stdYds);
  if (expected === 0) return 0;
  return ((actualYds - expected) / expected) * 100;
}

export function generateOrderNo() {
  const stamp = new Date();
  const year = stamp.getFullYear();
  const seq = String(Math.floor(Math.random() * 9000) + 1000);
  return `CUT-${year}-${seq}`;
}
