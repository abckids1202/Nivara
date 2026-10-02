import { getAccessToken } from '@/lib/server-auth';
import { supabaseLogout } from '@/lib/supabase-auth';
import { authResponse } from '@/lib/auth-response';

export async function POST(request: Request) {
  const accessToken = getAccessToken(request);
  if (accessToken) await supabaseLogout(accessToken);
  const response = authResponse({ data: { signedOut: true } });
  response.cookies.delete('nivara-access-token');
  response.cookies.delete('nivara-refresh-token');
  return response;
}
