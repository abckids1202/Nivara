import { consumeRateLimit } from '@/lib/access-rate';
import { badRequest, json, unavailable } from '@/lib/http';
import { providerFetch } from '@/lib/provider-fetch';
import { supportRequestSchema } from '@/lib/schemas';

export async function POST(request: Request) {
  const apiKey = process.env.RESEND_API_KEY;
  const sender = process.env.RESEND_FROM_EMAIL;
  const recipient = process.env.SUPPORT_EMAIL;
  if (!apiKey || !sender || !recipient)
    return unavailable('Support messaging is not configured');

  if (
    !(await consumeRateLimit({
      request,
      endpoint: 'support-message',
      maxAttempts: 3,
      windowMs: 15 * 60 * 1000,
    }))
  )
    return json({ error: 'Too many messages. Please try again later.' }, 429);

  const parsed = supportRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return badRequest('Support message details are invalid', parsed.error.flatten());

  try {
    const response = await providerFetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: sender,
        to: [recipient],
        reply_to: parsed.data.email,
        subject: `Nivara support message from ${parsed.data.name}`,
        text: [
          `Name: ${parsed.data.name}`,
          `Email: ${parsed.data.email}`,
          '',
          parsed.data.message,
        ].join('\n'),
      }),
    });
    if (!response.ok)
      return unavailable('Support message could not be delivered');
  } catch {
    return unavailable('Support message could not be delivered');
  }

  return json({ sent: true });
}
