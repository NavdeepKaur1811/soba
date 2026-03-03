import { and, asc, eq } from 'drizzle-orm';
import { db } from '../db/client';
import {
  featureStatus,
  formStatus,
  formVersionState,
  outboxStatus,
  workspaceMembershipRole,
  workspaceMembershipStatus,
} from '../db/schema';
import { FeatureStatus } from '../db/codes';
import { getByCodeSet, listRegistry } from '../db/repos/codeSetRegistryRepo';

export interface CodeRow {
  code: string;
  display: string;
  sortOrder: number;
  isActive: boolean;
}

export interface RegisteredCodeSet {
  codeSet: string;
  providerType: string;
  featureCode: string | null;
}

const CODE_TABLES: Record<
  string,
  | typeof formStatus
  | typeof featureStatus
  | typeof formVersionState
  | typeof workspaceMembershipRole
  | typeof workspaceMembershipStatus
  | typeof outboxStatus
> = {
  feature_status: featureStatus,
  form_status: formStatus,
  form_version_state: formVersionState,
  workspace_membership_role: workspaceMembershipRole,
  workspace_membership_status: workspaceMembershipStatus,
  outbox_status: outboxStatus,
};

export const codeService = {
  async getRegisteredCodeSets(options?: {
    onlyEnabledFeatures?: boolean;
  }): Promise<RegisteredCodeSet[]> {
    return listRegistry(options);
  },

  async getCodes(codeSet: string, options?: { activeOnly?: boolean }): Promise<CodeRow[]> {
    const registryRow = await getByCodeSet(codeSet);
    if (!registryRow) return [];
    if (registryRow.providerType === 'feature' && registryRow.featureCode) {
      const { getFeatureByCode } = await import('../db/repos/featureRepo');
      const feature = await getFeatureByCode(registryRow.featureCode);
      if (feature?.status !== FeatureStatus.enabled) return [];
    }
    const table = CODE_TABLES[codeSet];
    if (!table) return [];
    const baseQuery = db
      .select({
        code: table.code,
        display: table.display,
        sortOrder: table.sortOrder,
        isActive: table.isActive,
      })
      .from(table)
      .orderBy(asc(table.sortOrder), asc(table.code));
    const rows = options?.activeOnly
      ? await baseQuery.where(eq(table.isActive, true))
      : await baseQuery;
    return rows as CodeRow[];
  },

  async getCode(
    codeSet: string,
    code: string,
    options?: { activeOnly?: boolean },
  ): Promise<CodeRow | null> {
    const registryRow = await getByCodeSet(codeSet);
    if (!registryRow) return null;
    if (registryRow.providerType === 'feature' && registryRow.featureCode) {
      const { getFeatureByCode } = await import('../db/repos/featureRepo');
      const feature = await getFeatureByCode(registryRow.featureCode);
      if (feature?.status !== FeatureStatus.enabled) return null;
    }
    const table = CODE_TABLES[codeSet];
    if (!table) return null;
    const where = options?.activeOnly
      ? and(eq(table.code, code), eq(table.isActive, true))
      : eq(table.code, code);
    const rows = await db
      .select({
        code: table.code,
        display: table.display,
        sortOrder: table.sortOrder,
        isActive: table.isActive,
      })
      .from(table)
      .where(where)
      .limit(1);
    return (rows[0] as CodeRow) ?? null;
  },

  async isValidCode(
    codeSet: string,
    code: string,
    options?: { activeOnly?: boolean },
  ): Promise<boolean> {
    const row = await this.getCode(codeSet, code, options);
    return row !== null;
  },
};
