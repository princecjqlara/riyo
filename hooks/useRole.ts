'use client';

import { useAuth } from './useAuth';
import { roleSatisfies } from '@/lib/roles';
import type { UserRole } from '@/types';

export function useRole() {
  const { profile, loading } = useAuth();

  const hasRole = (role: UserRole | UserRole[]): boolean => {
    if (!profile) return false;
    return roleSatisfies(role, profile.role);
  };

  const isAdmin = () => hasRole('admin');
  const isStaff = () => hasRole('staff');
  const isOrganizer = () => hasRole('organizer');
  const isStaffOrAdmin = () => hasRole(['admin', 'staff']);
  const isOrganizerOrAdmin = () => hasRole(['organizer', 'admin']);

  return {
    role: profile?.role,
    isOrganizer: isOrganizer(),
    isAdmin: isAdmin(),
    isStaff: isStaff(),
    isStaffOrAdmin: isStaffOrAdmin(),
    isOrganizerOrAdmin: isOrganizerOrAdmin(),
    hasRole,
    loading,
  };
}

