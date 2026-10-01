import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = join(process.cwd(), 'app', 'api', 'admin');
const routeFiles: string[] = [];

function collect(directory: string) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) collect(path);
    else if (entry.name === 'route.ts') routeFiles.push(path);
  }
}

collect(root);
const failures: string[] = [];
let handlerCount = 0;

for (const file of routeFiles) {
  const source = readFileSync(file, 'utf8');
  const handlers = source.split(
    /(?=export\s+async\s+function\s+(?:GET|POST|PUT|PATCH|DELETE)\b)/,
  );
  for (const handler of handlers.slice(1)) {
    const match = handler.match(
      /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\b/,
    );
    if (!match) continue;
    handlerCount += 1;
    const hasLocalAdminGuard = handler.includes('requireAdmin(');
    const hasDirectAdminGuard =
      handler.includes('getAuthenticatedIdentity(') &&
      handler.includes('isAdministrator(');
    if (!hasLocalAdminGuard && !hasDirectAdminGuard)
      failures.push(`${relative(process.cwd(), file)} ${match[1]}`);
  }
}

if (failures.length) {
  console.error('Admin authorization audit failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Admin authorization audit passed (${handlerCount} handlers across ${routeFiles.length} route files).`,
);
