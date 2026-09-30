export function json<T>(payload: T, status = 200) {
  return Response.json(payload, { status });
}

export function badRequest(message: string, details?: unknown) {
  return json({ error: message, details }, 400);
}

export function unauthorized(message = 'Authentication is required') {
  return json({ error: message }, 401);
}

export function forbidden(message = 'Administrator access is required') {
  return json({ error: message }, 403);
}

export function notFound(message = 'Resource not found') {
  return json({ error: message }, 404);
}

export function conflict(message = 'The request conflicts with the current resource state') {
  return json({ error: message }, 409);
}

export function unavailable(message = 'This service is not configured yet') {
  return json({ error: message }, 503);
}
