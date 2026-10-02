type RazorpayOrderResponse = {
  id?: unknown;
  amount?: unknown;
  currency?: unknown;
};

export function readRazorpayOrderId(
  payload: RazorpayOrderResponse,
  expectedAmountPaise: number,
) {
  if (
    typeof payload.id !== 'string' ||
    !payload.id.trim() ||
    payload.amount !== expectedAmountPaise ||
    payload.currency !== 'INR'
  )
    return null;
  return payload.id;
}
