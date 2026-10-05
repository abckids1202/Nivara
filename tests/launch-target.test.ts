import { describe, expect, it } from 'vitest';
import { validateLaunchTarget } from '@/lib/launch-target';

describe('validateLaunchTarget', () => {
  it('accepts an HTTPS deployment without a configured canonical URL', () => {
    expect(validateLaunchTarget('https://store.example')).toBeNull();
  });

  it('rejects malformed deployment URLs', () => {
    expect(validateLaunchTarget('not-a-url')).toContain('valid HTTP(S)');
  });

  it('rejects non-HTTPS deployment URLs', () => {
    expect(validateLaunchTarget('http://store.example')).toContain('HTTPS');
  });

  it('requires the deployment and canonical URL origins to match', () => {
    expect(
      validateLaunchTarget('https://preview.example', 'https://store.example'),
    ).toContain('origin must match');
  });

  it('accepts matching canonical origins even when paths differ', () => {
    expect(
      validateLaunchTarget(
        'https://store.example/preview',
        'https://store.example',
      ),
    ).toBeNull();
  });
});
