'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const SEED_USERS: Array<{ email: string; label: string; role: string }> = [
  { email: 'boss@prestige.dev', role: 'Tenant super admin — every Prestige community', label: 'Boss (Prestige)' },
  { email: 'boss@sobha.dev', role: 'Tenant super admin — every Sobha community', label: 'Boss (Sobha)' },
  { email: 'alice@prestige.dev', role: 'Admin @ Lakeside, Resident @ Falcon', label: 'Alice' },
  { email: 'bob@sobha.dev', role: 'Admin @ both Sobha communities', label: 'Bob' },
  { email: 'carol@anacity.dev', role: 'Resident @ Lakeside AND Dream Acres', label: 'Carol' },
  { email: 'dave@prestige.dev', role: 'Resident @ Falcon', label: 'Dave' },
  { email: 'ravi@prestige.dev', role: 'Security across both Prestige', label: 'Ravi' },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('alice@prestige.dev');
  const [password, setPassword] = useState('dev');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.message ?? 'Login failed');
        return;
      }
      router.push('/home');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto space-y-10 pt-10">
      <div className="space-y-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-6.png"
          alt="Anacity — Powering Smarter Communities"
          className="h-10 w-auto"
        />
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="text-sm text-ink-secondary">
            Authenticate to manage communities, units, and roles.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-ink-secondary mb-1.5">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-line-strong bg-surface rounded text-sm px-3 py-2 focus:outline-none"
            required
            autoComplete="email"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-secondary mb-1.5">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-line-strong bg-surface rounded text-sm px-3 py-2 focus:outline-none"
            required
            autoComplete="current-password"
          />
        </div>
        {error ? (
          <p className="text-sm text-danger border-l-2 border-danger pl-3 py-1">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={busy}
          className="btn-brand w-full text-sm font-medium rounded py-2"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <div className="space-y-3 border-t border-line pt-6">
        <p className="text-xs uppercase tracking-wider font-medium text-ink-tertiary">
          Seed users · password is <span className="font-mono normal-case tracking-normal">dev</span>
        </p>
        <ul className="space-y-1.5">
          {SEED_USERS.map((u) => (
            <li key={u.email}>
              <button
                onClick={() => setEmail(u.email)}
                className="w-full text-left group"
              >
                <div className="font-mono text-xs text-ink-secondary group-hover:text-ink transition-colors">
                  {u.email}
                </div>
                <div className="text-xs text-ink-tertiary">{u.role}</div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
