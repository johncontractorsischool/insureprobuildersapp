import { buildPolicy } from '@/tests/factories';
import { classifyPolicyCoverage, groupActivePolicies } from '@/utils/policy-coverage';

it.each([
  ['LLC Bond', 'LLC Employee/Worker Bond'], ['l.l.c. employee bond', 'LLC Employee/Worker Bond'],
  ['LLC Worker Bond', 'LLC Employee/Worker Bond'], ['LLC Employee/Worker Bond', 'LLC Employee/Worker Bond'],
  ['Contractor License Bond', 'CLB Bond'], ['CSLB_BOND', 'CLB Bond'], ['clb-bond', 'CLB Bond'],
  ["Workers’ Compensation", 'Workers Compensation'], ['WORKERS_COMP', 'Workers Compensation'], ['WC', 'Workers Compensation'],
  ['GENERAL_LIABILITY', 'General Liability'], ['CGL', 'General Liability'],
  ['commercial automobile', 'Commercial Auto'], ['business auto', 'Commercial Auto'],
  ['Surety Bond', 'Surety Bond'], ['Bond', 'Bond'], ['Flood', 'Flood'],
])('classifies %s as %s', (lineOfBusiness, title) => {
  expect(classifyPolicyCoverage(buildPolicy({ lineOfBusiness })).title).toBe(title);
});

it('uses only the coverage identifier, with product name as a fallback', () => {
  const policy = buildPolicy({ lineOfBusiness: 'Flood', productName: 'LLC Bond', carrierName: 'CLB Bond',
    insuredName: 'Workers Compensation LLC', insuredItem: 'General Liability', policyNumber: 'CSLB-100',
    coverageSummary: [{ label: 'Carrier', value: 'Commercial Auto' }] });
  expect(classifyPolicyCoverage(policy).title).toBe('Flood');
  expect(classifyPolicyCoverage({ ...policy, lineOfBusiness: '  ' }).title).toBe('LLC Employee/Worker Bond');
  expect(classifyPolicyCoverage({ ...policy, lineOfBusiness: null, productName: '' }).title).toBe('Other Policies');
});

it('groups each active policy ID exactly once and retains distinct policies of the same coverage', () => {
  const policy = buildPolicy({ id: 'one', lineOfBusiness: 'LLC Bond' });
  const sections = groupActivePolicies([policy, { ...policy, lineOfBusiness: 'CLB Bond' },
    { ...policy, id: 'two' }, { ...policy, id: 'pending', status: 'Pending' },
    { ...policy, id: 'lapsed', status: 'Lapsed' }, { ...policy, id: 'quote', recordType: 'QUOTE' }]);
  expect(sections).toHaveLength(1);
  expect(sections[0].policies.map((item) => item.id)).toEqual(['one', 'two']);
});
