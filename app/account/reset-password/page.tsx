'use client';

import Link from 'next/link';
import { useEffect, useState, type SubmitEvent } from 'react';

type RecoverySession = { accessToken: string; refreshToken?: string };

function recoverySessionFromHash(): RecoverySession | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.hash.slice(1));
  const accessToken = params.get('access_token');
  if (!accessToken) return null;
  return {
    accessToken,
    refreshToken: params.get('refresh_token') ?? undefined,
  };
}

export default function ResetPasswordPage() {
  const [session, setSession] = useState<RecoverySession | null>(null);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const recovered = recoverySessionFromHash();
    const timer = window.setTimeout(() => setSession(recovered), 0);
    if (recovered) window.history.replaceState({}, '', '/account/reset-password');
    return () => window.clearTimeout(timer);
  }, []);

  const submit = async (event: SubmitEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');
    if (!session) {
      setError('This password-reset link is missing or has expired.');
      return;
    }
    if (password !== confirmation) {
      setError('Passwords do not match.');
      return;
    }
    setSaving(true);
    try {
      const response = await fetch('/api/auth/update-password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...session, password }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error ?? 'Password update failed');
      setMessage('Your password has been updated. You can now use your account.');
      setPassword('');
      setConfirmation('');
      setSession(null);
    } catch (reason: unknown) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Password update failed. Please request a new link.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f8f4ee] px-5 py-16 text-[#27362d]">
      <div className="mx-auto max-w-md rounded-[2rem] bg-[#fffaf3] p-8 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#a6503d]">
          Nivara account
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">
          Choose a new password
        </h1>
        <p className="mt-3 text-sm leading-6 text-[#718078]">
          Use at least eight characters. Your reset link is short-lived and can
          only be used with this account.
        </p>
        {error && (
          <p role="alert" className="mt-5 rounded-xl bg-[#fbe9e4] p-3 text-sm text-[#8b3e30]">
            {error}
          </p>
        )}
        {message && (
          <output className="mt-5 block rounded-xl bg-[#e7f0e7] p-3 text-sm text-[#315b3a]">
            {message}
          </output>
        )}
        {session ? (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block text-sm font-medium">
              New password
              <input
                required
                minLength={8}
                maxLength={128}
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 h-12 w-full rounded-xl border border-[#d8cec1] bg-white px-4 outline-none focus:border-[#a6503d] focus:ring-2 focus:ring-[#a6503d]/20"
              />
            </label>
            <label className="block text-sm font-medium">
              Confirm new password
              <input
                required
                minLength={8}
                maxLength={128}
                type="password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                className="mt-2 h-12 w-full rounded-xl border border-[#d8cec1] bg-white px-4 outline-none focus:border-[#a6503d] focus:ring-2 focus:ring-[#a6503d]/20"
              />
            </label>
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-full bg-[#314338] px-5 py-3 font-semibold text-[#fffaf3] disabled:opacity-60"
            >
              {saving ? 'Updating…' : 'Update password'}
            </button>
          </form>
        ) : (
          <p className="mt-6 text-sm text-[#718078]">
            Request another reset link from your{' '}
            <Link className="font-semibold text-[#a6503d] underline" href="/account">
              account page
            </Link>
            .
          </p>
        )}
      </div>
    </main>
  );
}
