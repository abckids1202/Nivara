import { spawnSync } from "node:child_process";

const steps = [
  ["Secret scan", "check:secrets"],
  ["Admin authorization audit", "check:admin-auth"],
  ["Production dependency audit", "audit:production"],
  ["Prisma schema validation", "db:validate"],
  ["Prisma client generation", "db:generate"],
  ["Lint", "lint"],
  ["Unit and integration tests", "test"],
  ["Production build", "build"],
  ["Browser acceptance tests", "test:e2e"],
] as const;

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

for (const [label, script] of steps) {
  console.log(`\n==> ${label} (npm run ${script})`);
  const environment = { ...process.env };
  if (script === "db:validate") {
    environment.DATABASE_URL ??= "postgresql://placeholder:placeholder@localhost:5432/nivara";
    environment.DIRECT_URL ??= "postgresql://placeholder:placeholder@localhost:5432/nivara";
  }

  const result = spawnSync(npmCommand, ["run", script], {
    env: environment,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.error) {
    console.error(`\n${label} could not start: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`\nQuality gate stopped after: ${label}`);
    process.exit(result.status ?? 1);
  }
}

console.log("\nQuality gate passed: local release checks are green.");
