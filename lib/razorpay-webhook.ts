import { createHmac, timingSafeEqual } from 'node:crypto';

export function razorpaySignatureMatches(
  rawBody: string,
  signature: string,
  secret: string,
) {
  if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  const actualBuffer = Buffer.from(signature.toLowerCase(), 'utf8');
  return (
    expectedBuffer.length === actualBuffer.length &&
    timingSafeEqual(expectedBuffer, actualBuffer)
  );
}

export function readConsistentProviderOrderId(
  paymentOrderId?: string,
  orderEntityId?: string,
) {
  if (paymentOrderId && orderEntityId && paymentOrderId !== orderEntityId)
    return null;
  return paymentOrderId ?? orderEntityId ?? null;
}
