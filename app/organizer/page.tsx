'use client';

import { useEffect, useState } from 'react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import Navbar from '@/components/shared/Navbar';
import type { Store } from '@/types';

export default function OrganizerDashboard() {
  const [stores, setStores] = useState<Store[]>([]);
  const [storeName, setStoreName] = useState('');
  const [storeForInvite, setStoreForInvite] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [codeStatus, setCodeStatus] = useState<string | null>(null);
  const [countdown, setCountdown] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [renameStoreId, setRenameStoreId] = useState('');
  const [renameStoreName, setRenameStoreName] = useState('');

  // Pastel colors for store cards
  const pastelColors = [
    'bg-[#D4F5E9]',
    'bg-[#FFE4E6]',
    'bg-[#E0F2FE]',
    'bg-[#FEF9C3]',
    'bg-[#EDE9FE]',
  ];

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!expiresAt) return;
    const interval = setInterval(() => {
      const seconds = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      const minutes = Math.floor(seconds / 60);
      const remainder = seconds % 60;
      setCountdown(`${minutes}m ${remainder.toString().padStart(2, '0')}s`);
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  useEffect(() => {
    if (expiresAt && expiresAt < Date.now()) {
      setCodeStatus('expired');
    }
  }, [expiresAt]);

  const loadData = async () => {
    setLoading(true);
    await fetchStores();
    setLoading(false);
  };

  const fetchStores = async () => {
    try {
      const res = await fetch('/api/stores');
      if (res.ok) {
        const data = await res.json();
        setStores(data.stores || []);
        if (!storeForInvite && data.stores?.[0]) {
          setStoreForInvite(data.stores[0].id);
          fetchJoinCode(data.stores[0].id, true);
        }
        if (!renameStoreId && data.stores?.[0]) {
          setRenameStoreId(data.stores[0].id);
          setRenameStoreName(data.stores[0].name);
        }
      } else {
        setMessage('Failed to load stores');
      }
    } catch (err) {
      console.error(err);
      setMessage('Failed to load stores');
    }
  };

  const fetchJoinCode = async (storeId: string, autoCreate = false) => {
    try {
      const res = await fetch(`/api/stores/join-code?storeId=${storeId}&role=admin`);
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || 'Failed to load join code');
      }
      if (!body.code && autoCreate) {
        await renewJoinCode();
        return;
      }
      setJoinCode(body.code || '');
      setExpiresAt(body.expiresAt ? new Date(body.expiresAt).getTime() : null);
      setCodeStatus(body.status || null);
    } catch (err) {
      console.error(err);
      setMessage(err instanceof Error ? err.message : 'Failed to load join code');
    }
  };

  const renewJoinCode = async () => {
    if (!storeForInvite) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch('/api/stores/join-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId: storeForInvite, role: 'admin' }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || 'Failed to create code');
      }
      setJoinCode(body.code);
      setExpiresAt(body.expiresAt ? new Date(body.expiresAt).getTime() : null);
      setCodeStatus(body.status);
      setMessage('New admin join code created.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to create code');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeName.trim()) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch('/api/stores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: storeName.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create store');
      }
      const { store } = await res.json();
      setStores([store, ...stores]);
      setStoreName('');
      setStoreForInvite(prev => prev || store.id);
      fetchJoinCode(store.id, true);
      setMessage('Store created.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to create store');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRenameStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameStoreId || !renameStoreName.trim()) {
      setMessage('Select a store and enter a new name.');
      return;
    }
    setRenaming(true);
    setMessage(null);
    try {
      const res = await fetch('/api/stores', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: renameStoreId, name: renameStoreName.trim() }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || 'Failed to rename store');
      }
      const { store } = body;
      setStores(stores.map((s) => (s.id === store.id ? store : s)));
      setMessage('Store name updated.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to rename store');
    } finally {
      setRenaming(false);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute requiredRole={['admin', 'organizer']}>
        <div className="min-h-screen bg-[#f8fafc]">
          <Navbar />
          <main className="max-w-6xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-200 border-t-[#3478F6] mx-auto"></div>
              <p className="mt-4 text-slate-400">Loading organizer tools...</p>
            </div>
          </main>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredRole={['admin', 'organizer']}>
      <div className="min-h-screen bg-[#f8fafc]">
        {/* Background decoration */}
        <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-[#EDE9FE] rounded-full blur-3xl opacity-40" />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-[#D4F5E9] rounded-full blur-3xl opacity-40" />
        </div>

        <Navbar />
        <main className="relative z-10 max-w-6xl mx-auto py-12 px-4 sm:px-6 lg:px-8 space-y-8">
          <div>
            <h1 className="text-3xl font-black text-slate-900">Organizer Console</h1>
            <p className="mt-2 text-slate-400">Create stores, rename them, and share one-time admin codes.</p>
          </div>

          {message && (
            <div className={`p-4 rounded-2xl font-medium animate-fade-in ${message.includes('created') || message.includes('updated') ? 'bg-[#D4F5E9] text-emerald-700' : 'bg-[#FFE4E6] text-rose-600'}`}>
              {message}
            </div>
          )}

          <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Create & Rename Store */}
            <div className="bg-white rounded-3xl shadow-xl shadow-slate-100 border border-slate-100 p-6">
              <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                <span className="w-8 h-8 bg-[#D4F5E9] rounded-lg flex items-center justify-center text-sm">🏪</span>
                Create a Store
              </h2>
              <form onSubmit={handleCreateStore} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Store name</label>
                  <input
                    type="text"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-slate-900 font-medium placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#3478F6]/30 focus:bg-white transition-all"
                    placeholder="e.g. Main Street"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 bg-[#3478F6] text-white font-bold rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create store'}
                </button>
              </form>

              <div className="mt-8 border-t border-slate-100 pt-6">
                <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 bg-[#FEF9C3] rounded-md flex items-center justify-center text-xs">✏️</span>
                  Rename a Store
                </h3>
                <form onSubmit={handleRenameStore} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Select store</label>
                    <select
                      value={renameStoreId}
                      onChange={(e) => {
                        setRenameStoreId(e.target.value);
                        const match = stores.find((s) => s.id === e.target.value);
                        if (match) setRenameStoreName(match.name);
                      }}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#3478F6]/30 transition-all"
                    >
                      <option value="">Choose a store</option>
                      {stores.map((store) => (
                        <option key={store.id} value={store.id}>
                          {store.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">New name</label>
                    <input
                      type="text"
                      value={renameStoreName}
                      onChange={(e) => setRenameStoreName(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-slate-900 font-medium placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#3478F6]/30 focus:bg-white transition-all"
                      placeholder="Enter new store name"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={renaming}
                    className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl shadow-lg shadow-slate-900/15 hover:shadow-slate-900/25 transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    {renaming ? 'Renaming...' : 'Rename store'}
                  </button>
                </form>
              </div>
            </div>

            {/* Admin Join Code */}
            <div className="bg-white rounded-3xl shadow-xl shadow-slate-100 border border-slate-100 p-6">
              <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                <span className="w-8 h-8 bg-[#EDE9FE] rounded-lg flex items-center justify-center text-sm">🔑</span>
                Admin Join Code
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Store</label>
                  <select
                    value={storeForInvite}
                    onChange={(e) => {
                      setStoreForInvite(e.target.value);
                      if (e.target.value) fetchJoinCode(e.target.value, true);
                    }}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#3478F6]/30 transition-all"
                  >
                    <option value="">Select a store</option>
                    {stores.map((store) => (
                      <option key={store.id} value={store.id}>
                        {store.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="bg-[#E0F2FE] rounded-2xl p-5 border-2 border-dashed border-sky-200">
                  <p className="text-xs text-sky-600 uppercase font-bold mb-2">Single-use code (10 minutes)</p>
                  <div className="flex items-center justify-between">
                    <span className="text-3xl font-mono font-black text-slate-900 tracking-[0.3em]">
                      {submitting ? '••••••' : joinCode || '------'}
                    </span>
                    <button
                      type="button"
                      onClick={renewJoinCode}
                      className="text-sm text-[#3478F6] hover:text-blue-700 font-semibold disabled:opacity-50"
                      disabled={!storeForInvite || submitting}
                    >
                      Renew
                    </button>
                  </div>
                  <div className="mt-3 text-sm text-slate-600 flex items-center justify-between">
                    <span>Expires in <strong>{expiresAt ? countdown : '—'}</strong></span>
                    {expiresAt && <span className="text-slate-400 text-xs">{new Date(expiresAt).toLocaleTimeString()}</span>}
                  </div>
                  {codeStatus === 'used' && (
                    <p className="text-xs text-rose-500 mt-2 font-medium">This code was used. Renew to invite another person.</p>
                  )}
                  {codeStatus === 'expired' && (
                    <p className="text-xs text-rose-500 mt-2 font-medium">This code expired. Renew to get a fresh one.</p>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (!joinCode) return;
                      navigator.clipboard?.writeText(joinCode);
                      setMessage('Code copied');
                    }}
                    disabled={!joinCode}
                    className="flex-1 py-3 bg-[#3478F6] text-white font-bold rounded-xl shadow-lg shadow-blue-500/25 disabled:opacity-50 transition-all active:scale-[0.98]"
                  >
                    Copy code
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!storeForInvite) return;
                      navigator.clipboard?.writeText(storeForInvite);
                      setMessage('Store ID copied');
                    }}
                    disabled={!storeForInvite}
                    className="flex-1 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 disabled:opacity-50 transition-all active:scale-[0.98]"
                  >
                    Copy store ID
                  </button>
                </div>
                <p className="text-xs text-slate-400">
                  Share this code and store ID with the admin you want to onboard. Each code can be used once.
                </p>
              </div>
            </div>
          </section>

          {/* Store List */}
          <section className="bg-white rounded-3xl shadow-xl shadow-slate-100 border border-slate-100 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <span className="w-8 h-8 bg-[#FFE4E6] rounded-lg flex items-center justify-center text-sm">🏬</span>
                Your Stores
              </h2>
              <span className="text-sm text-slate-400 bg-slate-50 px-3 py-1 rounded-full">{stores.length} total</span>
            </div>
            {stores.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-8">No stores yet. Create one to get started.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {stores.map((store, index) => (
                  <div key={store.id} className={`${pastelColors[index % pastelColors.length]} rounded-2xl p-5 transition-all hover:shadow-lg`}>
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-slate-900 text-lg">{store.name}</h3>
                      <span className="text-xs text-slate-500 bg-white/60 px-2 py-1 rounded-full">
                        {new Date(store.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-2 break-all font-mono">{store.id}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

        </main>
      </div>
    </ProtectedRoute>
  );
}
