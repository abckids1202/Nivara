export type AnalyticsProps = Record<string, string | number | boolean>;

type Plausible = ((
  event: string,
  options?: { props?: AnalyticsProps },
) => void) & { q?: unknown[] };

declare global {
  interface Window {
    plausible?: Plausible;
  }
}

export function trackEvent(event: string, props?: AnalyticsProps) {
  if (typeof window === 'undefined') return;
  window.plausible?.(event, props ? { props } : undefined);
}
