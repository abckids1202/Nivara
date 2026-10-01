export function safeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : 'unknown_error';

  return message
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/https?:\/\/\S+/gi, '[url]')
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[email]')
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, '[redacted]')
    .slice(0, 240);
}

export function logServerError(event: string, error: unknown) {
  console.error(event, safeErrorMessage(error));
}
