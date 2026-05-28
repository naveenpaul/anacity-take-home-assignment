'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Branding = {
  logo: string;
  primaryColor: string;
  theme: string;
};

export default function BrandingForm({
  tenantName,
  tenantSlug,
  initial,
}: {
  tenantName: string;
  tenantSlug: string;
  initial: Branding;
}) {
  const router = useRouter();
  const [logo, setLogo] = useState(initial.logo);
  const [primaryColor, setPrimaryColor] = useState(initial.primaryColor);
  const [theme, setTheme] = useState(initial.theme);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    const res = await fetch('/api/v1/tenants/me/branding', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ logo, primaryColor, theme }),
      credentials: 'include',
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.message ?? 'Save failed');
      return;
    }
    setSavedAt(new Date());
    // Refresh the layout so the new branding renders immediately.
    router.refresh();
  }

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_18rem]">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Tenant</label>
          <input
            value={`${tenantName} (${tenantSlug})`}
            disabled
            className="w-full border border-gray-200 rounded px-3 py-2 text-sm bg-gray-50 text-gray-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            Tenant name + slug aren&apos;t editable in the POC — they drive the
            subdomain.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Logo URL</label>
          <input
            value={logo}
            onChange={(e) => setLogo(e.target.value)}
            placeholder="/brand/your-logo.svg"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Primary color</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value.toUpperCase())}
              className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
            />
            <input
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm font-mono"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Theme</label>
          <input
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {savedAt ? (
          <p className="text-sm text-green-700">
            Saved at {savedAt.toLocaleTimeString()} — header should reflect the
            new brand on next navigation.
          </p>
        ) : null}

        <button
          onClick={submit}
          disabled={busy}
          className="px-4 py-2 rounded text-sm text-white disabled:opacity-50"
          style={{ background: primaryColor }}
        >
          {busy ? 'Saving…' : 'Save branding'}
        </button>
      </div>

      <aside className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Preview
        </h3>
        <div className="border border-gray-200 rounded p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded"
              style={{ background: primaryColor }}
            />
            <div>
              <p className="font-semibold">{tenantName}</p>
              <p className="text-xs text-gray-500">{tenantSlug}.localhost</p>
            </div>
          </div>
          <button
            disabled
            className="text-xs px-3 py-1.5 rounded text-white"
            style={{ background: primaryColor }}
          >
            Primary button sample
          </button>
          <p className="text-xs text-gray-500">
            Logo: <code>{logo || '(none)'}</code>
          </p>
        </div>
      </aside>
    </div>
  );
}
