export function validateLaunchTarget(
  deploymentUrl: string,
  configuredSiteUrl?: string,
): string | null {
  let deploymentTarget: URL;
  try {
    deploymentTarget = new URL(deploymentUrl);
  } catch {
    return 'Launch preflight requires a valid HTTP(S) deployment URL.';
  }

  if (deploymentTarget.protocol !== 'https:') {
    return 'Launch preflight requires an HTTPS deployment URL.';
  }

  if (!configuredSiteUrl) return null;

  let configuredTarget: URL;
  try {
    configuredTarget = new URL(configuredSiteUrl);
  } catch {
    return 'NEXT_PUBLIC_SITE_URL must be a valid HTTP(S) URL.';
  }

  if (configuredTarget.origin !== deploymentTarget.origin) {
    return `Deployment URL origin must match NEXT_PUBLIC_SITE_URL (${configuredTarget.origin}).`;
  }

  return null;
}
