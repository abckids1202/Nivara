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

export type PaymentState =
  | 'CREATED'
  | 'PENDING'
  | 'PAID'
  | 'FAILED'
  | 'CANCELLED'
  | 'PAYMENT_REVIEW'
  | 'PAID_REVIEW';

const terminalPaymentStates = new Set<PaymentState>([
  'PAID',
  'FAILED',
  'CANCELLED',
  'PAID_REVIEW',
]);

export function canMarkPaymentReview({
  paymentStatus,
  orderStatus,
}: {
  paymentStatus: PaymentState;
  orderStatus: PaymentState;
}) {
  return (
    !terminalPaymentStates.has(paymentStatus) &&
    !terminalPaymentStates.has(orderStatus)
  );
}

export function decidePaymentCapture({
  paymentStatus,
  orderStatus,
}: {
  paymentStatus: PaymentState;
  orderStatus: PaymentState;
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
