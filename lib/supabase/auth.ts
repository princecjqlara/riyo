import { supabase } from './client';
import type { UserProfile, UserRole } from '@/types';

export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error || !data) return null;
  return data as UserProfile;
}

export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return getUserProfile(user.id);
}

export async function checkRole(requiredRole: UserRole | UserRole[]): Promise<boolean> {
  const profile = await getCurrentUserProfile();
  if (!profile) return false;
  
  if (Array.isArray(requiredRole)) {
    return requiredRole.includes(profile.role);
  }
  return profile.role === requiredRole;
}

export async function isAdmin(): Promise<boolean> {
  return checkRole('admin');
}

export async function isStaffOrAdmin(): Promise<boolean> {
  return checkRole(['admin', 'staff']);
}

