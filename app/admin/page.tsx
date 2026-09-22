'use client';

import { useState, useEffect, useCallback } from 'react';

interface License {
  id: number;
  key: string;
  ip: string;
  ip_locked: boolean;
  plan: string;
  expires_at: string;
  active: boolean;
  note: string;
  created_at: string;
  last_seen: string | null;
}

interface Customer {
  id: number;
  email: string;
  license_key: string | null;
  suspended: boolean;
  created_at: string;
}

const PLAN_LABELS: Record<string, string> = {
  '1month': '1 Month',
  '3month': '3 Months',
  '6month': '6 Months',
};

interface ProductError {
  id: string;
  error: string;
  stackTrace: string;
  timestamp: number;
  resourceName: string;
  serverIp: string;
  file: string;
  receivedAt: number;
}

interface ErrorStats {
  totalErrors: number;
  serverCount: number;
  fileBreakdown: Record<string, number>;
  serverBreakdown: Record<string, number>;
}

export default function AdminPage() {
  const [secret, setSecret] = useState('');
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState<'licenses' | 'plans' | 'customers' | 'errors' | 'downloads'>('licenses');
  const [licenses, setLicenses] = useState<License[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [productErrors, setProductErrors] = useState<ProductError[]>([]);
  const [errorStats, setErrorStats] = useState<ErrorStats | null>(null);
  const [planAvailability, setPlanAvailability] = useState<Record<string, boolean>>({
    '1month': true, '3month': true, '6month': true,
  });
  const [error, setError] = useState('');
  const [newPlan, setNewPlan] = useState('1month');
  const [newNote, setNewNote] = useState('');
  const [newKey, setNewKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'expired' | 'revoked'>('all');
  const [errorFilter, setErrorFilter] = useState('');
  const [selectedServer, setSelectedServer] = useState<string>('all');
  const [expandedError, setExpandedError] = useState<string | null>(null);

  const fetchLicenses = useCallback(async (s: string) => {
    const res = await fetch('/api/licenses', { headers: { 'x-admin-secret': s } });
    if (res.status === 401) { setError('Wrong secret'); setAuthed(false); return; }
    const data = await res.json();
    setLicenses(data);
    setAuthed(true);
    setError('');
  }, []);

  const fetchCustomers = useCallback(async (s: string) => {
    const res = await fetch('/api/admin/customers', { headers: { 'x-admin-secret': s } });
    if (res.ok) setCustomers(await res.json());
  }, []);

  const fetchErrors = useCallback(async (s: string) => {
    const res = await fetch('/api/errors/list', { headers: { 'x-admin-secret': s } });
    if (res.ok) {
      const data = await res.json();
      setProductErrors(data.errors || []);
      setErrorStats(data.stats || null);
    }
  }, []);

  const clearErrors = async () => {
    if (!confirm('Clear all product errors? This action cannot be undone.')) return;
    const res = await fetch('/api/errors/clear', {
      method: 'POST',
      headers: { 'x-admin-secret': secret },
    });
    if (res.ok) {
      setProductErrors([]);
      setErrorStats(null);
      alert('All errors cleared successfully');
    }
  };

  const customerAction = async (id: number, action: 'suspend' | 'unsuspend' | 'delete') => {
    await fetch('/api/admin/customers', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
      body: JSON.stringify({ id, action }),
    });
    fetchCustomers(secret);
    fetchLicenses(secret);
  };

  const fetchPlans = useCallback(async () => {
    const res = await fetch('/api/plans');
    if (res.ok) setPlanAvailability(await res.json());
  }, []);

  const togglePlan = async (plan: string, available: boolean) => {
    const res = await fetch('/api/plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
      body: JSON.stringify({ plan, available }),
    });
    if (res.ok) setPlanAvailability(await res.json());
  };

  useEffect(() => {
    if (authed) { fetchLicenses(secret); fetchPlans(); fetchCustomers(secret); fetchErrors(secret); }
  }, [authed, fetchLicenses, fetchPlans, fetchCustomers, fetchErrors, secret]);

  async function issue() {
    setLoading(true);
    setNewKey('');
    const res = await fetch('/api/issue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
      body: JSON.stringify({ plan: newPlan, note: newNote }),
    });
    const data = await res.json();
    if (data.key) { setNewKey(data.key); fetchLicenses(secret); }
    setLoading(false);
  }

  async function action(id: number, act: 'revoke' | 'delete' | 'reset-ip') {
    if (act === 'reset-ip') {
      await fetch('/api/reset-ip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
        body: JSON.stringify({ id }),
      });
    } else {
      await fetch('/api/licenses', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
        body: JSON.stringify({ id, action: act }),
      });
    }
    fetchLicenses(secret);
  }

  const now = new Date();
  const filtered = licenses.filter(l => {
    if (filter === 'active') return l.active && new Date(l.expires_at) > now;
    if (filter === 'expired') return new Date(l.expires_at) <= now;
    if (filter === 'revoked') return !l.active;
    return true;
  });

  const stats = {
    total: licenses.length,
    active: licenses.filter(l => l.active && new Date(l.expires_at) > now).length,
    expired: licenses.filter(l => new Date(l.expires_at) <= now).length,
    revoked: licenses.filter(l => !l.active).length,
  };

  if (!authed) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 w-full max-w-sm">
          <h1 className="text-white text-2xl font-bold mb-2">FTWSentinel</h1>
          <p className="text-gray-400 text-sm mb-6">License Management</p>
          <input
            type="password"
            placeholder="Admin secret"
            value={secret}
            onChange={e => setSecret(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetchLicenses(secret)}
            className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2 mb-3 focus:outline-none focus:border-blue-500"
          />
          {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
          <button
            onClick={() => fetchLicenses(secret)}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-2 font-medium transition"
          >
            Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">FTWSentinel</h1>
            <p className="text-gray-400 text-sm">License Management Dashboard</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex gap-2">
              {(['licenses', 'plans', 'customers', 'errors', 'downloads'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition ${
                    tab === t ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}
                >
                  {t === 'licenses' ? 'Licenses' : t === 'plans' ? 'Plans' : t === 'customers' ? 'Customers' : 'Global Product Errors'}
                  {t === 'errors' && errorStats && errorStats.totalErrors > 0 && (
                    <span className="ml-2 px-1.5 py-0.5 rounded-full bg-red-500 text-white text-xs font-bold">
                      {errorStats.totalErrors}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <button onClick={() => setAuthed(false)} className="text-gray-400 hover:text-white text-sm">Logout</button>
          </div>
        </div>

        {/* Tab Content */}
        {tab === 'errors' && (
          /* Global Product Errors Tab */
          <div className="space-y-6">
            {/* Error Statistics */}
            {errorStats && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-red-900/40 to-red-800/20 border border-red-700/50 rounded-xl p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-red-300 text-xs uppercase tracking-wide font-medium">Total Errors</p>
                      <p className="text-4xl font-bold text-white mt-2">{errorStats.totalErrors}</p>
                    </div>
                    <div className="w-14 h-14 bg-red-500/20 rounded-full flex items-center justify-center">
                      <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-red-400/70 text-xs mt-3">Across all servers</p>
                </div>

                <div className="bg-gradient-to-br from-blue-900/40 to-blue-800/20 border border-blue-700/50 rounded-xl p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-300 text-xs uppercase tracking-wide font-medium">Active Servers</p>
                      <p className="text-4xl font-bold text-white mt-2">{errorStats.serverCount}</p>
                    </div>
                    <div className="w-14 h-14 bg-blue-500/20 rounded-full flex items-center justify-center">
                      <svg className="w-7 h-7 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-blue-400/70 text-xs mt-3">Reporting errors</p>
                </div>

                <div className="bg-gradient-to-br from-yellow-900/40 to-yellow-800/20 border border-yellow-700/50 rounded-xl p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-yellow-300 text-xs uppercase tracking-wide font-medium">Most Troublesome</p>
                      <p className="text-xl font-bold text-white mt-2 truncate">
                        {Object.keys(errorStats.fileBreakdown)[0] || 'N/A'}
                      </p>
                    </div>
                    <div className="w-14 h-14 bg-yellow-500/20 rounded-full flex items-center justify-center">
                      <svg className="w-7 h-7 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-yellow-400/70 text-xs mt-3">
                    {Object.values(errorStats.fileBreakdown)[0] || 0} errors
                  </p>
                </div>
              </div>
            )}

            {/* File Breakdown Chart */}
            {errorStats && Object.keys(errorStats.fileBreakdown).length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Error Distribution by File</h3>
                <div className="space-y-3">
                  {Object.entries(errorStats.fileBreakdown).slice(0, 5).map(([file, count]) => {
                    const percentage = (count / errorStats.totalErrors) * 100;
                    return (
                      <div key={file}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm text-gray-300 font-mono">{file}</span>
                          <span className="text-sm text-gray-400">{count} errors ({percentage.toFixed(1)}%)</span>
                        </div>
                        <div className="w-full bg-gray-800 rounded-full h-2.5 overflow-hidden">
                          <div 
                            className="bg-gradient-to-r from-red-500 to-orange-500 h-2.5 rounded-full transition-all duration-500"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Filters and Controls */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  placeholder="Search errors, files, or messages..."
                  value={errorFilter}
                  onChange={e => setErrorFilter(e.target.value)}
                  className="flex-1 min-w-64 bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500"
                />
                <select
                  value={selectedServer}
                  onChange={e => setSelectedServer(e.target.value)}
                  className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="all">All Servers</option>
                  {errorStats && Object.keys(errorStats.serverBreakdown).map(ip => (
                    <option key={ip} value={ip}>{ip} ({errorStats.serverBreakdown[ip]})</option>
                  ))}
                </select>
                <button
                  onClick={() => fetchErrors(secret)}
                  className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition"
                >
                  Refresh
                </button>
                <button
                  onClick={clearErrors}
                  className="bg-red-600 hover:bg-red-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition"
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Errors List */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-gray-800">
                <h2 className="text-lg font-semibold text-white">Error Log</h2>
                <p className="text-gray-400 text-xs mt-0.5">
                  {(() => {
                    const filtered = productErrors.filter(err => {
                      const matchesSearch = !errorFilter || 
                        err.error.toLowerCase().includes(errorFilter.toLowerCase()) ||
                        err.file.toLowerCase().includes(errorFilter.toLowerCase()) ||
                        err.stackTrace.toLowerCase().includes(errorFilter.toLowerCase());
                      const matchesServer = selectedServer === 'all' || err.serverIp === selectedServer;
                      return matchesSearch && matchesServer;
                    });
                    return `Showing ${filtered.length} of ${productErrors.length} errors`;
                  })()}
                </p>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {productErrors.length === 0 ? (
                  <div className="p-12 text-center">
                    <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-gray-400 font-medium">No errors reported yet</p>
                    <p className="text-gray-500 text-sm mt-1">Errors from all servers running FTWSentinel will appear here</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-800">
                    {productErrors
                      .filter(err => {
                        const matchesSearch = !errorFilter || 
                          err.error.toLowerCase().includes(errorFilter.toLowerCase()) ||
                          err.file.toLowerCase().includes(errorFilter.toLowerCase()) ||
                          err.stackTrace.toLowerCase().includes(errorFilter.toLowerCase());
                        const matchesServer = selectedServer === 'all' || err.serverIp === selectedServer;
                        return matchesSearch && matchesServer;
                      })
                      .map(err => (
                        <div key={err.id} className="p-4 hover:bg-gray-800/50 transition">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3 mb-2">
                                <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-red-900/30 border border-red-700/50 text-red-300 text-xs font-medium">
                                  <svg className="w-3 h-3 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                  </svg>
                                  ERROR
                                </span>
                                <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-gray-800 border border-gray-700 text-gray-300 text-xs font-mono">
                                  {err.serverIp}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {new Date(err.timestamp * 1000).toLocaleString()}
                                </span>
                              </div>
                              <p className="text-white font-medium text-sm mb-1 break-words">{err.error}</p>
                              <div className="flex items-center gap-2 text-xs text-gray-400">
                                <span className="font-mono">{err.file}</span>
                                <span>•</span>
                                <span>{err.resourceName}</span>
                              </div>
                            </div>
                            <button
                              onClick={() => setExpandedError(expandedError === err.id ? null : err.id)}
                              className="text-gray-400 hover:text-white transition text-xs font-medium whitespace-nowrap"
                            >
                              {expandedError === err.id ? 'Hide Stack' : 'Show Stack'}
                            </button>
                          </div>
                          {expandedError === err.id && (
                            <div className="mt-3 bg-gray-950 border border-gray-800 rounded-lg p-3 overflow-x-auto">
                              <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap">{err.stackTrace}</pre>
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === 'customers' && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-gray-800">
              <h2 className="text-lg font-semibold">Customers</h2>
              <p className="text-gray-400 text-xs mt-0.5">Registered customer accounts. Suspending also revokes their linked license.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 text-xs uppercase border-b border-gray-800">
                    <th className="text-left px-4 py-3">Email</th>
                    <th className="text-left px-4 py-3">License Key</th>
                    <th className="text-left px-4 py-3">Registered</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-left px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map(c => (
                    <tr key={c.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                      <td className="px-4 py-3 text-white text-xs">{c.email}</td>
                      <td className="px-4 py-3 font-mono text-xs text-blue-300">{c.license_key ?? <span className="text-gray-500">—</span>}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{new Date(c.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${c.suspended ? 'bg-red-900 text-red-300' : 'bg-green-900 text-green-300'}`}>
                          {c.suspended ? 'suspended' : 'active'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          {c.suspended ? (
                            <button onClick={() => customerAction(c.id, 'unsuspend')} className="text-green-400 hover:text-green-300 text-xs">Unsuspend</button>
                          ) : (
                            <button onClick={() => { if (confirm('Suspend this account and revoke their license?')) customerAction(c.id, 'suspend'); }} className="text-yellow-400 hover:text-yellow-300 text-xs">Suspend</button>
                          )}
                          <button onClick={() => { if (confirm('Delete this account permanently?')) customerAction(c.id, 'delete'); }} className="text-red-400 hover:text-red-300 text-xs">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {customers.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No customers found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'plans' && (
          /* Plans availability tab */
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-1">Plan Availability</h2>
            <p className="text-gray-400 text-sm mb-6">Toggle whether the Purchase button is active on the public page.</p>
            <div className="flex flex-col gap-4">
              {Object.keys(PLAN_LABELS).map(plan => {
                const available = planAvailability[plan] ?? true;
                return (
                  <div key={plan} className="flex items-center justify-between bg-gray-800 rounded-xl px-5 py-4">
                    <div>
                      <p className="font-medium text-white">{PLAN_LABELS[plan]}</p>
                      <p className={`text-xs mt-0.5 ${available ? 'text-green-400' : 'text-red-400'}`}>
                        {available ? 'Purchase button active' : 'Purchase button disabled'}
                      </p>
                    </div>
                    <button
                      onClick={() => togglePlan(plan, !available)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none ${
                        available ? 'bg-green-500' : 'bg-gray-600'
                      }`}
                      aria-label={`Toggle ${PLAN_LABELS[plan]}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
                          available ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === 'licenses' && (
          <>
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total', value: stats.total, color: 'text-white' },
            { label: 'Active', value: stats.active, color: 'text-green-400' },
            { label: 'Expired', value: stats.expired, color: 'text-yellow-400' },
            { label: 'Revoked', value: stats.revoked, color: 'text-red-400' },
          ].map(s => (
            <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <p className="text-gray-400 text-xs uppercase tracking-wide">{s.label}</p>
              <p className={`text-3xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Issue new license */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">Issue New License</h2>
          <div className="flex gap-3 flex-wrap">
            <select
              value={newPlan}
              onChange={e => setNewPlan(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
            >
              <option value="1month">1 Month</option>
              <option value="3month">3 Months</option>
              <option value="6month">6 Months</option>
            </select>
            <input
              type="text"
              placeholder="Note (customer name, order ID...)"
              value={newNote}
              onChange={e => setNewNote(e.target.value)}
              className="flex-1 min-w-48 bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={issue}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg px-6 py-2 font-medium transition"
            >
              {loading ? 'Generating...' : 'Generate Key'}
            </button>
          </div>
          {newKey && (
            <div className="mt-4 bg-gray-800 border border-green-700 rounded-lg p-3 flex items-center justify-between">
              <code className="text-green-400 font-mono text-sm">{newKey}</code>
              <button
                onClick={() => navigator.clipboard.writeText(newKey)}
                className="text-gray-400 hover:text-white text-xs ml-4"
              >
                Copy
              </button>
            </div>
          )}
        </div>

        {/* License list */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-gray-800">
            <h2 className="text-lg font-semibold">Licenses</h2>
            <div className="flex gap-2">
              {(['all', 'active', 'expired', 'revoked'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition ${
                    filter === f ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-xs uppercase border-b border-gray-800">
                  <th className="text-left px-4 py-3">Key</th>
                  <th className="text-left px-4 py-3">Plan</th>
                  <th className="text-left px-4 py-3">Bound IP</th>
                  <th className="text-left px-4 py-3">Expires</th>
                  <th className="text-left px-4 py-3">Last Seen</th>
                  <th className="text-left px-4 py-3">Note</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(l => {
                  const expired = new Date(l.expires_at) <= now;
                  const status = !l.active ? 'revoked' : expired ? 'expired' : 'active';
                  return (
                    <tr key={l.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                      <td className="px-4 py-3 font-mono text-xs text-blue-300">{l.key}</td>
                      <td className="px-4 py-3 text-gray-300">{l.plan}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-300">
                        {l.ip_locked ? l.ip : <span className="text-gray-500">unbound</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-300 text-xs">
                        {new Date(l.expires_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {l.last_seen ? new Date(l.last_seen).toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs max-w-32 truncate">{l.note || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          status === 'active' ? 'bg-green-900 text-green-300' :
                          status === 'expired' ? 'bg-yellow-900 text-yellow-300' :
                          'bg-red-900 text-red-300'
                        }`}>
                          {status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          {l.active && (
                            <button
                              onClick={() => action(l.id, 'revoke')}
                              className="text-yellow-400 hover:text-yellow-300 text-xs"
                            >
                              Revoke
                            </button>
                          )}
                          {l.ip_locked && (
                            <button
                              onClick={() => { if (confirm('Reset bound IP? The next server startup will rebind.')) action(l.id, 'reset-ip'); }}
                              className="text-blue-400 hover:text-blue-300 text-xs"
                            >
                              Reset IP
                            </button>
                          )}
                          <button
                            onClick={() => { if (confirm('Delete permanently?')) action(l.id, 'delete'); }}
                            className="text-red-400 hover:text-red-300 text-xs"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500">No licenses found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        </>
        )}

        {tab === 'downloads' && (
          /* Admin Downloads Tab - Obfuscated Builds */
          <div className="space-y-6">
            {/* Warning Banner */}
            <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div className="flex-1">
                  <h3 className="text-yellow-300 font-semibold text-sm">Development Testing Mode</h3>
                  <p className="text-yellow-200/80 text-xs mt-1">
                    This feature is currently admin-only for testing. Each download generates a uniquely obfuscated build 
                    locked to your fingerprint (IP, user-agent, email, timestamp).
                  </p>
                </div>
              </div>
            </div>

            {/* Download Card */}
            <div className="bg-gradient-to-br from-blue-900/40 to-blue-800/20 border border-blue-700/50 rounded-xl p-6">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-white">FTWSentinel</h2>
                  <p className="text-blue-300 text-sm mt-1">Obfuscated Anti-Cheat Resource</p>
                  <p className="text-blue-400/70 text-xs mt-2">Version 1.0.0 • Customer-Specific Build</p>
                </div>
                <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center">
                  <svg className="w-9 h-9 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
              </div>

              <div className="bg-blue-950/50 rounded-lg p-4 mb-6 space-y-2 text-sm">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-blue-200">Unique obfuscation key per download</span>
                </div>
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-blue-200">Hardware-locked to your identity</span>
                </div>
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-blue-200">Runtime key validation on every start</span>
                </div>
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-blue-200">All 44 modules fully obfuscated</span>
                </div>
              </div>

              <button
                onClick={async () => {
                  if (!confirm('Generate and download a uniquely obfuscated build? This will be locked to your current IP and user-agent.')) return;
                  
                  const btn = document.getElementById('download-btn') as HTMLButtonElement;
                  if (btn) {
                    btn.disabled = true;
                    btn.textContent = 'Generating Build...';
                  }
                  
                  try {
                    const res = await fetch('/api/admin/downloads/generate', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'x-admin-secret': secret
                      }
                    });
                    
                    if (!res.ok) {
                      const error = await res.json();
                      alert(`Error: ${error.error || 'Failed to generate build'}`);
                      return;
                    }
                    
                    // Download the file
                    const blob = await res.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'FTWSentinel-Admin.zip';
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                    
                    alert('Build downloaded successfully! Deploy to your FiveM server and start the resource.');
                  } catch (err) {
                    console.error(err);
                    alert('Failed to download build. Check console for details.');
                  } finally {
                    if (btn) {
                      btn.disabled = false;
                      btn.textContent = 'Download Obfuscated Build';
                    }
                  }
                }}
                id="download-btn"
                className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white rounded-lg px-6 py-3.5 font-semibold text-base transition-all duration-200 shadow-lg hover:shadow-blue-500/50 flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download Obfuscated Build
              </button>

              <p className="text-blue-300/60 text-xs text-center mt-4">
                Build will be generated on-the-fly and locked to your current session
              </p>
            </div>

            {/* Technical Info */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">How It Works</h3>
              <div className="space-y-4 text-sm text-gray-300">
                <div>
                  <h4 className="text-white font-medium mb-1">1. Download-Time</h4>
                  <p className="text-gray-400">
                    When you click download, your IP, user-agent, email, and timestamp are captured and used to generate 
                    a unique SHA-256 obfuscation key. The resource is obfuscated using this key and stored with your fingerprint.
                  </p>
                </div>
                <div>
                  <h4 className="text-white font-medium mb-1">2. Runtime Validation</h4>
                  <p className="text-gray-400">
                    When FTWSentinel starts on your server, it requests the deobfuscation key from the backend by providing 
                    your license key and server IP. The backend validates the license and returns the key with a 1-hour TTL.
                  </p>
                </div>
                <div>
                  <h4 className="text-white font-medium mb-1">3. Decryption</h4>
                  <p className="text-gray-400">
                    The resource uses the key to decrypt critical code sections at runtime. The key expires after 1 hour, 
                    forcing re-validation. This prevents unauthorized redistribution and allows real-time license revocation.
                  </p>
                </div>
              </div>
            </div>

            {/* Info Card */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Testing Checklist</h3>
              <div className="space-y-3">
                {[
                  'Download generates unique obfuscation key',
                  'Key is stored in downloads table with fingerprint',
                  'Obfuscator runs with --encryption-key argument',
                  'ZIP file contains obfuscated Lua files',
                  'Resource starts on FiveM server',
                  'Runtime validation endpoint returns key',
                  'Decryption succeeds with correct key',
                  'All detection modules function normally'
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-gray-500 text-xs">{i + 1}</span>
                    </div>
                    <span className="text-gray-300 text-sm">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
