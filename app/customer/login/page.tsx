'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch('/api/customer/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, rememberMe }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); setLoading(false); return; }
    router.push('/customer');
  }

  return (
    <div className="min-h-screen bg-[#050510] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-extrabold text-white">FTW<span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">Sentinel</span></h1>
          <p className="text-zinc-500 text-sm mt-1">Customer Portal</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-8">
          <h2 className="text-white font-semibold text-lg mb-6">Sign in</h2>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="text-zinc-400 text-xs mb-1.5 block">Email</label>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                className="w-full bg-white/5 border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-indigo-500 placeholder:text-zinc-600"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="text-zinc-400 text-xs mb-1.5 block">Password</label>
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                className="w-full bg-white/5 border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-indigo-500 placeholder:text-zinc-600"
                placeholder="••••••••"
              />
            </div>
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setRememberMe((v) => !v)}
                className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${rememberMe ? 'bg-indigo-500 border-indigo-500' : 'border-white/20 bg-white/5'}`}
                aria-label="Remember me"
              >
                {rememberMe && <span className="text-white text-[10px] leading-none">✓</span>}
              </button>
              <span className="text-zinc-400 text-xs select-none cursor-pointer" onClick={() => setRememberMe((v) => !v)}>
                Remember me for 30 days
              </span>
            </div>
            <button
              type="submit" disabled={loading}
              className="w-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 py-2.5 text-sm font-semibold text-white hover:opacity-90 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-1"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
          <p className="text-zinc-600 text-xs text-center mt-5">
            No account?{' '}
            <Link href="/customer/register" className="text-indigo-400 hover:text-indigo-300">Register here</Link>
          </p>
        </div>
        <p className="text-center mt-4">
          <Link href="/" className="text-zinc-600 hover:text-zinc-400 text-xs">← Back to home</Link>
        </p>
      </div>
    </div>
  );
}
