import { boolean, integer, text } from 'drizzle-orm/pg-core';
import { auditColumns } from './audit';
import { sobaSchema } from './sobaSchema';
import { features } from './feature';
import { CODE_SOURCE_CORE } from './codes';

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
 * DB-backed roles. source = 'core' or 'feature'; feature_code set when source is 'feature'.
 * Extensible: features can add roles with source = 'feature' and feature_code = their code.
 */
export const roles = sobaSchema.table('role', {
  code: text('code').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  status: text('status').notNull(),
  source: text('source').notNull().default(CODE_SOURCE_CORE),
  featureCode: text('feature_code').references(() => features.code),
  ...auditColumns(),
});
