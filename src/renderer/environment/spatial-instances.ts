/** Stable XZ partition of placement indices. Negative coordinates use floor cells. */
export function partitionSpatialInstances<P extends { readonly 0: number; readonly 1: number }>(
  placements: readonly P[],
  cellSize: number,
): { xCell: number; zCell: number; indices: number[] }[] {
  if (!Number.isFinite(cellSize) || cellSize <= 0) throw new RangeError('Cell size must be positive and finite');
  const cells = new Map<string, { xCell: number; zCell: number; indices: number[] }>();
  placements.forEach((placement, index) => {
    const xCell = Math.floor(placement[0] / cellSize);
    const zCell = Math.floor(placement[1] / cellSize);
    const key = `${xCell},${zCell}`;
    let cell = cells.get(key);
    if (!cell) {
      cell = { xCell, zCell, indices: [] };
      cells.set(key, cell);
    }
    cell.indices.push(index);
  });
  return [...cells.values()];
}
