/** Ключи прав (синхрон с backend/selakcrm/permissions.py). */
export const PERMISSION_KEYS = [
  'nav.home',
  'nav.tasks',
  'nav.companies',
  'nav.clients',
  'nav.policies',
  'nav.analytics',
  'nav.settings',
  'insurance.write',
  'clients.write',
  'clients.view_policies',
  'policies.create',
  'policies.edit',
  'tasks.create',
  'tasks.act',
  'tasks.edit_policy',
  'audit.read',
  'users.manage',
  'settings.role_permissions',
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export type MeLike = {
  permissions?: string[] | null;
} | null | undefined;

export function hasPermission(me: MeLike, key: PermissionKey | string): boolean {
  const list = me?.permissions;
  if (!list || list.length === 0) return false;
  return list.includes(key);
}

export function hasAnyPermission(me: MeLike, keys: readonly string[]): boolean {
  return keys.some((k) => hasPermission(me, k));
}
