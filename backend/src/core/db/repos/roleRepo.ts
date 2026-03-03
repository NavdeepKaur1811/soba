import { asc, eq, inArray } from 'drizzle-orm';
import { db } from '../client';
import { roles } from '../schema';
import { listRegistry } from './roleRegistryRepo';

export interface RoleRow {
  code: string;
  name: string;
  description: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export const getRoleByCode = async (code: string): Promise<RoleRow | null> => {
  const rows = await db.select().from(roles).where(eq(roles.code, code)).limit(1);
  return rows[0] ?? null;
};

export const listRoles = async (options?: {
  onlyEnabledFeatures?: boolean;
}): Promise<RoleRow[]> => {
  const registryRows = await listRegistry(options);
  if (registryRows.length === 0) return [];
  const roleCodes = registryRows.map((r) => r.roleCode);
  const rows = await db
    .select()
    .from(roles)
    .where(inArray(roles.code, roleCodes))
    .orderBy(asc(roles.code));
  return rows;
};
