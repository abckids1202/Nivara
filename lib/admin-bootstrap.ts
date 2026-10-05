export type SupabaseAdminUser = {
  id?: string;
  email?: string;
  email_confirmed_at?: string | null;
  confirmed_at?: string | null;
};

export function isVerifiedSupabaseUser(
  user: SupabaseAdminUser | null | undefined,
) {
  return Boolean(user?.email_confirmed_at ?? user?.confirmed_at);
}

export function canPromoteAdmin({
  applicationUserId,
  applicationEmail,
  supabaseUser,
}: {
  applicationUserId: string;
  applicationEmail: string;
  supabaseUser: SupabaseAdminUser | null;
}) {
  return Boolean(
    supabaseUser &&
      supabaseUser.id === applicationUserId &&
      supabaseUser.email?.toLowerCase() === applicationEmail.toLowerCase() &&
      isVerifiedSupabaseUser(supabaseUser),
  );
}
