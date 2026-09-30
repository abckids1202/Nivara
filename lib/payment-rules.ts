export function canConvertReservation({
  status,
  stockOnHand,
  quantity,
}: {
  status: 'ACTIVE' | 'CONVERTED' | 'RELEASED' | 'EXPIRED';
  stockOnHand: number;
  quantity: number;
}) {
  return status === 'ACTIVE' && quantity > 0 && stockOnHand >= quantity;
}
