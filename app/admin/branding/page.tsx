'use client';

import { useEffect, useState } from 'react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import Navbar from '@/components/shared/Navbar';

export default function BrandingPage() {
  const [title, setTitle] = useState('PriceScan');
  const [subtitle, setSubtitle] = useState('Wholesale Lookup');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchBranding();
  }, []);

  const fetchBranding = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/branding');
      if (res.ok) {
        const data = await res.json();
        setTitle(data.title || 'PriceScan');
        setSubtitle(data.subtitle || 'Wholesale Lookup');
      }
    } catch (err) {
      console.error(err);
      setMessage('Failed to load branding, using defaults.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/branding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, subtitle }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save branding');
      }
      setTitle(data.title);
      setSubtitle(data.subtitle);
      setMessage('Branding updated.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to save branding');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProtectedRoute requiredRole={['admin', 'organizer']}>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-extrabold text-gray-900">Branding</h1>
            <p className="mt-2 text-gray-600">Update the public header text.</p>
          </div>

          {message && (
            <div className="mb-4 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 shadow-sm">
              {message}
            </div>
          )}

          {loading ? (
            <div className="text-center text-gray-500">Loading...</div>
          ) : (
            <form onSubmit={handleSave} className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  placeholder="Brand title"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subtitle</label>
                <input
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  placeholder="Subtitle"
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-white font-semibold shadow-sm hover:bg-indigo-700 disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </form>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}
