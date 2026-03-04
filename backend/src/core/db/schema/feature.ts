import { boolean, integer, primaryKey, text } from 'drizzle-orm/pg-core';
import { auditColumns } from './audit';
import { sobaSchema } from './core';
import { CODE_SOURCE_CORE } from './codes';

/**
 * Feature status code table. Used by soba.feature.status.
 * Core and features both insert here; source = 'core' or feature code.
 */
export const featureStatus = sobaSchema.table(
  'feature_status',
  {
    code: text('code').notNull(),
    source: text('source').notNull().default(CODE_SOURCE_CORE),
    display: text('display').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
  },
  (table) => [primaryKey({ columns: [table.code, table.source] })],
);

/**
 * DB-backed feature registry. status values reference feature_status code table.
 */
export const features = sobaSchema.table('feature', {
  code: text('code').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  version: text('version'),
  status: text('status').notNull(),
  ...auditColumns(),
});
