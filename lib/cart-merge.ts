export function mergedCartQuantity(
  existingQuantity: number,
  incomingQuantity: number,
  availableStock: number,
) {
  return Math.min(
    20,
    Math.max(0, availableStock),
    Math.max(0, existingQuantity) + Math.max(0, incomingQuantity),
  );
}
