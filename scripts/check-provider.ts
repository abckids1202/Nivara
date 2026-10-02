import {
  healthChecks,
  healthUrlFromBase,
  isReadyHealthPayload,
  type ProviderHealthPayload,
} from '../lib/provider-health.ts';

const urlArgumentIndex = process.argv.findIndex((value) => value === '--url');
const input =
  urlArgumentIndex >= 0
    ? process.argv[urlArgumentIndex + 1]
    : process.env.NIVARA_HEALTH_URL;

if (!input) {
  console.error(
    'Usage: npm run check:provider -- --url https://your-deployment.example',
  );
  console.error('Or set NIVARA_HEALTH_URL to the deployed site URL.');
  process.exit(2);
}

let healthUrl: string;
try {
  healthUrl = healthUrlFromBase(input);
} catch (error) {
  console.error(
    `Provider readiness check failed: ${error instanceof Error ? error.message : 'invalid URL'}`,
  );
  process.exit(2);
}

try {
  const response = await fetch(healthUrl, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  });
  const payload = (await response.json().catch(() => null)) as
    | ProviderHealthPayload
    | null;

  console.log(`Health endpoint: ${healthUrl}`);
  console.log(`HTTP status: ${response.status}`);
  for (const [name, value] of healthChecks(payload ?? {})) {
    console.log(`${name}: ${value === true || value === 'connected' ? 'ready' : 'not ready'}`);
  }

  if (!response.ok || !isReadyHealthPayload(payload)) {
    console.error(
      'Provider readiness check failed. Review the deployment environment and operations runbook.',
    );
    process.exit(1);
  }

  console.log('Provider readiness check passed.');
} catch (error) {
  console.error(
    `Provider readiness check failed: ${error instanceof Error ? error.message : 'request error'}`,
  );
  process.exit(1);
}
