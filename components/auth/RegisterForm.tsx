'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import Link from 'next/link';

export default function RegisterForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'admin' | 'staff'>('staff');
  const [loading, setLoading] = useState(false);
  const [storeId, setStoreId] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (role === 'staff' || role === 'admin') {
        if (!storeId.trim() || !joinCode.trim()) {
          setError('Store ID and join code are required.');
          setLoading(false);
          return;
        }

        const verifyRes = await fetch('/api/stores/join-code/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ storeId: storeId.trim(), code: joinCode.trim(), role, mode: 'check' })
        });
        const verifyBody = await verifyRes.json();
        if (!verifyRes.ok) {
          throw new Error(verifyBody.error || 'Invalid store join code');
        }
      }

      // Sign up user
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) throw signUpError;

      if (authData.user) {
        // Create user profile
        const { error: profileError } = await supabase
          .from('user_profiles')
          .insert({
            id: authData.user.id,
            email,
            full_name: fullName || null,
            role,
          });

        if (profileError) throw profileError;

        if (role === 'staff') {
          const staffRes = await fetch('/api/staff', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: authData.user.id,
              name: fullName || email,
              role: 'staff',
              storeId: storeId.trim(),
              code: joinCode.trim()
            })
          });

          const staffBody = await staffRes.json();
          if (!staffRes.ok) {
            throw new Error(staffBody.error || 'Failed to finish staff setup');
          }
        } else if (role === 'admin') {
          const consumeRes = await fetch('/api/stores/join-code/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ storeId: storeId.trim(), code: joinCode.trim(), role, mode: 'consume', userId: authData.user.id })
          });
          const consumeBody = await consumeRes.json();
          if (!consumeRes.ok) {
            throw new Error(consumeBody.error || 'Failed to consume join code');
          }
        }

        // Redirect based on role
        if (role === 'admin') {
          router.push('/admin');
        } else {
          router.push('/staff');
        }
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to register');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-6 font-sans">
      {/* Background */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-40">
        <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-blue-100 to-transparent" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-purple-100 rounded-full blur-3xl opacity-60" />
      </div>

      <div className="relative z-10 max-w-md w-full">
        <div className="bg-white rounded-3xl shadow-2xl shadow-gray-200/50 p-8 border border-gray-100 animate-fade-in">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/30">
              <span className="text-2xl text-white">👤</span>
            </div>
            <h2 className="text-2xl font-black text-gray-900">Create Account</h2>
            <p className="text-gray-400 text-sm mt-1">Join the PriceScan team</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium border border-red-100 animate-shake">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Full Name</label>
              <input
                type="text"
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-gray-900 font-medium placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Email Address</label>
              <input
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-gray-900 font-medium placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Password</label>
              <input
                type="password"
                required
                minLength={6}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-gray-900 font-medium placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all"
              />
              <p className="text-xs text-gray-400 mt-1">Minimum 6 characters</p>
            </div>

            {/* Role Selection */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Select Role</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRole('staff')}
                  className={`p-4 rounded-2xl border-2 transition-all text-left ${role === 'staff'
                    ? 'border-blue-500 bg-blue-50 shadow-lg shadow-blue-500/10'
                    : 'border-gray-100 bg-gray-50 hover:border-gray-200'}`}
                >
                  <div className="text-2xl mb-2">🧑‍💼</div>
                  <div className="font-bold text-gray-900">Staff</div>
                  <p className="text-xs text-gray-400 mt-1">Add products, scan items</p>
                </button>
                <button
                  type="button"
                  onClick={() => setRole('admin')}
                  className={`p-4 rounded-2xl border-2 transition-all text-left ${role === 'admin'
                    ? 'border-purple-500 bg-purple-50 shadow-lg shadow-purple-500/10'
                    : 'border-gray-100 bg-gray-50 hover:border-gray-200'}`}
                >
                  <div className="text-2xl mb-2">👑</div>
                  <div className="font-bold text-gray-900">Admin</div>
                  <p className="text-xs text-gray-400 mt-1">Full access, manage users</p>
                </button>
              </div>
            </div>

            {(role === 'staff' || role === 'admin') && (
              <>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Store ID</label>
                  <input
                    type="text"
                    required
                    placeholder="Paste the store ID"
                    value={storeId}
                    onChange={(e) => setStoreId(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-gray-900 font-medium placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Store Join Code</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    placeholder="6-digit code"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-gray-900 font-medium placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all tracking-[0.3em]"
                  />
                  <p className="text-xs text-gray-400 mt-1">Ask an admin or organizer for the current single-use code for this store.</p>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold shadow-xl shadow-gray-900/20 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 disabled:scale-100 mt-6"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  Creating Account...
                </span>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          <p className="text-center text-gray-400 mt-6 text-sm">
            Already have an account?{' '}
            <Link href="/login" className="text-blue-600 font-bold hover:underline">Sign In</Link>
          </p>
        </div>
      </div>

      <style jsx global>{`
        @keyframes fade-in {
          0% { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fade-in 0.4s ease-out; }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-5px); }
          40%, 80% { transform: translateX(5px); }
        }
        .animate-shake { animation: shake 0.4s ease-in-out; }
      `}</style>
    </div>
  );
}
