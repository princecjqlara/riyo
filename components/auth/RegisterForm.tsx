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
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] py-12 px-6">
      {/* Background decoration */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-[#D4F5E9] rounded-full blur-3xl opacity-60" />
        <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-[#FEF9C3] rounded-full blur-3xl opacity-60" />
      </div>

      <div className="relative z-10 max-w-md w-full">
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 p-8 border border-slate-100 animate-fade-in">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-[#3478F6] to-[#7C3AED] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/30">
              <span className="text-2xl text-white">👤</span>
            </div>
            <h2 className="text-2xl font-black text-slate-900">Create Account</h2>
            <p className="text-slate-400 text-sm mt-1">Join the PriceScan team</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-4 bg-[#FFE4E6] text-rose-600 rounded-xl text-sm font-medium border border-rose-100 animate-shake">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Full Name</label>
              <input
                type="text"
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-100 rounded-xl text-slate-900 font-medium placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#3478F6]/30 focus:bg-white transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Email Address</label>
              <input
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-100 rounded-xl text-slate-900 font-medium placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#3478F6]/30 focus:bg-white transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Password</label>
              <input
                type="password"
                required
                minLength={6}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-100 rounded-xl text-slate-900 font-medium placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#3478F6]/30 focus:bg-white transition-all"
              />
              <p className="text-xs text-slate-400 mt-1">Minimum 6 characters</p>
            </div>

            {/* Role Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Select Role</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRole('staff')}
                  className={`p-4 rounded-2xl border-2 transition-all text-left ${role === 'staff'
                    ? 'bg-[#D4F5E9] border-emerald-300 shadow-lg shadow-emerald-500/10'
                    : 'bg-slate-50 border-transparent hover:border-slate-200'}`}
                >
                  <div className="text-2xl mb-2">🧑‍💼</div>
                  <div className="font-bold text-slate-900">Staff</div>
                  <p className="text-xs text-slate-400 mt-1">Process orders, scan items</p>
                </button>
                <button
                  type="button"
                  onClick={() => setRole('admin')}
                  className={`p-4 rounded-2xl border-2 transition-all text-left ${role === 'admin'
                    ? 'bg-[#FEF9C3] border-amber-300 shadow-lg shadow-amber-500/10'
                    : 'bg-slate-50 border-transparent hover:border-slate-200'}`}
                >
                  <div className="text-2xl mb-2">👑</div>
                  <div className="font-bold text-slate-900">Admin</div>
                  <p className="text-xs text-slate-400 mt-1">Full access, manage users</p>
                </button>
              </div>
            </div>

            {(role === 'staff' || role === 'admin') && (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Store ID</label>
                  <input
                    type="text"
                    required
                    placeholder="Paste the store ID"
                    value={storeId}
                    onChange={(e) => setStoreId(e.target.value)}
                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-100 rounded-xl text-slate-900 font-medium placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#3478F6]/30 focus:bg-white transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Store Join Code</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    placeholder="ABC123"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    className="w-full px-4 py-3.5 bg-[#E0F2FE] border border-sky-100 rounded-xl text-slate-900 font-mono font-bold placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#3478F6]/30 focus:bg-white transition-all tracking-[0.3em] text-center text-lg"
                  />
                  <p className="text-xs text-slate-400 mt-1">Ask an admin or organizer for the current single-use code.</p>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-[#3478F6] text-white rounded-2xl font-bold shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all active:scale-[0.98] disabled:opacity-50 mt-6"
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

          <p className="text-center text-slate-400 mt-6 text-sm">
            Already have an account?{' '}
            <Link href="/login" className="text-[#3478F6] font-bold hover:underline">Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
