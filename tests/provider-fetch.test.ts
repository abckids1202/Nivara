import { afterEach, describe, expect, it, vi } from 'vitest';
import { providerFetch } from '@/lib/provider-fetch';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('providerFetch', () => {
  it('combines a caller abort signal with the timeout signal', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}'));
    const caller = new AbortController();

    await providerFetch('https://provider.example.test', {
      signal: caller.signal,
    });

    const requestInit = fetchMock.mock.calls[0]?.[1];
    expect(requestInit?.signal).toBeDefined();
    expect(requestInit?.signal).not.toBe(caller.signal);
    expect(requestInit?.signal?.aborted).toBe(false);

    caller.abort();
    expect(requestInit?.signal?.aborted).toBe(true);
  });
});
