import { getRoleByCode, listRoles as repoListRoles } from '../db/repos/roleRepo';
import type { ListRolesFilters } from '../db/repos/roleRepo';
import { FeatureStatus } from '../db/codes';
import { getFeatureByCode } from '../db/repos/featureRepo';

export interface RoleRow {
  code: string;
  name: string;
  description: string | null;
  status: string;
  source: string;
  createdAt: Date;
  updatedAt: Date;
}

export class RoleService {
  async getRole(
    roleCode: string,
    options?: { onlyEnabledFeatures?: boolean },
  ): Promise<RoleRow | null> {
    const row = await getRoleByCode(roleCode);
    if (!row) return null;
    if (row.source !== 'core' && row.featureCode && options?.onlyEnabledFeatures !== false) {
      const feature = await getFeatureByCode(row.featureCode);
      if (feature?.status !== FeatureStatus.enabled) return null;
    }
    return {
      code: row.code,
      name: row.name,
      description: row.description,
      status: row.status,
      source: row.sourceDisplay,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async listRoles(filters?: ListRolesFilters): Promise<RoleRow[]> {
    const rows = await repoListRoles(filters);
    return rows.map((r) => ({
      code: r.code,
      name: r.name,
      description: r.description,
      status: r.status,
      source: r.sourceDisplay,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  async isValidRole(
    roleCode: string,
    options?: { onlyEnabledFeatures?: boolean },
  ): Promise<boolean> {
    const row = await this.getRole(roleCode, options);
    return row !== null;
  }
}

export const roleService = new RoleService();
