# Dependency Security Status

## Current practice

The repository runs `npm audit --omit=dev` during launch-readiness review and uses the GitHub quality workflow for repeatable lint, test, build, admin-authorization, and secret-exposure checks.

The direct React Server Components advisory was addressed by updating the React runtime and `react-server-dom-webpack` packages to the patched `19.2.8` release line. The application was then verified with lint, unit tests, and a production build.

## Remaining audit findings

The current audit still reports vulnerabilities in indirect or development/toolchain dependencies, including packages pulled through the Next/Vite/Vinext and image-processing stacks. These findings should be reviewed again before a real production launch and after any supported framework upgrade.

Do not run `npm audit fix --force` automatically. A forced repair may replace the framework or build tooling with a breaking major version. Each remaining finding needs a package-owner review, a compatible upgrade, or a documented risk decision.

This document does not treat a clean local audit as proof of production security. Provider configuration, deployment permissions, database policies, webhook secrets, and operational access still require a client-owned deployment review.
