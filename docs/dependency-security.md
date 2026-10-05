# Dependency Security Status

## Current practice

The repository runs `npm audit --omit=dev` during launch-readiness review and
surfaces the same high-severity audit in the GitHub quality workflow. The audit
step is intentionally non-blocking while the documented transitive findings
remain under review; lint, tests, build, authorization, and secret checks stay
blocking.

The direct React Server Components advisory was addressed by updating the React runtime and `react-server-dom-webpack` packages to the patched `19.2.8` release line. The application was then verified with lint, unit tests, and a production build.

The lockfile is kept on the latest compatible Next 15.5 patch release, and
`sharp` is pinned to the patched `0.35.5` release for the production image
pipeline. These updates were applied without a forced framework migration.

## Remaining audit findings

The current `npm audit --omit=dev --audit-level=high` report contains two
vulnerable dependency paths and three advisories (including lower-severity
advisories in the same paths):

- `postcss@8.4.31`, bundled by the pinned Next 15.5.27 release, is reported for
  the PostCSS XSS/source-map advisories. npm recommends `next@16.3.8`, which is
  a breaking framework upgrade and is not applied automatically.
- `esbuild@0.27.3` is reached through Prisma/Vite tooling and is relevant to
  development-server behavior, not the standard Next runtime bundle.

The `shadcn` CLI is classified as a development dependency because its CSS is
consumed during the Next build and it is not imported by application routes at
runtime. This removes its `braces` and `undici` tooling paths from the
production dependency audit while preserving the Vercel build.

Sites/Cloudflare and Vinext preview dependencies are development-only and are
not part of the standard Vercel production dependency set. Run
`npm audit --omit=dev` again before a real production launch and after any
supported framework upgrade. Reassess the PostCSS finding when the project is
ready for a tested Next major-version migration.

Do not run `npm audit fix --force` automatically. A forced repair may replace the framework or build tooling with a breaking major version. Each remaining finding needs a package-owner review, a compatible upgrade, or a documented risk decision.

The preview-toolchain peer range is kept compatible with current Vinext
releases by pinning `@vitejs/plugin-rsc` to `0.5.35`. The committed lockfile
remains the reproducible source of the exact preview-toolchain versions;
`npm ci --dry-run` should be run after any lockfile refresh. The remaining
audit findings are transitive and are not fixed by this development-toolchain
compatibility setting.

Release gate for this finding:

1. Record the intended package versions and review the lockfile diff.
2. Confirm the production Vercel build does not include Sites/Cloudflare/Vinext
   code paths.
3. Run `npm audit --omit=dev`, `npm run check:quality`, and a deployed preview.
4. Keep the current lockfile if a future coordinated update introduces a build,
   preview, or test regression; reassess at the next supported Next release.

This document does not treat a clean local audit as proof of production security. Provider configuration, deployment permissions, database policies, webhook secrets, and operational access still require a client-owned deployment review.
