export function isValidComparisonPrice(
  pricePaise: number,
  compareAtPaise: number | null,
) {
  return compareAtPaise === null || compareAtPaise >= pricePaise;
}
