import { sql } from 'drizzle-orm';
import { boolean, check, integer, text } from 'drizzle-orm/pg-core';
import { auditColumns } from './audit';
import { sobaSchema } from './sobaSchema';
import { features } from './feature';

/**
 * Role status code table. Used by soba.roles.status.
 */
export const roleStatus = sobaSchema.table('role_status', {
  code: text('code').primaryKey(),
  display: text('display').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
});

/**
 * DB-backed role registry. status values reference role_status semantically.
 * Extensible: features can register roles via role_registry.
 */
export const roles = sobaSchema.table('role', {
  code: text('code').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  status: text('status').notNull(),
  ...auditColumns(),
});

/**
 * Registry of roles: core vs feature-owned. feature_code is nullable FK;
 * core rows have feature_code null, feature rows have feature_code set.
 */
export const roleRegistry = sobaSchema.table(
  'role_registry',
  {
    roleCode: text('role_code')
      .primaryKey()
      .references(() => roles.code),
    providerType: text('provider_type').notNull(),
    featureCode: text('feature_code').references(() => features.code),
  },
  (table) => [
    check(
      'role_registry_core_feature_check',
      sql`((${table.providerType} = 'core' AND ${table.featureCode} IS NULL) OR (${table.providerType} = 'feature' AND ${table.featureCode} IS NOT NULL))`,
    ),
  ],
);
