'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { SyntheticEvent } from 'react';

const faqs = [
  ['How much is delivery?', '₹79 under ₹999, free at or above ₹999.'],
  ['Where do you deliver?', 'Indian delivery addresses only in this phase.'],
  ['Can I pay cash on delivery?', 'Not in the first release.'],
  [
    'How do I track an order?',
    'Use the secure order link from your confirmation email, or sign in to your account.',
  ],
];

type FormState = { name: string; email: string; message: string };

export default function SupportPage() {
  const [form, setForm] = useState<FormState>({
    name: '',
    email: '',
    message: '',
  });
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const response = await fetch('/api/support', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    if (!response.ok) setError(payload.error ?? 'Message could not be sent.');
    else setSent(true);
    setBusy(false);
  }

  return (
    <main className="page-transition min-h-screen bg-[#f8f4ee] px-5 py-10 text-[#27362d] lg:px-8 lg:py-16">
      <div className="mx-auto max-w-[900px]">
        <Link href="/" className="text-sm font-bold text-[#a6503d]">
          ← Back home
        </Link>
        <p className="eyebrow mt-12">Support</p>
        <h1 className="mt-3 font-display text-6xl tracking-[-0.07em]">
          Let’s make it easy.
        </h1>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl bg-[#e7eee5] p-5">
            <p className="font-semibold">Orders</p>
            <p className="mt-2 text-sm leading-6 text-[#637268]">
              Track delivery, update details, or ask about an order.
            </p>
          </div>
          <div className="rounded-2xl bg-[#fffaf3] p-5">
            <p className="font-semibold">Returns</p>
            <p className="mt-2 text-sm leading-6 text-[#637268]">
              Read the returns policy before sending something back.
            </p>
          </div>
          <div className="rounded-2xl bg-[#f0ddd4] p-5">
            <p className="font-semibold">Contact</p>
            <p className="mt-2 text-sm leading-6 text-[#637268]">
              The support team replies within one business day.
            </p>
          </div>
        </div>
        <section className="mt-10 rounded-[1.5rem] bg-[#314338] p-7 text-[#fffaf3]">
          <h2 className="font-display text-3xl tracking-[-0.05em]">
            Frequently asked
          </h2>
          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            {faqs.map(([question, answer]) => (
              <details
                key={question}
                className="group rounded-xl border border-white/10 p-4"
              >
                <summary className="cursor-pointer list-none font-semibold [&::-webkit-details-marker]:hidden">
                  {question}
                  <span className="float-right text-[#f3c4b4] transition group-open:rotate-45">
                    ＋
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-6 text-[#d7e0d4]">
                  {answer}
                </p>
              </details>
            ))}
          </div>
        </section>
        <section className="mt-8 rounded-[1.5rem] bg-[#fffaf3] p-7">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="eyebrow">Feedback</p>
              <h2 className="mt-2 font-display text-3xl tracking-[-0.05em]">
                Tell us what would make this easier.
              </h2>
            </div>
            <span className="text-sm text-[#718078]">
              Usually replies within one business day
            </span>
          </div>
          {sent ? (
            <output
              aria-live="polite"
              className="mt-6 block rounded-xl bg-[#e7eee5] px-4 py-3 text-sm text-[#536259]"
            >
              Thanks—your message has been sent to the Nivara team.
            </output>
          ) : (
            <form onSubmit={submit} className="mt-6 grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold" htmlFor="support-name">
                  Name
                  <input
                    id="support-name"
                    required
                    autoComplete="name"
                    value={form.name}
                    onChange={(event) =>
                      setForm({ ...form, name: event.target.value })
                    }
                    className="h-11 rounded-xl border border-[#d8cec1] bg-[#f8f4ee] px-4 font-normal outline-none focus:ring-2 focus:ring-[#c6674f]"
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold" htmlFor="support-email">
                  Email
                  <input
                    id="support-email"
                    required
                    type="email"
                    autoComplete="email"
                    value={form.email}
                    onChange={(event) =>
                      setForm({ ...form, email: event.target.value })
                    }
                    className="h-11 rounded-xl border border-[#d8cec1] bg-[#f8f4ee] px-4 font-normal outline-none focus:ring-2 focus:ring-[#c6674f]"
                  />
                </label>
              </div>
              <label className="grid gap-2 text-sm font-semibold" htmlFor="support-message">
                Message
                <textarea
                  id="support-message"
                  required
                  minLength={10}
                  maxLength={4000}
                  rows={4}
                  value={form.message}
                  onChange={(event) =>
                    setForm({ ...form, message: event.target.value })
                  }
                  className="rounded-xl border border-[#d8cec1] bg-[#f8f4ee] px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-[#c6674f]"
                />
              </label>
              {error && (
                <p role="alert" className="text-sm font-semibold text-[#a6503d]">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={busy}
                className="button-primary w-fit disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? 'Sending…' : 'Send feedback'}
              </button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
