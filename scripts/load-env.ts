import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';

/** Load local files for standalone maintenance scripts without overriding CI/Vercel env. */
export function loadLocalEnvironment() {
  for (const file of ['.env.local', '.env']) {
    if (existsSync(file)) loadEnvFile(file);
  }
}
