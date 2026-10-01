export function sellableStock(stockOnHand: number, stockReserved: number) {
  return Math.max(0, stockOnHand - stockReserved);
}

export function isSellable(stockOnHand: number, stockReserved: number) {
  return sellableStock(stockOnHand, stockReserved) > 0;
}
