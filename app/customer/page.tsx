'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface License {
  key: string;
  plan: string;
  expires_at: string;
  active: boolean;
  ip: string;
  ip_locked: boolean;
  last_seen: string | null;
}

interface Customer {
  id: number;
  email: string;
  license_key: string | null;
  created_at: string;
}

const PLAN_LABELS: Record<string, string> = {
  '1month': '1 Month', '3month': '3 Months', '6month': '6 Months',
};

export default function CustomerDashboard() {
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [license, setLicense] = useState<License | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/customer/me')
      .then((r) => { if (r.status === 401) { router.push('/customer/login'); return null; } return r.json(); })
      .then((data) => { if (!data) return; setCustomer(data.customer); setLicense(data.license); setLoading(false); })
      .catch(() => router.push('/customer/login'));
  }, [router]);

  async function logout() {
    await fetch('/api/customer/logout', { method: 'POST' });
    router.push('/customer/login');
  }

  function copyKey() {
    if (!license) return;
    navigator.clipboard.writeText(license.key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050510] flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  const now = new Date();
  const expired = license ? new Date(license.expires_at) <= now : false;
  const status = !license ? null : !license.active ? 'revoked' : expired ? 'expired' : 'active';

  return (
    <div className="min-h-screen bg-[#050510] text-white px-4 py-10">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-xl font-extrabold">FTW<span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">Sentinel</span></h1>
            <p className="text-zinc-500 text-xs mt-0.5">{customer?.email}</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-zinc-500 hover:text-zinc-300 text-xs">Home</Link>
            <button onClick={logout} className="text-zinc-500 hover:text-white text-xs border border-white/10 rounded-full px-3 py-1.5 transition hover:border-white/30">
              Logout
            </button>
          </div>
        </div>

        {/* License card */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 mb-4">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-zinc-300">License</h2>
            {status && (
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                status === 'active' ? 'bg-emerald-500/15 text-emerald-400' :
                status === 'expired' ? 'bg-yellow-500/15 text-yellow-400' :
                'bg-red-500/15 text-red-400'
              }`}>
                {status}
              </span>
            )}
          </div>

          {license ? (
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-zinc-500 text-xs mb-1.5">License Key</p>
                <div className="flex items-center gap-2 bg-black/30 border border-white/10 rounded-xl px-4 py-3">
                  <code className="text-indigo-300 font-mono text-sm flex-1 break-all">{license.key}</code>
                  <button onClick={copyKey} className="text-zinc-500 hover:text-white text-xs shrink-0 transition">
                    {copied ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-black/20 rounded-xl px-4 py-3">
                  <p className="text-zinc-500 text-xs mb-1">Plan</p>
                  <p className="text-white text-sm font-medium">{PLAN_LABELS[license.plan] ?? license.plan}</p>
                </div>
                <div className="bg-black/20 rounded-xl px-4 py-3">
                  <p className="text-zinc-500 text-xs mb-1">Expires</p>
                  <p className="text-white text-sm font-medium">{new Date(license.expires_at).toLocaleDateString()}</p>
                </div>
                <div className="bg-black/20 rounded-xl px-4 py-3">
                  <p className="text-zinc-500 text-xs mb-1">Bound IP</p>
                  <p className="text-white text-sm font-medium font-mono">{license.ip_locked ? license.ip : <span className="text-zinc-500">Unbound</span>}</p>
                </div>
                <div className="bg-black/20 rounded-xl px-4 py-3">
                  <p className="text-zinc-500 text-xs mb-1">Last Seen</p>
                  <p className="text-white text-sm font-medium">{license.last_seen ? new Date(license.last_seen).toLocaleDateString() : <span className="text-zinc-500">Never</span>}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-zinc-500 text-sm mb-4">No license linked to your account.</p>
              <p className="text-zinc-600 text-xs">Purchase a plan or contact support on <a href="https://discord.gg/Prr7FuvBJc" className="text-indigo-400 hover:text-indigo-300">Discord</a> to link your key.</p>
            </div>
          )}
        </div>

        {/* Analytics placeholder */}
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6 text-center">
          <p className="text-zinc-600 text-xs uppercase tracking-widest mb-2">Analytics</p>
          <p className="text-zinc-500 text-sm">Coming soon</p>
        </div>

      </div>
    </div>
  );
}
