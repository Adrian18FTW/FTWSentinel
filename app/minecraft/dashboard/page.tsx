'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface MinecraftLicense {
  key: string;
  created_at: string;
  last_validated: string | null;
  server_name: string;
  server_version: string;
  is_active: boolean;
}

interface MinecraftStats {
  total_checks: number;
  total_violations: number;
  total_bans: number;
  total_kicks: number;
  players_monitored: number;
  checks_per_second: number;
  uptime_seconds: number;
  server_tps: number;
  check_violations: Record<string, number>;
  updated_at: string;
}

interface MinecraftPlayer {
  name: string;
  violations: number;
  banned: boolean;
  last_seen: string;
}

interface Customer {
  id: number;
  email: string;
}

export default function MinecraftDashboard() {
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [license, setLicense] = useState<MinecraftLicense | null>(null);
  const [stats, setStats] = useState<MinecraftStats | null>(null);
  const [players, setPlayers] = useState<MinecraftPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    fetch('/api/customer/me')
      .then((r) => { if (r.status === 401) { router.push('/customer/login'); return null; } return r.json(); })
      .then((data) => { if (!data) return; setCustomer(data.customer); })
      .catch(() => router.push('/customer/login'));
  }, [router]);

  useEffect(() => {
    if (!customer) return;
    loadStats();
    const interval = setInterval(loadStats, 5000);
    return () => clearInterval(interval);
  }, [customer]);

  async function loadStats() {
    try {
      const res = await fetch('/api/minecraft/stats');
      if (!res.ok) return;
      const data = await res.json();
      setLicense(data.license);
      setStats(data.stats);
      setPlayers(data.players || []);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  }

  async function handleDownload() {
    setDownloading(true);
    try {
      const res = await fetch('/api/minecraft/download');
      if (!res.ok) {
        alert('Failed to download plugin. Please contact support.');
        setDownloading(false);
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'FTWSentinel.jar';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      setTimeout(loadStats, 1000);
    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to download plugin. Please try again.');
    }
    setDownloading(false);
  }

  function copyKey() {
    if (!license) return;
    navigator.clipboard.writeText(license.key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function logout() {
    await fetch('/api/customer/logout', { method: 'POST' });
    router.push('/minecraft');
  }

  function formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a15] flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  const topViolations = stats ? Object.entries(stats.check_violations)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .filter(([, count]) => count > 0) : [];

  return (
    <div className="min-h-screen bg-[#0a0a15] text-white px-4 py-10">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-xl font-extrabold">FTW<span className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">Sentinel</span> <span className="text-zinc-600 text-sm font-normal">Minecraft</span></h1>
            <p className="text-zinc-500 text-xs mt-0.5">{customer?.email}</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/minecraft" className="text-zinc-500 hover:text-zinc-300 text-xs">Back</Link>
            <Link href="/customer" className="text-zinc-500 hover:text-zinc-300 text-xs">FiveM Dashboard</Link>
            <button onClick={logout} className="text-zinc-500 hover:text-white text-xs border border-white/10 rounded-full px-3 py-1.5 transition hover:border-white/30">
              Logout
            </button>
          </div>
        </div>

        {/* Download & License Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {/* Download Card */}
          <div className="rounded-2xl border border-emerald-500/20 bg-white/5 backdrop-blur-sm p-6">
            <h2 className="text-sm font-semibold text-zinc-300 mb-4">Download Plugin</h2>
            <button 
              onClick={handleDownload}
              disabled={downloading}
              className="w-full flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition-all hover:shadow-emerald-500/50 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {downloading ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  Downloading...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  Download FTWSentinel.jar
                </>
              )}
            </button>
            <p className="text-zinc-600 text-xs text-center mt-3">
              Compatible with Paper, Spigot, Purpur, Folia
            </p>
          </div>

          {/* License Card */}
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6">
            <h2 className="text-sm font-semibold text-zinc-300 mb-4">License Key</h2>
            {license ? (
              <>
                <div className="flex items-center gap-2 bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 mb-3">
                  <code className="text-emerald-300 font-mono text-xs flex-1 break-all">{license.key}</code>
                  <button onClick={copyKey} className="text-zinc-500 hover:text-white text-xs shrink-0 transition">
                    {copied ? '✓' : '📋'}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-zinc-500">Status:</span>
                    <span className={`ml-2 font-semibold ${license.is_active ? 'text-emerald-400' : 'text-red-400'}`}>
                      {license.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-zinc-500">Server:</span>
                    <span className="ml-2 font-semibold text-white">{license.server_name || 'Not connected'}</span>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-zinc-500 text-sm">Click download to generate your license key</p>
            )}
          </div>
        </div>

        {/* Statistics Grid */}
        {stats ? (
          <>
            {/* Overview Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5">
                <p className="text-zinc-500 text-xs mb-1">Total Checks</p>
                <p className="text-white text-2xl font-bold">{stats.total_checks.toLocaleString()}</p>
              </div>
              <div className="rounded-2xl border border-red-500/20 bg-red-500/5 backdrop-blur-sm p-5">
                <p className="text-zinc-500 text-xs mb-1">Violations</p>
                <p className="text-red-400 text-2xl font-bold">{stats.total_violations.toLocaleString()}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5">
                <p className="text-zinc-500 text-xs mb-1">Players</p>
                <p className="text-white text-2xl font-bold">{stats.players_monitored}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5">
                <p className="text-zinc-500 text-xs mb-1">Server TPS</p>
                <p className={`text-2xl font-bold ${stats.server_tps >= 19.5 ? 'text-emerald-400' : stats.server_tps >= 18 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {stats.server_tps.toFixed(1)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
              <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5">
                <p className="text-zinc-500 text-xs mb-1">Checks/Second</p>
                <p className="text-cyan-400 text-xl font-bold">{stats.checks_per_second.toFixed(1)}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5">
                <p className="text-zinc-500 text-xs mb-1">Uptime</p>
                <p className="text-white text-xl font-bold">{formatUptime(stats.uptime_seconds)}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5">
                <p className="text-zinc-500 text-xs mb-1">Actions</p>
                <p className="text-white text-xl font-bold">{stats.total_bans} bans · {stats.total_kicks} kicks</p>
              </div>
            </div>

            {/* Top Violations */}
            {topViolations.length > 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 mb-6">
                <h2 className="text-sm font-semibold text-zinc-300 mb-4">Top Violations</h2>
                <div className="space-y-3">
                  {topViolations.map(([check, count]) => (
                    <div key={check} className="flex items-center justify-between">
                      <span className="text-sm text-zinc-300 capitalize">{check}</span>
                      <div className="flex items-center gap-3">
                        <div className="w-32 h-2 bg-black/30 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-red-500 to-orange-500 rounded-full"
                            style={{ width: `${Math.min((count / stats.total_violations) * 100, 100)}%` }}
                          />
                        </div>
                        <span className="text-sm font-semibold text-white w-12 text-right">{count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Players */}
            {players.length > 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6">
                <h2 className="text-sm font-semibold text-zinc-300 mb-4">Recent Players</h2>
                <div className="space-y-2">
                  {players.slice(0, 10).map((player) => (
                    <div key={player.name} className="flex items-center justify-between text-sm bg-black/20 rounded-lg px-4 py-2">
                      <span className="text-white font-medium">{player.name}</span>
                      <div className="flex items-center gap-4">
                        <span className="text-zinc-500">{player.violations} violations</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${player.banned ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                          {player.banned ? 'Banned' : 'Active'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-12 text-center">
            <svg className="w-16 h-16 mx-auto mb-4 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            <h3 className="text-white font-semibold mb-2">No Statistics Yet</h3>
            <p className="text-zinc-500 text-sm mb-4">Download and install the plugin on your server to start collecting data</p>
            <p className="text-zinc-600 text-xs">Statistics update automatically every 60 seconds</p>
          </div>
        )}

      </div>
    </div>
  );
}
