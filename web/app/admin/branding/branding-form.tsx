'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

const MAX_LOGO_BYTES = 400 * 1024;

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
  const [logoError, setLogoError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file) return;
    setLogoError(null);
    if (!file.type.startsWith('image/')) {
      setLogoError('Please choose an image file (PNG, SVG, JPG).');
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setLogoError('Image is too large — keep it under 400 KB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      setLogo(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => setLogoError('Could not read that file.');
    reader.readAsDataURL(file);
  }

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
    router.refresh();
  }

  return (
    <div className="grid gap-8 md:grid-cols-[1fr_18rem]">
      <div className="space-y-5">
        <div>
          <label className="block text-xs font-medium text-ink-secondary mb-1.5">
            Tenant
          </label>
          <div className="border border-line rounded text-sm px-3 py-2 bg-surface-muted flex items-baseline gap-2">
            <span className="font-medium">{tenantName}</span>
            <span className="font-mono text-xs text-ink-tertiary">
              {tenantSlug}.localhost
            </span>
          </div>
          <p className="text-xs text-ink-tertiary mt-1.5">
            Name + slug aren't editable in the POC — they drive the subdomain.
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-ink-secondary mb-1.5">
            Logo
          </label>
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 border border-line-strong rounded-sm bg-surface-muted flex items-center justify-center overflow-hidden shrink-0">
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logo}
                  alt="Logo preview"
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <span className="text-2xs text-ink-tertiary">No logo</span>
              )}
            </div>
            <div className="flex flex-col items-start gap-1.5">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onPickFile}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="btn-secondary text-sm font-medium rounded px-3 py-1.5"
              >
                Upload image
              </button>
              {logo ? (
                <button
                  type="button"
                  onClick={() => setLogo('')}
                  className="text-xs text-ink-tertiary hover:text-ink transition-colors"
                >
                  Remove
                </button>
              ) : null}
            </div>
          </div>
          {logoError ? (
            <p className="text-xs text-danger mt-1.5">{logoError}</p>
          ) : null}
          <input
            value={logo.startsWith('data:') ? '' : logo}
            onChange={(e) => setLogo(e.target.value)}
            placeholder="…or paste an image URL (/brand/logo.svg)"
            className="w-full font-mono border border-line-strong rounded text-sm px-3 py-2 bg-surface mt-2"
          />
          <p className="text-xs text-ink-tertiary mt-1.5">
            PNG, SVG, or JPG up to 400 KB. Uploads are stored inline on the
            tenant.
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-ink-secondary mb-1.5">
            Primary color
          </label>
          <div className="flex items-stretch gap-2">
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value.toUpperCase())}
              className="w-14 h-10 border border-line-strong rounded cursor-pointer p-0"
            />
            <input
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="flex-1 font-mono border border-line-strong rounded text-sm px-3 py-2 bg-surface"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-ink-secondary mb-1.5">
            Theme
          </label>
          <input
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            className="w-full font-mono border border-line-strong rounded text-sm px-3 py-2 bg-surface"
          />
        </div>

        {error ? (
          <p className="text-sm text-danger border-l-2 border-danger pl-3 py-1">
            {error}
          </p>
        ) : null}
        {savedAt ? (
          <p className="text-sm text-success border-l-2 border-success pl-3 py-1">
            Saved at <span className="font-mono">{savedAt.toLocaleTimeString()}</span>.
            Header reflects the new brand on next navigation.
          </p>
        ) : null}

        <button
          onClick={submit}
          disabled={busy}
          className="btn-brand text-sm font-medium rounded px-4 py-2"
          style={{ background: primaryColor }}
        >
          {busy ? 'Saving…' : 'Save branding'}
        </button>
      </div>

      <aside className="space-y-3">
        <h3 className="text-xs uppercase tracking-wider font-medium text-ink-tertiary">
          Preview
        </h3>
        <div className="border border-line rounded-sm p-4 space-y-4 bg-surface-raised">
          <div className="flex items-center gap-3">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logo}
                alt=""
                className="h-8 w-auto max-w-[120px] object-contain"
              />
            ) : (
              <div
                className="w-8 h-8 rounded-sm"
                style={{ background: primaryColor }}
              />
            )}
            <div>
              <p className="font-semibold text-sm">{tenantName}</p>
              <p className="font-mono text-xs text-ink-tertiary">
                {tenantSlug}.localhost
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <button
              disabled
              className="text-xs font-medium text-white rounded px-3 py-1.5"
              style={{ background: primaryColor }}
            >
              Primary action
            </button>
            <span
              className="ml-2 text-xs font-medium px-2 py-0.5 rounded-full inline-block"
              style={{
                background: hexToSoftRgba(primaryColor, 0.1),
                color: primaryColor,
              }}
            >
              Tinted badge
            </span>
          </div>
          <p className="text-xs text-ink-tertiary">
            {logo ? 'Logo applies to the header on next load.' : 'No logo set.'}
          </p>
        </div>
      </aside>
    </div>
  );
}

function hexToSoftRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return `rgba(82, 82, 82, ${alpha})`;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
