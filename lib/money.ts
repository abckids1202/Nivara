export const FREE_SHIPPING_THRESHOLD_PAISE = 99_900;
export const STANDARD_DELIVERY_FEE_PAISE = 7_900;

export function rupeesToPaise(amountRupees: number) {
  if (!Number.isFinite(amountRupees) || amountRupees < 0)
    throw new Error('Rupee amount must be a non-negative finite number');
  const amountPaise = Math.round(amountRupees * 100);
  if (!Number.isSafeInteger(amountPaise))
    throw new Error('Rupee amount is outside the safe money range');
  return amountPaise;
}

export function calculateDeliveryFee(subtotalPaise: number) {
  if (!Number.isInteger(subtotalPaise) || subtotalPaise < 0) {
    throw new Error('Subtotal must be a non-negative integer number of paise');
  }

  return subtotalPaise >= FREE_SHIPPING_THRESHOLD_PAISE
    ? 0
    : STANDARD_DELIVERY_FEE_PAISE;
}

export function calculateOrderTotal(subtotalPaise: number) {
  return subtotalPaise + calculateDeliveryFee(subtotalPaise);
}

export function formatInrFromPaise(amountPaise: number) {
  const formatted = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountPaise / 100);
  return formatted.replace(/\.00$/, '');
}
