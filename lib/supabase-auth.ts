import { providerFetch } from '@/lib/provider-fetch';
import { hasConfiguredValue } from '@/lib/configuration';

export type SupabaseSession = {
  access_token?: string;
  refresh_token?: string;
  user?: { id?: string; email?: string };
};

export async function supabaseAuthRequest(
  path: string,
  body: Record<string, unknown>,
) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!hasConfiguredValue(url, ['your-project']) || !hasConfiguredValue(anonKey))
    return null;
  let response: Response;
  try {
    response = await providerFetch(`${url}/auth/v1/${path}`, {
      method: 'POST',
      headers: { apikey: anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
  } catch {
    return null;
  }
  const data = (await response.json().catch(() => ({}))) as SupabaseSession & {
    error_description?: string;
    msg?: string;
  };
  return { ok: response.ok, data };
}

export async function supabaseUpdatePassword({
  accessToken,
  password,
}: {
  accessToken: string;
  password: string;
}) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!hasConfiguredValue(url, ['your-project']) || !hasConfiguredValue(anonKey))
    return null;
  let response: Response;
  try {
    response = await providerFetch(`${url}/auth/v1/user`, {
      method: 'PUT',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password }),
      cache: 'no-store',
    });
  } catch {
    return null;
  }
  const data = (await response.json().catch(() => ({}))) as SupabaseSession & {
    error_description?: string;
    msg?: string;
  };
  return { ok: response.ok, data };
}

export async function supabaseLogout(accessToken: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!hasConfiguredValue(url, ['your-project']) || !hasConfiguredValue(anonKey))
    return false;
  try {
    const response = await providerFetch(`${url}/auth/v1/logout`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
    });
    return response.ok;
  } catch {
    return false;
  }
}
