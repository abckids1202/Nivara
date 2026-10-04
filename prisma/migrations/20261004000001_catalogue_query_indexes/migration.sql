CREATE INDEX "ProductVariant_productId_stockOnHand_stockReserved_pricePaise_idx"
ON "ProductVariant"("productId", "stockOnHand", "stockReserved", "pricePaise");
