import { eq, or } from 'drizzle-orm';
import { db } from '../client';
import { codeSetRegistry, features } from '../schema';

export interface CodeSetRegistryRow {
  codeSet: string;
  providerType: string;
  featureCode: string | null;
}

export const listRegistry = async (options?: {
  onlyEnabledFeatures?: boolean;
}): Promise<CodeSetRegistryRow[]> => {
  if (!options?.onlyEnabledFeatures) {
    const rows = await db.select().from(codeSetRegistry).orderBy(codeSetRegistry.codeSet);
    return rows;
  }
  const rows = await db
    .select({
      codeSet: codeSetRegistry.codeSet,
      providerType: codeSetRegistry.providerType,
      featureCode: codeSetRegistry.featureCode,
    })
    .from(codeSetRegistry)
    .leftJoin(features, eq(codeSetRegistry.featureCode, features.code))
    .where(or(eq(codeSetRegistry.providerType, 'core'), eq(features.status, 'enabled')))
    .orderBy(codeSetRegistry.codeSet);
  return rows;
};

export const getByCodeSet = async (codeSet: string): Promise<CodeSetRegistryRow | null> => {
  const rows = await db
    .select()
    .from(codeSetRegistry)
    .where(eq(codeSetRegistry.codeSet, codeSet))
    .limit(1);
  return rows[0] ?? null;
};
