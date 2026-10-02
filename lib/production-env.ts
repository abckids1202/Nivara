const required = [
  'DATABASE_URL',
  'DIRECT_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_STORAGE_BUCKET',
  'RESEND_API_KEY',
  'RESEND_FROM_EMAIL',
  'SUPPORT_EMAIL',
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET',
  'RAZORPAY_WEBHOOK_SECRET',
  'CRON_SECRET',
  'NEXT_PUBLIC_SITE_URL',
] as const;

const placeholderMarkers = ['replace-me', 'your-project', 'example.com', 'localhost'];

export function validateProductionEnvironment(environment: NodeJS.ProcessEnv) {
  const failures: string[] = [];

  for (const name of required) {
    const value = environment[name]?.trim();
    if (!value) {
      failures.push(`${name} is missing`);
      continue;
    }
    if (placeholderMarkers.some((marker) => value.toLowerCase().includes(marker)))
      failures.push(`${name} still contains a development placeholder`);
  }

  for (const name of ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SITE_URL']) {
    const value = environment[name];
    if (!value) continue;
    try {
      const url = new URL(value);
      if (name === 'NEXT_PUBLIC_SUPABASE_URL' && url.protocol !== 'https:')
        failures.push(`${name} must use HTTPS`);
      if (
        name === 'NEXT_PUBLIC_SITE_URL' &&
        url.protocol !== 'https:'
      )
        failures.push(`${name} must use HTTPS`);
    } catch {
      failures.push(`${name} is not a valid URL`);
    }
  }

  for (const name of ['DATABASE_URL', 'DIRECT_URL']) {
    const value = environment[name];
    if (!value) continue;
    try {
      const url = new URL(value);
      if (!['postgres:', 'postgresql:'].includes(url.protocol))
        failures.push(`${name} must use a PostgreSQL URL`);
    } catch {
      failures.push(`${name} is not a valid PostgreSQL URL`);
    }
  }

  return failures;
}

export const productionEnvironmentVariableCount = required.length;
