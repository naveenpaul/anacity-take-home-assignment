'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const SEED_USERS: Array<{ email: string; label: string }> = [
  { email: 'alice@prestige.dev', label: 'Alice — admin @ Lakeside, resident @ Falcon' },
  { email: 'bob@sobha.dev', label: 'Bob — admin @ both Sobha' },
  { email: 'carol@anacity.dev', label: 'Carol — cross-tenant resident' },
  { email: 'dave@prestige.dev', label: 'Dave — resident @ Falcon' },
  { email: 'ravi@prestige.dev', label: 'Ravi — security across both Prestige' },
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
    <div className="max-w-md space-y-6">
      <h2 className="text-2xl font-semibold">Sign in</h2>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2"
            required
          />
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="px-4 py-2 rounded text-white disabled:opacity-50"
          style={{ background: 'var(--brand-primary)' }}
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <div className="border-t pt-4 space-y-2">
        <p className="text-sm font-medium">Seed users (password is always <code>dev</code>):</p>
        <ul className="space-y-1">
          {SEED_USERS.map((u) => (
            <li key={u.email}>
              <button
                onClick={() => setEmail(u.email)}
                className="text-left text-sm text-blue-600 hover:underline"
              >
                {u.email}
              </button>
              <span className="text-xs text-gray-500"> — {u.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
