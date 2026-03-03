import { sql } from 'drizzle-orm';
import { boolean, check, integer, text } from 'drizzle-orm/pg-core';
import { sobaSchema } from './core';
import { features } from './feature';

/** Shared columns for all code tables: code, display, sort_order, is_active */
const codeTableColumns = () => ({
  code: text('code').primaryKey(),
  display: text('display').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
});

export const formStatus = sobaSchema.table('form_status', codeTableColumns());
export const formVersionState = sobaSchema.table('form_version_state', codeTableColumns());
export const workspaceMembershipRole = sobaSchema.table(
  'workspace_membership_role',
  codeTableColumns(),
);
export const workspaceMembershipStatus = sobaSchema.table(
  'workspace_membership_status',
  codeTableColumns(),
);
export const outboxStatus = sobaSchema.table('outbox_status', codeTableColumns());

/**
 * Registry of code sets: core vs feature-owned. feature_code is nullable FK to feature.code;
 * core rows have feature_code null, feature rows have feature_code set.
 */
export const codeSetRegistry = sobaSchema.table(
  'code_set_registry',
  {
    codeSet: text('code_set').primaryKey(),
    providerType: text('provider_type').notNull(),
    featureCode: text('feature_code').references(() => features.code),
  },
  (table) => [
    check(
      'code_set_registry_core_feature_check',
      sql`((${table.providerType} = 'core' AND ${table.featureCode} IS NULL) OR (${table.providerType} = 'feature' AND ${table.featureCode} IS NOT NULL))`,
    ),
  ],
);
