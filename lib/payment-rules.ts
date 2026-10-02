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

export function decidePaymentCapture({
  paymentStatus,
  orderStatus,
}: {
  paymentStatus:
    | 'CREATED'
    | 'PENDING'
    | 'PAID'
    | 'FAILED'
    | 'CANCELLED'
    | 'PAYMENT_REVIEW'
    | 'PAID_REVIEW';
  orderStatus:
    | 'CREATED'
    | 'PENDING'
    | 'PAID'
    | 'FAILED'
    | 'CANCELLED'
    | 'PAYMENT_REVIEW'
    | 'PAID_REVIEW';
}) {
  if (paymentStatus === 'PAID' && orderStatus === 'PAID')
    return 'already_paid' as const;

  // A provider success arriving after a failed/cancelled transition is a
  // late capture and must be reviewed, never used to resurrect the order.
  if (
    paymentStatus === 'FAILED' ||
    paymentStatus === 'CANCELLED' ||
    orderStatus === 'FAILED' ||
    orderStatus === 'CANCELLED'
  )
    return 'paid_review' as const;

  return 'capture' as const;
}
