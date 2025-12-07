import { getCurrentUserProfile } from './supabase/auth';
import type { UserRole } from '@/types';

export async function hasRole(role: UserRole | UserRole[]): Promise<boolean> {
  const profile = await getCurrentUserProfile();
  if (!profile) return false;
  
  if (Array.isArray(role)) {
    return role.includes(profile.role);
  }
  return profile.role === role;
}

export async function requireAuth(): Promise<boolean> {
  const profile = await getCurrentUserProfile();
  return !!profile;
}

export async function requireRole(role: UserRole | UserRole[]): Promise<boolean> {
  return hasRole(role);
}

