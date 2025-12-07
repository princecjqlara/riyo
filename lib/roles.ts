import type { UserRole } from '@/types';

const ROLE_PRIORITY: Record<UserRole, number> = {
  organizer: 3,
  admin: 2,
  staff: 1,
};

const meetsRole = (required: UserRole, actual: UserRole) =>
  ROLE_PRIORITY[actual] >= ROLE_PRIORITY[required];

export function roleSatisfies(requiredRole: UserRole | UserRole[], actualRole?: UserRole | null) {
  if (!actualRole) return false;
  if (Array.isArray(requiredRole)) {
    return requiredRole.some(role => meetsRole(role, actualRole));
  }
  return meetsRole(requiredRole, actualRole);
}
