import { isSellable } from '@/lib/inventory';

export type DisplayVariant = {
  id: string;
  pricePaise: number;
  stockOnHand: number;
  stockReserved: number;
};

/**
 * Selects the variant used by catalogue-card quick actions and pricing.
 * Database row order is not a storefront rule, so ties are made stable by ID.
 */
export function selectDefaultVariant<T extends DisplayVariant>(
  variants: T[],
) {
  const ordered = [...variants].sort(
    (left, right) =>
      left.pricePaise - right.pricePaise || left.id.localeCompare(right.id),
  );
  return ordered.find((variant) =>
    isSellable(variant.stockOnHand, variant.stockReserved),
  ) ?? ordered[0];
}
