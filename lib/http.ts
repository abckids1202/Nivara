export function json<T>(payload: T, status = 200) {
  return Response.json(payload, { status });
}

export function noStore<T>(payload: T, status = 200) {
  const response = json(payload, status);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export function badRequest(message: string, details?: unknown) {
  return noStore({ error: message, details }, 400);
}

export function unauthorized(message = 'Authentication is required') {
  return noStore({ error: message }, 401);
}

export function forbidden(message = 'Administrator access is required') {
  return noStore({ error: message }, 403);
}

export function notFound(message = 'Resource not found') {
  return noStore({ error: message }, 404);
}

export function conflict(message = 'The request conflicts with the current resource state') {
  return noStore({ error: message }, 409);
}

export function unavailable(message = 'This service is not configured yet') {
  return noStore({ error: message }, 503);
}
