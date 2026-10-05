const FALLBACK_SITE_URL = 'https://nivara.example';

export function normalizeSiteUrl(value?: string) {
  const candidate = value?.trim() || FALLBACK_SITE_URL;
  const url = new URL(candidate);
  url.search = '';
  url.hash = '';
  url.pathname = url.pathname.replace(/\/+$/, '');
  return url.toString().replace(/\/$/, '');
}
