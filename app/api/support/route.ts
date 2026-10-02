import { consumeRateLimit } from '@/lib/access-rate';
import { badRequest, noStore, unavailable } from '@/lib/http';
import { providerFetch } from '@/lib/provider-fetch';
import { supportRequestSchema } from '@/lib/schemas';
import { hasConfiguredValue } from '@/lib/configuration';
import { logServerError } from '@/lib/safe-logging';

export async function POST(request: Request): Promise<Response> {
  const apiKey = process.env.RESEND_API_KEY;
  const sender = process.env.RESEND_FROM_EMAIL;
  const recipient = process.env.SUPPORT_EMAIL;
  if (
    !hasConfiguredValue(apiKey) ||
    !hasConfiguredValue(sender, ['example.com']) ||
    !hasConfiguredValue(recipient, ['example.com'])
  )
    return unavailable('Support messaging is not configured');

  try {
    if (
      !(await consumeRateLimit({
        request,
        endpoint: 'support-message',
        maxAttempts: 3,
        windowMs: 15 * 60 * 1000,
      }))
    )
      return noStore(
        { error: 'Too many messages. Please try again later.' },
        429,
      );
  } catch (error) {
    logServerError('support_rate_limit_failed', error);
    return unavailable('Support messaging is temporarily unavailable');
  }

  const parsed = supportRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return badRequest(
      'Support message details are invalid',
      parsed.error.flatten(),
    );

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
  } catch (error) {
    logServerError('support_message_delivery_failed', error);
    return unavailable('Support message could not be delivered');
  }

  return noStore({ sent: true });
}
