import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const trackedFiles = execFileSync(
  'git',
  ['-c', 'safe.directory=*', 'ls-files'],
  { encoding: 'utf8' },
)
  .split(/\r?\n/)
  .filter(Boolean);
const codeFiles = trackedFiles.filter((file) => /\.(?:[cm]?[jt]sx?)$/.test(file));
const failures: string[] = [];
const serverOnlyNames = [
  'DATABASE_URL',
  'DIRECT_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'RESEND_API_KEY',
  'RAZORPAY_KEY_SECRET',
  'RAZORPAY_WEBHOOK_SECRET',
  'CRON_SECRET',
];
const privateKeyPattern = /-----BEGIN (?:RSA|EC|OPENSSH|PRIVATE) KEY-----/;
const providerKeyPattern = /\b(?:sk|rzp)_(?:live|test)_[A-Za-z0-9]+\b/;

for (const file of codeFiles) {
  const source = readFileSync(file, 'utf8');
  const isClientModule =
    file.startsWith('components/') ||
    (file.startsWith('app/') && /^['"]use client['"]/.test(source.trim()));
  if (isClientModule) {
    for (const name of serverOnlyNames) {
      if (source.includes(name))
        failures.push(`${file} references server-only environment variable ${name}`);
    }
  }
  if (privateKeyPattern.test(source) || providerKeyPattern.test(source))
    failures.push(`${file} contains a private or provider key literal`);
}

if (failures.length) {
  console.error('Secret-safety preflight failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Secret-safety preflight passed (${codeFiles.length} code files checked).`);
