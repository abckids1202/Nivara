ALTER TABLE "ProductVariant"
ADD CONSTRAINT "ProductVariant_stock_invariants"
CHECK (
    "stockOnHand" >= 0
    AND "stockReserved" >= 0
    AND "stockReserved" <= "stockOnHand"
);
