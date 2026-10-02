import {
  productionEnvironmentVariableCount,
  validateProductionEnvironment,
} from '../lib/production-env.ts';

if (!process.argv.includes('--production')) {
  console.error('Usage: npm run check:env -- --production');
  process.exit(2);
}

const failures = validateProductionEnvironment(process.env);
if (failures.length) {
  console.error('Production environment preflight failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Production environment preflight passed (${productionEnvironmentVariableCount} variables checked).`,
);
