import { getCurrentUserProfile } from './supabase/auth';
import { roleSatisfies } from './roles';
import type { UserRole } from '@/types';

export async function hasRole(role: UserRole | UserRole[]): Promise<boolean> {
  const profile = await getCurrentUserProfile();
  if (!profile) return false;
  return roleSatisfies(role, profile.role);
}

export async function requireAuth(): Promise<boolean> {
  const profile = await getCurrentUserProfile();
  return !!profile;
}

export async function requireRole(role: UserRole | UserRole[]): Promise<boolean> {
  return hasRole(role);
}

