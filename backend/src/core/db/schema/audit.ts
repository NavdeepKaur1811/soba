import { text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { v7 as uuidv7 } from 'uuid';

/**
 * Standard primary key: uuid 'id' with v7 default. Use for all entity tables that need a single uuid PK.
 */
export const idColumn = () => uuid('id').primaryKey().$defaultFn(uuidv7);

/**
 * Standard audit columns: created/updated at (with timezone) and created/updated by (optional).
 * Spread into table definitions. For soft-delete, add softDeleteColumns() or explicit deletedAt/deletedBy.
 */
export const auditColumns = () => ({
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: text('created_by'),
  updatedBy: text('updated_by'),
});

/**
 * Soft-delete columns: deletedAt and deletedBy (display label, same semantics as app_users.display_label).
 * Spread into table definitions that support soft delete.
 */
export const softDeleteColumns = () => ({
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  deletedBy: text('deleted_by'),
});
