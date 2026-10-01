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

if (!process.argv.includes('--production')) {
  console.error('Usage: npm run check:env -- --production');
  process.exit(2);
}

const failures: string[] = [];
const placeholderMarkers = [
  'replace-me',
  'your-project',
  'example.com',
  'localhost',
];

for (const name of required) {
  const value = process.env[name]?.trim();
  if (!value) {
    failures.push(`${name} is missing`);
    continue;
  }
  if (placeholderMarkers.some((marker) => value.toLowerCase().includes(marker)))
    failures.push(`${name} still contains a development placeholder`);
}

for (const name of ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SITE_URL']) {
  const value = process.env[name];
  if (!value) continue;
  try {
    const url = new URL(value);
    if (name === 'NEXT_PUBLIC_SUPABASE_URL' && url.protocol !== 'https:')
      failures.push(`${name} must use HTTPS`);
    if (
      name === 'NEXT_PUBLIC_SITE_URL' &&
      !['https:', 'http:'].includes(url.protocol)
    )
      failures.push(`${name} must be an HTTP(S) URL`);
  } catch {
    failures.push(`${name} is not a valid URL`);
  }
}

if (failures.length) {
  console.error('Production environment preflight failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Production environment preflight passed (${required.length} variables checked).`);
