import { describe, expect, it } from 'vitest';
import {
  healthChecks,
  healthUrlFromBase,
  isReadyHealthPayload,
} from '../lib/provider-health';

describe('provider readiness helpers', () => {
  it('normalizes a deployment URL to the no-store health endpoint', () => {
    expect(healthUrlFromBase('https://store.nivara.in/shop?preview=1')).toBe(
      'https://store.nivara.in/api/health',
    );
    expect(healthUrlFromBase('https://store.nivara.in/api/health')).toBe(
      'https://store.nivara.in/api/health',
    );
  });

  it('rejects non-http deployment URLs', () => {
    expect(() => healthUrlFromBase('ftp://store.nivara.in')).toThrow(
      'Health URL must use HTTP or HTTPS',
    );
  });

  it('requires an explicit healthy response from every provider check', () => {
    const ready = {
      status: 'ok',
      ready: true,
      database: 'connected',
      schemaConfigured: true,
      inventoryConstraintConfigured: true,
      dataInvariantsConfigured: true,
      catalogueQueryIndexConfigured: true,
      emailProcessingStateConfigured: true,
      paymentsConfigured: true,
      authConfigured: true,
      storageConfigured: true,
      emailConfigured: true,
      supportConfigured: true,
      cronConfigured: true,
    };
    expect(isReadyHealthPayload(ready)).toBe(true);
    expect(isReadyHealthPayload({ ...ready, ready: false })).toBe(false);
    expect(healthChecks(ready)).toHaveLength(13);
  });
});
