"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Tab = "password" | "magic";

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("password");

  // Password state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Magic link state
  const [magicEmail, setMagicEmail] = useState("");
  const [sent, setSent] = useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onPasswordSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) { setError(signInError.message); return; }
      router.push("/ui-analysis");
      router.refresh();
    } catch {
      setError("Unable to reach Supabase Auth. Check frontend env keys and internet access.");
    } finally {
      setLoading(false);
    }
  }

  async function onSendMagicLink(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { error: magicError } = await supabase.auth.signInWithOtp({
        email: magicEmail,
        options: { shouldCreateUser: false },
      });
      if (magicError) { setError(magicError.message); return; }
      setSent(true);
    } catch {
      setError("Unable to send link. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function switchTab(next: Tab) {
    setTab(next);
    setError("");
    setSent(false);
    setMagicEmail("");
  }

  return (
    <div className="-m-8 flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm">
        {/* Brand mark */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">PersonaLens</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in to your account to continue</p>
        </div>

        {/* Form card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-lg ring-1 ring-black/5">
          {/* Tabs */}
          <div className="mb-6 flex rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => switchTab("password")}
              className={`flex-1 rounded-md py-1.5 text-sm font-medium transition ${
                tab === "password"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Password
            </button>
            <button
              type="button"
              onClick={() => switchTab("magic")}
              className={`flex-1 rounded-md py-1.5 text-sm font-medium transition ${
                tab === "magic"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Magic link
            </button>
          </div>

          {/* Password form */}
          {tab === "password" && (
            <form onSubmit={onPasswordSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700">Email address</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700">Password</label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                  placeholder="••••••••"
                />
              </div>
              <ErrorBox message={error} />
              <SubmitButton loading={loading} label="Sign in" loadingLabel="Signing in…" />
            </form>
          )}

          {/* Magic link form */}
          {tab === "magic" && !sent && (
            <form onSubmit={onSendMagicLink} className="space-y-5">
              <div>
                <label htmlFor="magic-email" className="block text-sm font-medium text-slate-700">Email address</label>
                <input
                  id="magic-email"
                  type="email"
                  autoComplete="email"
                  value={magicEmail}
                  onChange={(e) => setMagicEmail(e.target.value)}
                  required
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                  placeholder="you@example.com"
                />
              </div>
              <ErrorBox message={error} />
              <SubmitButton loading={loading} label="Send magic link" loadingLabel="Sending…" />
            </form>
          )}

          {/* Magic link sent confirmation */}
          {tab === "magic" && sent && (
            <div className="space-y-5 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-indigo-600">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-slate-900">Check your email</p>
                <p className="mt-1 text-sm text-slate-500">
                  We sent a sign-in link to <span className="font-medium text-slate-700">{magicEmail}</span>. Click it to sign in.
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setSent(false); setError(""); }}
                className="text-sm text-indigo-600 hover:text-indigo-700 transition"
              >
                Use a different email
              </button>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-slate-500">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-medium text-indigo-600 hover:text-indigo-700">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 h-4 w-4 shrink-0">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      {message}
    </div>
  );
}

function SubmitButton({ loading, label, loadingLabel }: { loading: boolean; label: string; loadingLabel: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-60 outline-none"
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          {loadingLabel}
        </span>
      ) : label}
    </button>
  );
}
