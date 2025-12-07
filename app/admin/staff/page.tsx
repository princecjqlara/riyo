'use client';

import { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import Navbar from '@/components/shared/Navbar';
import type { Store } from '@/types';

type StaffMember = {
  id: string;
  name: string;
  email: string | null;
  role: string;
  store_name: string | null;
  store_id: string | null;
  created_at: string;
};

export default function StaffManagementPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [countdown, setCountdown] = useState('');
  const [codeLoading, setCodeLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
    if (!selectedStoreId) return;
    fetchJoinCode(selectedStoreId);
  }, [selectedStoreId]);

  useEffect(() => {
    if (!expiresAt || !selectedStoreId) return;
    const refreshIn = Math.max(5000, expiresAt - Date.now() + 500);
    const timer = setTimeout(() => fetchJoinCode(selectedStoreId), refreshIn);
    return () => clearTimeout(timer);
  }, [expiresAt, selectedStoreId]);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([fetchStores(), fetchStaff()]);
    setLoading(false);
  };

  const fetchStaff = async () => {
    try {
      const response = await fetch('/api/staff');
      if (response.ok) {
        const data = await response.json();
        setStaff(data.staff || []);
      } else {
        const body = await response.json();
        setMessage(body.error || 'Failed to load staff');
      }
    } catch (error) {
      console.error('Error fetching staff:', error);
      setMessage('Could not load staff list.');
    }
  };

  const fetchStores = async () => {
    try {
      const res = await fetch('/api/stores');
      if (res.ok) {
        const data = await res.json();
        setStores(data.stores || []);
        if (!selectedStoreId && data.stores?.length) {
          setSelectedStoreId(data.stores[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching stores:', error);
    }
  };

  const fetchJoinCode = async (storeId: string) => {
    setCodeLoading(true);
    try {
      const res = await fetch(`/api/stores/staff-code?storeId=${storeId}`);
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || 'Failed to load join code');
      }
      setJoinCode(body.code);
      setExpiresAt(body.expiresAt);
    } catch (error) {
      console.error('Join code error:', error);
      setMessage(error instanceof Error ? error.message : 'Failed to load join code');
    } finally {
      setCodeLoading(false);
    }
  };

  const copy = (value: string, label: string) => {
    if (!value) return;
    navigator.clipboard?.writeText(value);
    setMessage(`${label} copied`);
    setTimeout(() => setMessage(null), 2000);
  };

  if (loading) {
    return (
      <ProtectedRoute requiredRole="admin">
        <div className="min-h-screen bg-gray-50">
          <Navbar />
          <main className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading...</p>
            </div>
          </main>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredRole="admin">
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-extrabold text-gray-900">Staff Management</h1>
            <p className="mt-2 text-gray-600">Share rotating join codes instead of email invites.</p>
          </div>

          {message && (
            <div className="mb-6 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 shadow-sm">
              {message}
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="bg-white rounded-lg shadow-md p-6 border border-gray-100">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Current Store Code</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Store</label>
                  <select
                    value={selectedStoreId}
                    onChange={(e) => setSelectedStoreId(e.target.value)}
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
                  <p className="text-xs text-gray-500 uppercase">Join code (changes every 10 minutes)</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-3xl font-mono font-semibold text-gray-900 tracking-[0.3em]">
                      {codeLoading ? '••••••' : joinCode || '------'}
                    </span>
                    <button
                      type="button"
                      onClick={() => fetchJoinCode(selectedStoreId)}
                      className="text-sm text-indigo-600 hover:text-indigo-800"
                      disabled={!selectedStoreId || codeLoading}
                    >
                      Refresh
                    </button>
                  </div>
                  <div className="mt-2 text-sm text-gray-600 flex items-center justify-between">
                    <span>Expires in {expiresAt ? countdown : '—'}</span>
                    {expiresAt && (
                      <span className="text-gray-500">
                        {new Date(expiresAt).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => copy(joinCode, 'Code')}
                    disabled={!joinCode}
                    className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-3 py-2 text-white text-sm font-semibold shadow-sm hover:bg-indigo-700 disabled:opacity-50"
                  >
                    Copy code
                  </button>
                  <button
                    type="button"
                    onClick={() => copy(selectedStoreId, 'Store ID')}
                    disabled={!selectedStoreId}
                    className="inline-flex items-center justify-center rounded-md bg-gray-200 px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-300 disabled:opacity-50"
                  >
                    Copy store ID
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  Share this code and store ID with staff. Codes rotate every 10 minutes and can be entered on the sign-up page.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6 border border-gray-100 lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Staff</h2>
                <span className="text-sm text-gray-500">{Array.isArray(staff) ? staff.length : 0} total</span>
              </div>
              {Array.isArray(staff) && staff.length === 0 ? (
                <p className="text-gray-500">No staff members found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Name
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Email
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Store
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Role
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Created
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {Array.isArray(staff) &&
                        staff.map((member) => (
                          <tr key={member.id}>
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                              {member.name || 'N/A'}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                              {member.email || '—'}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                              {member.store_name || member.store_id || '—'}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-indigo-100 text-indigo-800">
                                {member.role}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                              {new Date(member.created_at).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}

