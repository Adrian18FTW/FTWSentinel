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

export default function AdminPage() {
  const [secret, setSecret] = useState('');
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState<'licenses' | 'plans' | 'customers'>('licenses');
  const [licenses, setLicenses] = useState<License[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [planAvailability, setPlanAvailability] = useState<Record<string, boolean>>({
    '1month': true, '3month': true, '6month': true,
  });
  const [error, setError] = useState('');
  const [newPlan, setNewPlan] = useState('1month');
  const [newNote, setNewNote] = useState('');
  const [newKey, setNewKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'expired' | 'revoked'>('all');

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

  const customerAction = async (id: number, action: 'suspend' | 'unsuspend' | 'delete') => {
    await fetch('/api/admin/customers', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
      body: JSON.stringify({ id, action }),
    });
    fetchCustomers(secret);
    fetchLicenses(secret);
  };
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
    if (authed) { fetchLicenses(secret); fetchPlans(); fetchCustomers(secret); }
  }, [authed, fetchLicenses, fetchPlans, fetchCustomers, secret]);

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
              {(['licenses', 'plans', 'customers'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition ${
                    tab === t ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}
                >
                  {t === 'licenses' ? 'Licenses' : t === 'plans' ? 'Plans' : 'Customers'}
                </button>
              ))}
            </div>
            <button onClick={() => setAuthed(false)} className="text-gray-400 hover:text-white text-sm">Logout</button>
          </div>
        </div>

        {tab === 'customers' ? (
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
        ) : tab === 'plans' ? (
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
        ) : (
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
      </div>
    </div>
  );
}
