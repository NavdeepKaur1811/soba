import { eq } from 'drizzle-orm';
import { FeatureStatus } from '../codes';
import { db } from '../client';
import { features } from '../schema';

export interface FeatureRow {
  code: string;
  name: string;
  description: string | null;
  version: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export const listFeatures = async (): Promise<FeatureRow[]> => {
  const rows = await db.select().from(features).orderBy(features.code);
  return rows;
};

export const getFeatureByCode = async (code: string): Promise<FeatureRow | null> => {
  const rows = await db.select().from(features).where(eq(features.code, code)).limit(1);
  return rows[0] ?? null;
};

export const isFeatureEnabled = (status: string): boolean => status === FeatureStatus.enabled;
