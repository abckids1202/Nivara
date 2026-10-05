# Dependency Security Status

## Current practice

The repository runs `npm audit --omit=dev` during launch-readiness review and
surfaces the result in the GitHub quality workflow. The production dependency
audit is now clean after the compatible overrides below; the full development
toolchain audit remains non-blocking because preview and build tools are not
part of the deployed application bundle. Lint, tests, build, authorization,
and secret checks stay blocking.

The direct React Server Components advisory was addressed by updating the React runtime and `react-server-dom-webpack` packages to the patched `19.2.8` release line. The application was then verified with lint, unit tests, and a production build.

The lockfile is kept on the latest compatible Next 15.5 patch release, and
`sharp` is pinned to the patched `0.35.5` release for the production image
pipeline. These updates were applied without a forced framework migration.

## Production audit status

The current `npm audit --omit=dev --audit-level=high` report is clean. Two
compatible npm overrides enforce patched transitive versions:

- `postcss@8.5.28` resolves the vulnerable nested PostCSS copy used by Next
  15.5.27 without upgrading the framework.
- `esbuild@0.28.2` resolves the vulnerable transitive build-tool copy.

The `shadcn` CLI is classified as a development dependency because its CSS is
consumed during the Next build and it is not imported by application routes at
runtime. This removes its `braces` and `undici` tooling paths from the
production dependency audit while preserving the Vercel build.

The full development audit still reports high findings in preview tooling such
as Shadcn, Vinext, Vite, Cloudflare/Miniflare, `undici`, `ws`, and nested image
parsers. Those packages are used for local preview/build tooling and are not
imported by Nivara application routes. Reassess them before using the preview
toolchain in an untrusted environment or when upgrading its package ranges.

Sites/Cloudflare and Vinext preview dependencies are development-only and are
not part of the standard Vercel production dependency set. Run
`npm audit --omit=dev` again before a real production launch and after any
supported framework upgrade. Reassess the overrides when the project is ready
for a tested Next major-version migration.

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
