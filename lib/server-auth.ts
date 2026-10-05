import { prisma } from '@/lib/prisma';
import { providerFetch } from '@/lib/provider-fetch';
import { hasConfiguredValue } from '@/lib/configuration';

export type AuthenticatedIdentity = {
  id: string;
  email: string;
};

type SupabaseUser = {
  id?: string;
  email?: string;
  email_confirmed_at?: string | null;
  confirmed_at?: string | null;
};

function hasVerifiedEmail(user: SupabaseUser) {
  if (Object.hasOwn(user, 'email_confirmed_at'))
    return Boolean(user.email_confirmed_at);
  if (Object.hasOwn(user, 'confirmed_at')) return Boolean(user.confirmed_at);
  return false;
}

function getBearerToken(request: Request) {
  const value = request.headers.get('authorization');
  if (!value?.startsWith('Bearer ')) return null;
  return value.slice('Bearer '.length).trim() || null;
}

function getCookieToken(request: Request) {
  const header = request.headers.get('cookie');
  if (!header) return null;
  const cookies = new Map(
    header.split(';').map((part) => {
      const separator = part.indexOf('=');
      return separator < 0
        ? [part.trim(), '']
        : [part.slice(0, separator).trim(), part.slice(separator + 1).trim()];
    }),
  );
  const directToken = cookies.get('nivara-access-token');
  if (directToken) {
    try {
      const decoded = decodeURIComponent(directToken);
      return decoded.startsWith('"') && decoded.endsWith('"')
        ? decoded.slice(1, -1)
        : decoded;
    } catch {
      return null;
    }
  }
  const sessionNames = [...cookies.keys()]
    .filter((name) => /^sb-[^-]+-auth-token(?:\.\d+)?$/.test(name))
    .sort((left, right) => {
      const leftChunk = Number(left.match(/\.(\d+)$/)?.[1] ?? 0);
      const rightChunk = Number(right.match(/\.(\d+)$/)?.[1] ?? 0);
      return leftChunk - rightChunk;
    });
  if (!sessionNames.length) return null;
  const encoded = sessionNames.map((name) => cookies.get(name) ?? '').join('');
  const decoded = sessionNames
    .map((name) => {
      const value = cookies.get(name) ?? '';
      try {
        return decodeURIComponent(value);
      } catch {
        // Preserve malformed chunks so the full candidate still fails closed.
        return value;
      }
    })
    .join('');
  const candidates = [encoded, decoded];
  for (const candidate of candidates) {
    try {
      const json = candidate.startsWith('base64-')
        ? Buffer.from(candidate.slice('base64-'.length), 'base64').toString(
            'utf8',
          )
        : candidate;
      const session = JSON.parse(json) as {
        access_token?: string;
        accessToken?: string;
      };
      const token = session.access_token ?? session.accessToken;
      if (token) return token;
    } catch {
      // The cookie may be chunked or encoded by a different Supabase client version.
    }
  }
  return null;
}

export function getAccessToken(request: Request) {
  return getBearerToken(request) ?? getCookieToken(request);
}

export async function getAuthenticatedIdentity(
  request: Request,
): Promise<AuthenticatedIdentity | null> {
  const token = getAccessToken(request);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (
    !token ||
    !hasConfiguredValue(supabaseUrl, ['your-project']) ||
    !hasConfiguredValue(anonKey)
  )
    return null;

  let response: Response;
  try {
    response = await providerFetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    });
  } catch {
    return null;
  }

  if (!response.ok) return null;
  const user = (await response.json()) as SupabaseUser;
  if (!user.id || !user.email || !hasVerifiedEmail(user)) return null;

  return { id: user.id, email: user.email };
}

export async function isAdministrator(identity: AuthenticatedIdentity) {
  const user = await prisma.user.findUnique({
    where: { id: identity.id },
    select: { isAdmin: true },
  });
  return user?.isAdmin === true;
}

export async function ensureUserProfile(identity: AuthenticatedIdentity) {
  return prisma.user.upsert({
    where: { id: identity.id },
    create: { id: identity.id, email: identity.email },
    update: { email: identity.email },
    select: { id: true, email: true, displayName: true, isAdmin: true },
  });
}
