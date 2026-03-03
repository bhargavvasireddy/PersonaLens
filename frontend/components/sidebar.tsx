"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/ui-analysis", label: "UI Analysis" },
  { href: "/personas", label: "Personas" },
  { href: "/previous-feedback", label: "Previous Feedback" },
  { href: "/settings", label: "Settings" }
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-slate-200 bg-white/70 p-6 backdrop-blur">
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
    </aside>
  );
}

