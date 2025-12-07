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
      <div className="min-h-screen bg-gray-50">
        <Navbar />
          <main className="max-w-6xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading organizer tools...</p>
            </div>
          </main>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredRole={['admin', 'organizer']}>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="max-w-6xl mx-auto py-12 px-4 sm:px-6 lg:px-8 space-y-8">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900">Organizer Console</h1>
            <p className="mt-2 text-gray-600">Create stores, rename them, and share one-time admin codes.</p>
          </div>

          {message && (
            <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 shadow-sm">
              {message}
            </div>
          )}

          <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Create a Store</h2>
              <form onSubmit={handleCreateStore} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Store name</label>
                  <input
                    type="text"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    placeholder="e.g. Main Street"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-white font-semibold shadow-sm hover:bg-indigo-700 disabled:opacity-60"
                >
                  {submitting ? 'Creating...' : 'Create store'}
                </button>
              </form>
              <div className="mt-8 border-t border-gray-100 pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Rename a Store</h3>
                <form onSubmit={handleRenameStore} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Select store</label>
                    <select
                      value={renameStoreId}
                      onChange={(e) => {
                        setRenameStoreId(e.target.value);
                        const match = stores.find((s) => s.id === e.target.value);
                        if (match) setRenameStoreName(match.name);
                      }}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">New name</label>
                    <input
                      type="text"
                      value={renameStoreName}
                      onChange={(e) => setRenameStoreName(e.target.value)}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                      placeholder="Enter new store name"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={renaming}
                    className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-white font-semibold shadow-sm hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {renaming ? 'Renaming...' : 'Rename store'}
                  </button>
                </form>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Admin Join Code</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Store</label>
                  <select
                    value={storeForInvite}
                    onChange={(e) => {
                      setStoreForInvite(e.target.value);
                      if (e.target.value) fetchJoinCode(e.target.value, true);
                    }}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  >
                    <option value="">Select a store</option>
                    {stores.map((store) => (
                      <option key={store.id} value={store.id}>
                        {store.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-3">
                  <p className="text-xs text-gray-500 uppercase">Single-use code (10 minutes)</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-3xl font-mono font-semibold text-gray-900 tracking-[0.3em]">
                      {submitting ? '••••••' : joinCode || '------'}
                    </span>
                    <button
                      type="button"
                      onClick={renewJoinCode}
                      className="text-sm text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
                      disabled={!storeForInvite || submitting}
                    >
                      Renew code
                    </button>
                  </div>
                  <div className="mt-2 text-sm text-gray-600 flex items-center justify-between">
                    <span>Expires in {expiresAt ? countdown : '—'}</span>
                    {expiresAt && <span className="text-gray-500">{new Date(expiresAt).toLocaleTimeString()}</span>}
                  </div>
                  {codeStatus === 'used' && (
                    <p className="text-xs text-red-600 mt-1">This code was used. Renew to invite another person.</p>
                  )}
                  {codeStatus === 'expired' && (
                    <p className="text-xs text-red-600 mt-1">This code expired. Renew to get a fresh one.</p>
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
                    className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-3 py-2 text-white text-sm font-semibold shadow-sm hover:bg-indigo-700 disabled:opacity-50"
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
                    className="inline-flex items-center justify-center rounded-md bg-gray-200 px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-300 disabled:opacity-50"
                  >
                    Copy store ID
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  Share this code and store ID with the admin you want to onboard. Each code can be used once.
                </p>
              </div>
            </div>
          </section>

          <section className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Your Stores</h2>
              <span className="text-sm text-gray-500">{stores.length} total</span>
            </div>
            {stores.length === 0 ? (
              <p className="text-gray-500 text-sm">No stores yet. Create one to get started.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {stores.map((store) => (
                  <div key={store.id} className="border border-gray-100 rounded-lg p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-gray-900">{store.name}</h3>
                      <span className="text-xs text-gray-500">
                        {new Date(store.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-2 break-all">{store.id}</p>
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
