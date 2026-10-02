export function canConvertReservation({
  status,
  stockOnHand,
  quantity,
}: {
  status: 'ACTIVE' | 'CONVERTED' | 'RELEASED' | 'EXPIRED';
  stockOnHand: number;
  quantity: number;
}) {
  return (
    (status === 'ACTIVE' || status === 'EXPIRED') &&
    quantity > 0 &&
    stockOnHand >= quantity
  );
}
