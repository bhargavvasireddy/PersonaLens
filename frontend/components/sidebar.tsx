"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { type Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

const navItems = [
  { href: "/ui-analysis", label: "UI Analysis" },
  { href: "/personas", label: "Personas" },
  { href: "/previous-feedback", label: "Previous Feedback" },
  { href: "/settings", label: "Settings" }
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <aside className="flex w-64 flex-col border-r border-slate-200 bg-white/70 p-6 backdrop-blur">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">PersonaLens</h1>
        <p className="mt-1 text-sm text-slate-500">HiFi navigation skeleton</p>
      </div>
      <nav className="space-y-2">
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "block rounded-md px-3 py-2 text-sm font-medium transition",
                active ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
              ].join(" ")}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto border-t border-slate-200 pt-4">
        {session ? (
          <div className="space-y-2">
            <p className="truncate px-3 text-xs text-slate-500" title={session.user.email ?? undefined}>
              {session.user.email}
            </p>
            <button
              type="button"
              onClick={signOut}
              className="block w-full rounded-md px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              Sign out
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            className="block rounded-md px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Sign in
          </Link>
        )}
      </div>
    </aside>
  );
}

