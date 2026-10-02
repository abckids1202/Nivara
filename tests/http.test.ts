import { describe, expect, it } from 'vitest';
import {
  badRequest,
  conflict,
  forbidden,
  notFound,
  unavailable,
  unauthorized,
} from '@/lib/http';

describe('HTTP error responses', () => {
  it.each([
    ['bad request', badRequest('invalid'), 400],
    ['unauthorized', unauthorized(), 401],
    ['forbidden', forbidden(), 403],
    ['not found', notFound(), 404],
    ['conflict', conflict(), 409],
    ['unavailable', unavailable(), 503],
  ])('does not cache a %s response', (_label, response, status) => {
    expect(response.status).toBe(status);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
});
