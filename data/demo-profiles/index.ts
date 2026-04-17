import { marketingDemoProfile } from '@/data/demo-profiles/marketing';
import type { DemoProfile } from '@/data/demo-profiles/types';

export const DEFAULT_DEMO_PROFILE_ID = marketingDemoProfile.id;

const DEMO_PROFILES: Record<string, DemoProfile> = {
  [marketingDemoProfile.id]: marketingDemoProfile,
};

export function getDemoProfileById(profileId: string | null | undefined) {
  const normalizedProfileId = profileId?.trim().toLowerCase();
  if (!normalizedProfileId) return DEMO_PROFILES[DEFAULT_DEMO_PROFILE_ID];
  return DEMO_PROFILES[normalizedProfileId] ?? DEMO_PROFILES[DEFAULT_DEMO_PROFILE_ID];
}

export type { DemoProfile } from '@/data/demo-profiles/types';
