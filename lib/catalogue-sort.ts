export type SortableCatalogueProduct = {
  id: string;
  createdAt: Date;
  variants: Array<{ pricePaise: number }>;
  reviews: Array<{ rating: number }>;
  averageRating?: number;
  reviewCount?: number;
  paidQuantity: number;
};

function averageRating(product: SortableCatalogueProduct) {
  if (product.averageRating !== undefined) return product.averageRating;
  if (!product.reviews.length) return 0;
  return product.reviews.reduce((sum, review) => sum + review.rating, 0) /
    product.reviews.length;
}

function reviewCount(product: SortableCatalogueProduct) {
  return product.reviewCount ?? product.reviews.length;
}

function minPrice(product: SortableCatalogueProduct) {
  return product.variants.length
    ? Math.min(...product.variants.map((variant) => variant.pricePaise))
    : Number.POSITIVE_INFINITY;
}

export function sortCatalogueProducts(
  products: SortableCatalogueProduct[],
  sort: string,
) {
  return [...products].sort((left, right) => {
    if (sort === 'best') {
      const salesDifference = right.paidQuantity - left.paidQuantity;
      if (salesDifference !== 0) return salesDifference;
      const ratingDifference = averageRating(right) - averageRating(left);
      if (ratingDifference !== 0) return ratingDifference;
      const reviewDifference = reviewCount(right) - reviewCount(left);
      if (reviewDifference !== 0) return reviewDifference;
    }
    if (sort === 'price-low' || sort === 'price-high') {
      const priceDifference = minPrice(left) - minPrice(right);
      if (priceDifference !== 0)
        return sort === 'price-low' ? priceDifference : -priceDifference;
    }
    return right.createdAt.getTime() - left.createdAt.getTime();
  });
}
