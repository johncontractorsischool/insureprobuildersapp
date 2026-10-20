import { buildPolicyFileEntry } from '@/tests/factories';
import { matchesSelectedPolicyFile, mergePolicyFiles } from '@/utils/policy-files';

it('compares UUIDs without case but keeps opaque policy IDs exact', () => {
  const id = '68E8D766-5923-49ED-82DA-9CDAE5925920';
  expect(
    matchesSelectedPolicyFile(buildPolicyFileEntry({ policyId: id.toLowerCase() }), id, '')
  ).toBe(true);
  expect(
    matchesSelectedPolicyFile(buildPolicyFileEntry({ policyId: 'Policy-A' }), 'policy-a', '')
  ).toBe(false);
});

it('uses source-qualified keys, keeps same-name uploads, and preserves server order', () => {
  const first = buildPolicyFileEntry({ documentKey: 'pbia:one', name: 'same.pdf' });
  const second = buildPolicyFileEntry({ documentKey: 'pbia:two', name: 'same.pdf' });
  const historical = buildPolicyFileEntry({ documentKey: 'momentum:one', name: 'same.pdf' });
  expect(
    mergePolicyFiles([first], [first, second, historical]).map((row) => row.documentKey)
  ).toEqual(['pbia:one', 'pbia:two', 'momentum:one']);
});
