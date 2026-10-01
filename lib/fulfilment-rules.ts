export type FulfilmentStatus = 'PROCESSING' | 'SHIPPED' | 'DELIVERED';

const fulfilmentRank: Record<FulfilmentStatus, number> = {
  PROCESSING: 0,
  SHIPPED: 1,
  DELIVERED: 2,
};

export type FulfilmentTransition =
  | { allowed: true; kind: 'updated' | 'correction' }
  | {
      allowed: false;
      kind: 'backward' | 'skipped';
    };

export function evaluateFulfilmentTransition(
  current: FulfilmentStatus,
  next: FulfilmentStatus,
): FulfilmentTransition {
  const currentRank = fulfilmentRank[current];
  const nextRank = fulfilmentRank[next];

  if (nextRank < currentRank) return { allowed: false, kind: 'backward' };
  if (nextRank > currentRank + 1)
    return { allowed: false, kind: 'skipped' };
  return {
    allowed: true,
    kind: nextRank === currentRank ? 'correction' : 'updated',
  };
}
