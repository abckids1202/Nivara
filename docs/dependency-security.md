# Dependency Security Status

## Current practice

The repository runs `npm audit --omit=dev` during launch-readiness review and uses the GitHub quality workflow for repeatable lint, test, build, admin-authorization, and secret-exposure checks.

The direct React Server Components advisory was addressed by updating the React runtime and `react-server-dom-webpack` packages to the patched `19.2.8` release line. The application was then verified with lint, unit tests, and a production build.

The lockfile is kept on the latest compatible Next 15.5 patch release, and
`sharp` is pinned to the patched `0.35.5` release for the production image
pipeline. These updates were applied without a forced framework migration.

## Remaining audit findings

The current `npm audit --omit=dev` report contains four findings: the
Next-bundled PostCSS version and indirect HTTP tooling. Sites/Cloudflare and
Vinext preview dependencies are now development-only and are not part of the
standard Vercel production dependency set. The remaining report should be
reviewed again before a real production launch and after any supported
framework upgrade.

Do not run `npm audit fix --force` automatically. A forced repair may replace the framework or build tooling with a breaking major version. Each remaining finding needs a package-owner review, a compatible upgrade, or a documented risk decision.

This document does not treat a clean local audit as proof of production security. Provider configuration, deployment permissions, database policies, webhook secrets, and operational access still require a client-owned deployment review.
