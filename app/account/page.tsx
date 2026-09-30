"use client";

import Link from "next/link";
import { ArrowRight, Heart, LogOut, Package, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { SyntheticEvent } from "react";
import { useCart } from "@/components/cart-provider";

type Mode = "login" | "signup" | "reset";

export default function AccountPage() {
  const { refresh: refreshCart } = useCart();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const strength = useMemo(() => [password.length >= 8, /[A-Z]/.test(password), /\d/.test(password), /[^A-Za-z0-9]/.test(password)].filter(Boolean).length, [password]);

  useEffect(() => {
    fetch("/api/account/profile", { cache: "no-store" })
      .then(async (response) => response.ok ? await response.json() as { data?: { email?: string } } : null)
      .then((result) => {
        if (result?.data?.email) {
          setEmail(result.data.email);
          setSignedIn(true);
          void refreshCart();
        }
      })
      .catch(() => undefined);
  }, [refreshCart]);

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (!email.includes("@")) return setMessage("Enter a valid email address.");
    if (mode !== "reset" && password.length < 8) return setMessage("Use at least 8 characters for your password.");
    setBusy(true);
    const endpoint = mode === "login" ? "/api/auth/login" : mode === "signup" ? "/api/auth/signup" : "/api/auth/password-reset";
    const body = mode === "reset" ? { email } : { email, password };
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json().catch(() => ({})) as { error?: string; data?: { needsVerification?: boolean } };
      if (!response.ok) throw new Error(result.error ?? "Something went wrong. Please try again.");
      if (mode === "reset") setMessage("If that address is registered, a reset link is on its way.");
      else if (mode === "signup" && result.data?.needsVerification) setMessage("Check your email to verify your Nivara account.");
      else {
        await fetch("/api/cart/merge", { method: "POST" });
        await refreshCart();
        setSignedIn(true);
        setMessage("You’re signed in.");
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Something went wrong. Please try again."); }
    finally { setBusy(false); }
  }

  if (signedIn) return <main className="page-transition min-h-screen bg-[#f8f4ee] px-5 py-10 text-[#27362d] lg:px-8 lg:py-16"><div className="mx-auto max-w-[1000px]"><Link href="/" className="brand-mark"><span className="brand-icon">N</span><span className="font-display text-2xl font-semibold tracking-[-0.06em]">nivara</span></Link><div className="mt-14 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="eyebrow">Your account</p><h1 className="mt-3 font-display text-6xl tracking-[-0.08em]">Welcome back.</h1><p className="mt-4 text-[#637268]">Your quiet little corner for orders, saved pieces, and addresses.</p></div><button type="button" onClick={() => { void fetch("/api/auth/logout", { method: "POST" }); setSignedIn(false); }} className="button-secondary"><LogOut size={16} /> Sign out</button></div><div className="mt-10 grid gap-4 sm:grid-cols-3"><Link href="/checkout" className="account-card"><Package size={20} /><span><strong>Order history</strong><small>Track your latest order</small></span><ArrowRight size={16} /></Link><Link href="/shop" className="account-card"><Heart size={20} /><span><strong>Saved pieces</strong><small>Keep a list for later</small></span><ArrowRight size={16} /></Link><div className="account-card"><ShieldCheck size={20} /><span><strong>Account security</strong><small>Email verified and protected</small></span></div></div><div className="mt-6 rounded-[1.5rem] bg-[#fffaf3] p-7"><p className="eyebrow">Personal details</p><div className="mt-5 grid gap-5 sm:grid-cols-2"><div><p className="text-sm text-[#718078]">Email</p><p className="mt-1 font-semibold">{email}</p></div><div><p className="text-sm text-[#718078]">Saved address</p><p className="mt-1 font-semibold">Add your first delivery address</p></div></div></div></div></main>;

  return <main className="page-transition grid min-h-screen place-items-center bg-[#f8f4ee] px-5 py-10 text-[#27362d]"><div className="w-full max-w-md rounded-[2rem] bg-[#fffaf3] p-8 shadow-[0_18px_55px_rgba(52,64,53,0.1)]"><Link href="/" className="brand-mark"><span className="brand-icon">N</span><span className="font-display text-2xl font-semibold tracking-[-0.06em]">nivara</span></Link><p className="eyebrow mt-10">Your Nivara account</p><h1 className="mt-3 font-display text-4xl tracking-[-0.06em]">{mode === "login" ? "Welcome back." : mode === "signup" ? "Make it yours." : "Reset your password."}</h1><p className="mt-4 text-sm leading-6 text-[#637268]">{mode === "login" ? "Sign in to see orders, saved pieces, and delivery details." : mode === "signup" ? "Create an account for a faster, calmer checkout." : "We’ll send a secure reset link to your email."}</p><form onSubmit={submit} className="mt-7 grid gap-4"><label className="grid gap-2 text-sm font-semibold">Email<input required value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="you@example.com" className="h-12 rounded-xl border border-[#d8cec1] bg-[#f8f4ee] px-4 font-normal outline-none focus:ring-2 focus:ring-[#c6674f]" /></label>{mode !== "reset" && <label className="grid gap-2 text-sm font-semibold">Password<input required value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="At least 8 characters" className="h-12 rounded-xl border border-[#d8cec1] bg-[#f8f4ee] px-4 font-normal outline-none focus:ring-2 focus:ring-[#c6674f]" />{mode === "signup" && <span className="password-meter" aria-live="polite"><span style={{ width: `${strength * 25}%` }} />{strength < 2 ? "Use a mix of letters, numbers, and symbols" : strength < 4 ? "Almost there" : "Strong password"}</span>}</label>}{message && <output aria-live="polite" className="rounded-xl bg-[#e7eee5] px-4 py-3 text-sm leading-5 text-[#536259]">{message}</output>}<button type="submit" disabled={busy} className="button-primary w-full justify-center disabled:cursor-wait disabled:opacity-60">{busy ? "Working…" : mode === "login" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}</button></form><div className="mt-6 flex flex-wrap justify-between gap-3 text-sm font-semibold text-[#a6503d]">{mode === "login" && <><button type="button" onClick={() => setMode("signup")}>Create account</button><button type="button" onClick={() => setMode("reset")}>Forgot password?</button></>}{mode !== "login" && <button type="button" onClick={() => setMode("login")}>Back to sign in</button>}</div><Link href="/" className="mt-7 block text-center text-sm font-semibold text-[#a6503d]">Return home</Link></div></main>;
}
