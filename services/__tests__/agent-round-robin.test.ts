import { getAgentPool, getNextRoundRobinAgentName } from '@/services/agent-round-robin';

describe('agent round robin', () => {
  it('uses expected hardcoded pool order', () => {
    expect(getAgentPool()).toEqual(['Aries Apcar', 'Mark Florea', 'Cindy Cardenas']);
  });

  it('starts at first agent when no previous assignment exists', () => {
    expect(getNextRoundRobinAgentName(null)).toBe('Aries Apcar');
  });

  it('rotates through the pool in order', () => {
    expect(getNextRoundRobinAgentName('Aries Apcar')).toBe('Mark Florea');
    expect(getNextRoundRobinAgentName('Mark Florea')).toBe('Cindy Cardenas');
    expect(getNextRoundRobinAgentName('Cindy Cardenas')).toBe('Aries Apcar');
  });

  it('handles case-insensitive previous values and unknown values', () => {
    expect(getNextRoundRobinAgentName('aries apcar')).toBe('Mark Florea');
    expect(getNextRoundRobinAgentName('Unknown Agent')).toBe('Aries Apcar');
  });
});
