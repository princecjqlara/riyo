'use client';

import { useAuth } from './useAuth';
import type { UserRole } from '@/types';

export function useRole() {
  const { profile, loading } = useAuth();

  const hasRole = (role: UserRole | UserRole[]): boolean => {
    if (!profile) return false;
    if (Array.isArray(role)) {
      return role.includes(profile.role);
    }
    return profile.role === role;
  };

  const isAdmin = () => hasRole('admin');
  const isStaff = () => hasRole('staff');
  const isStaffOrAdmin = () => hasRole(['admin', 'staff']);

  return {
    role: profile?.role,
    isAdmin: isAdmin(),
    isStaff: isStaff(),
    isStaffOrAdmin: isStaffOrAdmin(),
    hasRole,
    loading,
  };
}

