import { boolean, integer, text } from 'drizzle-orm/pg-core';
import { auditColumns } from './audit';
import { sobaSchema } from './core';

/**
 * Feature status code table. Values: enabled, disabled, optional experimental/deprecated.
 * Used by soba.feature.status.
 */
export const featureStatus = sobaSchema.table('feature_status', {
  code: text('code').primaryKey(),
  display: text('display').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
});

/**
 * DB-backed feature registry. status values come from feature_status code table (e.g. enabled, disabled).
 */
export const features = sobaSchema.table('feature', {
  code: text('code').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  version: text('version'),
  status: text('status').notNull(),
  ...auditColumns(),
});
