'use client';

import { useEffect, useState } from 'react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import Navbar from '@/components/shared/Navbar';
import type { Store, StoreAdminInvite } from '@/types';

export default function OrganizerDashboard() {
  const [stores, setStores] = useState<Store[]>([]);
  const [invites, setInvites] = useState<StoreAdminInvite[]>([]);
  const [storeName, setStoreName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [storeForInvite, setStoreForInvite] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([fetchStores(), fetchInvites()]);
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
        }
      } else {
        setMessage('Failed to load stores');
      }
    } catch (err) {
      console.error(err);
      setMessage('Failed to load stores');
    }
  };

  const fetchInvites = async () => {
    try {
      const res = await fetch('/api/stores/invite');
      if (res.ok) {
        const data = await res.json();
        setInvites(data.invites || []);
      }
    } catch (err) {
      console.error(err);
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
      setMessage('Store created.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to create store');
    } finally {
      setSubmitting(false);
    }
  };

  const handleInviteAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !storeForInvite) {
      setMessage('Select a store and enter an email.');
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch('/api/stores/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId: storeForInvite, email: inviteEmail.trim() }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || 'Failed to send invite');
      }
      if (body.invite) {
        setInvites([body.invite, ...invites]);
      }
      setInviteEmail('');
      setMessage(body.warning ? `Invite created, but email failed: ${body.warning}` : 'Invite sent.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to send invite');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute requiredRole="organizer">
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
    <ProtectedRoute requiredRole="organizer">
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="max-w-6xl mx-auto py-12 px-4 sm:px-6 lg:px-8 space-y-8">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900">Organizer Console</h1>
            <p className="mt-2 text-gray-600">Create stores and invite admins by email.</p>
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
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Invite an Admin</h2>
              <form onSubmit={handleInviteAdmin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Store</label>
                  <select
                    value={storeForInvite}
                    onChange={(e) => setStoreForInvite(e.target.value)}
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Admin email</label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    placeholder="name@example.com"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center justify-center rounded-md bg-green-600 px-4 py-2 text-white font-semibold shadow-sm hover:bg-green-700 disabled:opacity-60"
                >
                  {submitting ? 'Sending...' : 'Send invite'}
                </button>
              </form>
              <p className="mt-3 text-xs text-gray-500">
                Invited users receive a Supabase auth email and are tagged with the admin role for the selected store.
              </p>
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

          <section className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Recent Admin Invites</h2>
              <span className="text-sm text-gray-500">{invites.length} sent</span>
            </div>
            {invites.length === 0 ? (
              <p className="text-gray-500 text-sm">No invites yet.</p>
            ) : (
              <div className="space-y-3">
                {invites.map((invite) => {
                  const storeName = stores.find((s) => s.id === invite.store_id)?.name || 'Unknown store';
                  const statusColor =
                    invite.status === 'sent'
                      ? 'bg-green-100 text-green-700'
                      : invite.status === 'failed'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-gray-100 text-gray-700';
                  return (
                    <div key={invite.id} className="border border-gray-100 rounded-lg p-4 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-900">{invite.email}</p>
                          <p className="text-sm text-gray-500">{storeName}</p>
                        </div>
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${statusColor}`}>
                          {invite.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Sent {new Date(invite.created_at).toLocaleString()}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </main>
      </div>
    </ProtectedRoute>
  );
}
