import { spawnSync } from 'node:child_process';
import { loadLocalEnvironment } from './load-env.ts';

loadLocalEnvironment();

const urlArgumentIndex = process.argv.findIndex((value) => value === '--url');
const deploymentUrl =
  urlArgumentIndex >= 0
    ? process.argv[urlArgumentIndex + 1]
    : process.env.NIVARA_HEALTH_URL;

if (!deploymentUrl) {
  console.error(
    'Usage: npm run check:launch -- --url https://your-deployment.example',
  );
  process.exit(2);
}

let deploymentTarget: URL;
try {
  deploymentTarget = new URL(deploymentUrl);
} catch {
  console.error('Launch preflight requires a valid HTTP(S) deployment URL.');
  process.exit(2);
}

if (deploymentTarget.protocol !== 'https:') {
  console.error('Launch preflight requires an HTTPS deployment URL.');
  process.exit(2);
}

const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
if (configuredSiteUrl) {
  let configuredTarget: URL;
  try {
    configuredTarget = new URL(configuredSiteUrl);
  } catch {
    console.error('NEXT_PUBLIC_SITE_URL must be a valid HTTP(S) URL.');
    process.exit(2);
  }

  if (configuredTarget.origin !== deploymentTarget.origin) {
    console.error(
      `Deployment URL origin must match NEXT_PUBLIC_SITE_URL (${configuredTarget.origin}).`,
    );
    process.exit(2);
  }
}

process.env.NIVARA_HEALTH_URL = deploymentUrl;

const checks = [
  ['production environment', 'scripts/check-env.ts', ['--production']],
  ['admin authorization', 'scripts/check-admin-auth.ts', []],
  ['secret safety', 'scripts/check-secrets.ts', []],
  ['provider readiness', 'scripts/check-provider.ts', []],
] as const;

let failed = false;
for (const [name, script, args] of checks) {
  console.log(`\n[launch preflight] ${name}`);
  const result = spawnSync(
    process.execPath,
    ['--experimental-strip-types', script, ...args],
    { env: process.env, stdio: 'inherit' },
  );
  if (result.error || result.status !== 0) failed = true;
}

if (failed) {
  console.error(
    '\nLaunch preflight failed. Resolve every reported check before production handover.',
  );
  process.exit(1);
}

console.log('\nLaunch preflight passed.');
