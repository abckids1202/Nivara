export const FREE_SHIPPING_THRESHOLD_PAISE = 99_900;
export const STANDARD_DELIVERY_FEE_PAISE = 7_900;

export function calculateDeliveryFee(subtotalPaise: number) {
  if (!Number.isInteger(subtotalPaise) || subtotalPaise < 0) {
    throw new Error("Subtotal must be a non-negative integer number of paise");
  }

  return subtotalPaise >= FREE_SHIPPING_THRESHOLD_PAISE
    ? 0
    : STANDARD_DELIVERY_FEE_PAISE;
}

export function calculateOrderTotal(subtotalPaise: number) {
  return subtotalPaise + calculateDeliveryFee(subtotalPaise);
}

export function formatInrFromPaise(amountPaise: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amountPaise / 100);
}
