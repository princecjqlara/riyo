'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import Link from 'next/link';
import type { UserRole } from '@/types';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('admin');
  const [loading, setLoading] = useState(false);
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
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) throw signInError;

      if (data.user) {
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('id', data.user.id)
          .single();

        if (profileError) throw profileError;

        const userRole = profile?.role as UserRole | undefined;
        if (!userRole) throw new Error('This account does not have a role yet.');

        const targetRole =
          (selectedRole === 'admin' && userRole === 'organizer') || selectedRole === userRole
            ? selectedRole
            : userRole;

        const destination =
          targetRole === 'organizer' ? '/organizer' : targetRole === 'admin' ? '/admin' : '/staff';

        router.push(destination);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  const roleConfig: Record<UserRole, { label: string; description: string; color: string; bg: string; icon: string }> = {
    staff: {
      label: 'Staff',
      description: 'Run checkouts and process customer codes.',
      color: 'text-emerald-700',
      bg: 'bg-[#D4F5E9]',
      icon: '🧑‍💼',
    },
    admin: {
      label: 'Admin',
      description: 'Manage inventory, pricing, and staff.',
      color: 'text-sky-700',
      bg: 'bg-[#E0F2FE]',
      icon: '👑',
    },
    organizer: {
      label: 'Organizer',
      description: 'Create stores and distribute admin invites.',
      color: 'text-violet-700',
      bg: 'bg-[#EDE9FE]',
      icon: '🏢',
    },
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] py-12 px-4">
      {/* Background decoration */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-[#E0F2FE] rounded-full blur-3xl opacity-60" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-[#EDE9FE] rounded-full blur-3xl opacity-60" />
      </div>

      <div className="relative z-10 max-w-md w-full">
        <div className="bg-white rounded-3xl p-8 shadow-xl shadow-slate-200/50 border border-slate-100">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-[#3478F6] to-[#2563eb] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/30">
              <span className="text-2xl text-white">🔐</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 mb-1">Welcome Back</h1>
            <p className="text-slate-400 text-sm">Sign in to PriceScan</p>
          </div>

          {/* Role Selector */}
          <div className="mb-6">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Log in as</p>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(roleConfig) as UserRole[]).map((role) => {
                const config = roleConfig[role];
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setSelectedRole(role)}
                    className={`p-3 rounded-2xl text-center transition-all border-2 ${selectedRole === role
                        ? `${config.bg} border-current ${config.color} shadow-lg`
                        : 'bg-slate-50 border-transparent text-slate-500 hover:bg-slate-100'
                      }`}
                  >
                    <div className="text-xl mb-1">{config.icon}</div>
                    <div className="text-xs font-bold">{config.label}</div>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-slate-400 mt-2 text-center">
              {roleConfig[selectedRole].description}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-4 bg-[#FFE4E6] text-rose-600 rounded-xl text-sm font-medium border border-rose-100 animate-shake">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-100 rounded-xl text-slate-900 font-medium placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#3478F6]/30 focus:bg-white transition-all"
                placeholder="admin@example.com"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-100 rounded-xl text-slate-900 font-medium placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#3478F6]/30 focus:bg-white transition-all"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-[#3478F6] text-white font-bold rounded-2xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  Signing in...
                </span>
              ) : (
                `Sign In as ${roleConfig[selectedRole].label}`
              )}
            </button>
          </form>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <Link
              href="/register"
              className="w-full py-3 bg-[#D4F5E9] text-emerald-700 font-semibold rounded-xl text-center hover:bg-[#c1edd9] transition-all"
            >
              Register
            </Link>
            <Link
              href="/"
              className="w-full py-3 bg-slate-100 text-slate-600 font-semibold rounded-xl text-center hover:bg-slate-200 transition-all"
            >
              Back to Shop
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
