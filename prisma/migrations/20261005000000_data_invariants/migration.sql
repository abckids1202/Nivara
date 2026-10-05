ALTER TABLE "ProductVariant"
ADD CONSTRAINT "ProductVariant_money_invariant"
CHECK (
  "pricePaise" >= 0
  AND ("compareAtPaise" IS NULL OR "compareAtPaise" >= 0)
);

ALTER TABLE "CartItem"
ADD CONSTRAINT "CartItem_quantity_invariant"
CHECK ("quantity" BETWEEN 1 AND 20);

ALTER TABLE "Order"
ADD CONSTRAINT "Order_money_invariant"
CHECK (
  "subtotalPaise" >= 0
  AND "deliveryFeePaise" >= 0
  AND "totalPaise" >= 0
);

ALTER TABLE "OrderItem"
ADD CONSTRAINT "OrderItem_money_quantity_invariant"
CHECK ("unitPricePaise" >= 0 AND "quantity" > 0);

ALTER TABLE "InventoryReservation"
ADD CONSTRAINT "InventoryReservation_quantity_invariant"
CHECK ("quantity" > 0);

ALTER TABLE "Review"
ADD CONSTRAINT "Review_rating_invariant"
CHECK ("rating" BETWEEN 1 AND 5);
