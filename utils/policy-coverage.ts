import type { Policy } from '@/types/policy';

// The API's normalized status is authoritative; device dates do not determine eligibility.
export function isActivePolicy(record: { recordType?: string; status: string }) {
  return record.recordType === 'POLICY' && record.status.trim().toUpperCase() === 'ACTIVE';
}

type CoverageCategory = { key: string; title: string };
export type PolicyCoverageSection = CoverageCategory & { policies: Policy[] };

function normalizeCoverage(value: string) {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

const categories = [
  { key: 'workers-comp', title: 'Workers Compensation', aliases: [
    'workers compensation', 'worker compensation', 'workers comp', 'worker comp', 'WC',
    'workers compensation insurance', 'workmens compensation',
  ] },
  { key: 'llc-bond', title: 'LLC Employee/Worker Bond', aliases: [
    'LLC Bond', 'LLC Employee Bond', 'LLC Worker Bond', 'LLC Workers Bond',
    'LLC Employee/Worker Bond', 'LLC Employee/Workers Bond',
  ] },
  { key: 'clb-bond', title: 'CLB Bond', aliases: [
    'Contractor License Bond', 'Contractors License Bond', 'CSLB Bond', 'CLB Bond',
  ] },
  { key: 'general-liability', title: 'General Liability', aliases: [
    'General Liability', 'General Liab', 'CGL', 'GL', 'Commercial General Liability',
  ] },
  { key: 'commercial-auto', title: 'Commercial Auto', aliases: [
    'Commercial Auto', 'Commercial Automobile', 'Business Auto', 'Auto Liability',
  ] },
] as const;

const aliases = new Map<string, CoverageCategory>();
for (const category of categories) {
  for (const alias of category.aliases) aliases.set(normalizeCoverage(alias), category);
}

export function classifyPolicyCoverage(policy: Pick<Policy, 'lineOfBusiness' | 'productName'>): CoverageCategory {
  const source = policy.lineOfBusiness?.trim() || policy.productName.trim();
  const normalized = normalizeCoverage(source);
  const known = aliases.get(normalized);
  if (known) return { key: known.key, title: known.title };
  if (!normalized || (!policy.lineOfBusiness?.trim() && normalized === 'policy')) {
    return { key: 'other', title: 'Other Policies' };
  }
  const title = source.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
    .toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
  return { key: `coverage-${normalized}`, title };
}

export function groupActivePolicies(policies: Policy[]): PolicyCoverageSection[] {
  const sections = new Map<string, PolicyCoverageSection>();
  const seenIds = new Set<string>();
  for (const policy of policies) {
    if (!isActivePolicy(policy) || seenIds.has(policy.id)) continue;
    seenIds.add(policy.id);
    const category = classifyPolicyCoverage(policy);
    const section = sections.get(category.key) ?? { ...category, policies: [] };
    section.policies.push(policy);
    sections.set(category.key, section);
  }
  const order: readonly string[] = categories.map((category) => category.key);
  const rank = (key: string) => order.includes(key) ? order.indexOf(key) : order.length;
  return [...sections.values()].sort((left, right) => rank(left.key) - rank(right.key) || left.title.localeCompare(right.title));
}
