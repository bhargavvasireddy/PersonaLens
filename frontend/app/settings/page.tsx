export default function SettingsPage() {
  return (
    <section className="mx-auto w-full max-w-4xl space-y-8">
      <header>
        <h2 className="text-2xl font-bold text-slate-900">Settings</h2>
        <p className="mt-1 text-sm text-slate-500">Manage your workspace preferences and configuration.</p>
        <div className="mt-5 border-b border-slate-200" />
      </header>

      {/* Account */}
      <div className="rounded-xl border border-slate-200 bg-white shadow ring-1 ring-black/5 overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4">
          <h3 className="text-sm font-semibold text-slate-900">Account</h3>
          <p className="mt-0.5 text-xs text-slate-500">Your account is managed via Supabase Auth.</p>
        </div>
        <div className="divide-y divide-slate-100">
          <SettingRow
            label="Authentication"
            value="Supabase (ES256 JWT)"
            badge="Active"
            badgeColor="emerald"
          />
          <SettingRow
            label="Session management"
            value="Tokens refreshed automatically by the client"
          />
        </div>
      </div>

      {/* AI Model */}
      <div className="rounded-xl border border-slate-200 bg-white shadow ring-1 ring-black/5 overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4">
          <h3 className="text-sm font-semibold text-slate-900">AI Model</h3>
          <p className="mt-0.5 text-xs text-slate-500">Model used for persona-based UI evaluations.</p>
        </div>
        <div className="divide-y divide-slate-100">
          <SettingRow label="Provider" value="OpenAI" />
          <SettingRow label="Model" value="Configured via backend .env (MODEL_NAME)" />
          <SettingRow label="Evaluation storage" value="Supabase Postgres — evaluations table" />
        </div>
      </div>

      {/* Storage */}
      <div className="rounded-xl border border-slate-200 bg-white shadow ring-1 ring-black/5 overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4">
          <h3 className="text-sm font-semibold text-slate-900">File Storage</h3>
          <p className="mt-0.5 text-xs text-slate-500">Where uploaded screenshots are stored.</p>
        </div>
        <div className="divide-y divide-slate-100">
          <SettingRow
            label="Upload location"
            value="Local — backend/uploads/"
            badge="Local"
            badgeColor="slate"
          />
          <SettingRow label="Max file size" value="No limit enforced (backend configurable)" />
        </div>
      </div>

      {/* Coming soon */}
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 py-5">
        <p className="text-sm font-medium text-slate-600">More settings coming soon</p>
        <p className="mt-1 text-xs text-slate-400">
          Per-user data scoping, Supabase Storage migration, sign-up flow, and route protection are planned.
        </p>
      </div>
    </section>
  );
}

function SettingRow({
  label,
  value,
  badge,
  badgeColor = "slate"
}: {
  label: string;
  value: string;
  badge?: string;
  badgeColor?: "emerald" | "slate" | "indigo";
}) {
  const badgeStyles: Record<string, string> = {
    emerald: "bg-emerald-100 text-emerald-700",
    slate: "bg-slate-100 text-slate-600",
    indigo: "bg-indigo-100 text-indigo-700"
  };

  return (
    <div className="flex items-center justify-between gap-4 px-6 py-4">
      <p className="text-sm text-slate-600">{label}</p>
      <div className="flex items-center gap-2">
        <p className="text-right text-sm font-medium text-slate-800">{value}</p>
        {badge && (
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badgeStyles[badgeColor]}`}>
            {badge}
          </span>
        )}
      </div>
    </div>
  );
}
