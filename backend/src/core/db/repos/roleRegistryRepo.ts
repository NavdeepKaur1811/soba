import { eq, or } from 'drizzle-orm';
import { db } from '../client';
import { features, roleRegistry } from '../schema';

export interface RoleRegistryRow {
  roleCode: string;
  providerType: string;
  featureCode: string | null;
}

export const listRegistry = async (options?: {
  onlyEnabledFeatures?: boolean;
}): Promise<RoleRegistryRow[]> => {
  if (!options?.onlyEnabledFeatures) {
    const rows = await db.select().from(roleRegistry).orderBy(roleRegistry.roleCode);
    return rows;
  }
  const rows = await db
    .select({
      roleCode: roleRegistry.roleCode,
      providerType: roleRegistry.providerType,
      featureCode: roleRegistry.featureCode,
    })
    .from(roleRegistry)
    .leftJoin(features, eq(roleRegistry.featureCode, features.code))
    .where(or(eq(roleRegistry.providerType, 'core'), eq(features.status, 'enabled')))
    .orderBy(roleRegistry.roleCode);
  return rows;
};

export const getByRoleCode = async (roleCode: string): Promise<RoleRegistryRow | null> => {
  const rows = await db
    .select()
    .from(roleRegistry)
    .where(eq(roleRegistry.roleCode, roleCode))
    .limit(1);
  return rows[0] ?? null;
};
