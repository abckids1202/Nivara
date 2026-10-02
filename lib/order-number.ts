import { randomUUID } from 'node:crypto';

export function createOrderNumber(now = Date.now()) {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase();
  return `NV-${now}-${suffix}`;
}
