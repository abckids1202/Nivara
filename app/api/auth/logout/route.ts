import { getAccessToken } from '@/lib/server-auth';
import { supabaseLogout } from '@/lib/supabase-auth';
import { authResponse, clearAuthCookies } from '@/lib/auth-response';

export async function POST(request: Request) {
  const accessToken = getAccessToken(request);
  if (accessToken) await supabaseLogout(accessToken);
  const response = authResponse({ data: { signedOut: true } });
  return clearAuthCookies(response);
}
