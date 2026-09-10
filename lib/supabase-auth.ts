export type SupabaseSession = {
  access_token?: string;
  refresh_token?: string;
  user?: { id?: string; email?: string };
};

export async function supabaseAuthRequest(path: string, body: Record<string, unknown>) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey || anonKey === "replace-me") return null;
  const response = await fetch(`${url}/auth/v1/${path}`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({})) as SupabaseSession & { error_description?: string; msg?: string };
  return { ok: response.ok, data };
}
