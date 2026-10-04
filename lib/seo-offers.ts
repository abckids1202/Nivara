import { isSellable } from '@/lib/inventory';

export type SeoOfferVariant = {
  pricePaise: number;
  stockOnHand: number;
  stockReserved: number;
};

export function summarizeSeoOffers(variants: SeoOfferVariant[]) {
  const sellable = variants.filter((variant) =>
    isSellable(variant.stockOnHand, variant.stockReserved),
  );
  const offers = sellable.length ? sellable : variants;
  const prices = offers.map((variant) => variant.pricePaise);
  return {
    lowPrice: prices.length ? Math.min(...prices) / 100 : undefined,
    highPrice: prices.length ? Math.max(...prices) / 100 : undefined,
    offerCount: offers.length,
    availability: sellable.length
      ? 'https://schema.org/InStock'
      : 'https://schema.org/OutOfStock',
  } as const;
}
