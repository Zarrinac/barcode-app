/**
 * Role names and the permission predicate, kept free of any server-only import so the dashboard
 * can gate its UI with exactly the same rule the API enforces.
 *
 * ADMIN   — everything, and the only role that can manage user accounts.
 * MANAGER — warehouse data: serials, product models, locations and the Excel import.
 * USER    — scanner operators: sign in, scan, send serials, read the lists.
 */
export const adminRole = 'ADMIN';
export const managerRole = 'MANAGER';

const dataManagementRoles = new Set<string>([adminRole, managerRole]);

export function canManageData(role: string | undefined) {
  return role !== undefined && dataManagementRoles.has(role);
}

export function canManageUsers(role: string | undefined) {
  return role === adminRole;
}
