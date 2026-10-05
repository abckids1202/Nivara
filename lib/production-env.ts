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

const placeholderMarkers = [
  'replace-me',
  'your-project',
  'example.com',
  'localhost',
];
const emailPattern = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const razorpayKeyIdPattern = /^rzp_(?:test|live)_[A-Za-z0-9]+$/;
const storageBucketPattern = /^[a-z0-9](?:[a-z0-9._-]{1,61}[a-z0-9])?$/;

function hasValidEmail(value: string) {
  const address = value.match(/<([^<>]+)>/)?.[1] ?? value;
  return emailPattern.test(address);
}

export function validateProductionEnvironment(environment: NodeJS.ProcessEnv) {
  const failures: string[] = [];

  for (const name of required) {
    const value = environment[name]?.trim();
    if (!value) {
      failures.push(`${name} is missing`);
      continue;
    }
    if (
      placeholderMarkers.some((marker) => value.toLowerCase().includes(marker))
    )
      failures.push(`${name} still contains a development placeholder`);
  }

  for (const name of ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SITE_URL']) {
    const value = environment[name];
    if (!value) continue;
    try {
      const url = new URL(value);
      if (url.username || url.password)
        failures.push(`${name} must not contain embedded credentials`);
      if (name === 'NEXT_PUBLIC_SUPABASE_URL' && url.protocol !== 'https:')
        failures.push(`${name} must use HTTPS`);
      if (name === 'NEXT_PUBLIC_SITE_URL' && url.protocol !== 'https:')
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

  for (const name of ['RESEND_FROM_EMAIL', 'SUPPORT_EMAIL']) {
    const value = environment[name]?.trim();
    if (value && !hasValidEmail(value))
      failures.push(`${name} must contain a valid email address`);
  }

  const razorpayKeyId = environment.RAZORPAY_KEY_ID?.trim();
  if (razorpayKeyId && !razorpayKeyIdPattern.test(razorpayKeyId))
    failures.push(
      'RAZORPAY_KEY_ID must use a valid rzp_test_ or rzp_live_ key format',
    );

  const bucket = environment.SUPABASE_STORAGE_BUCKET?.trim();
  if (bucket && !storageBucketPattern.test(bucket))
    failures.push(
      'SUPABASE_STORAGE_BUCKET must contain only lowercase letters, numbers, dots, underscores, or hyphens',
    );

  return failures;
}

export const productionEnvironmentVariables = required;
export const productionEnvironmentVariableCount =
  productionEnvironmentVariables.length;
