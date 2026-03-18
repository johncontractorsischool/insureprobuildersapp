import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { PolicyCard } from '@/components/policy-card';
import { ScreenContainer } from '@/components/screen-container';
import { SectionHeader } from '@/components/section-header';
import { theme } from '@/constants/theme';
import { mockPolicies } from '@/data/mock-policies';
import { PolicyStatus } from '@/types/policy';

type FilterValue = 'All' | PolicyStatus;

const filters: FilterValue[] = ['All', 'Active', 'Pending', 'Lapsed'];

export default function PoliciesScreen() {
  const [selectedFilter, setSelectedFilter] = useState<FilterValue>('All');

  const filteredPolicies = useMemo(() => {
    if (selectedFilter === 'All') return mockPolicies;
    return mockPolicies.filter((policy) => policy.status === selectedFilter);
  }, [selectedFilter]);

  return (
    <ScreenContainer>
      <SectionHeader
        title="Policies"
        subtitle="Manage coverage details and policy documents"
      />

      <View style={styles.filterRow}>
        {filters.map((filter) => (
          <Pressable
            key={filter}
            onPress={() => setSelectedFilter(filter)}
            style={[styles.filterChip, selectedFilter === filter ? styles.filterChipActive : null]}>
            <Text
              style={[
                styles.filterChipText,
                selectedFilter === filter ? styles.filterChipTextActive : null,
              ]}>
              {filter}
            </Text>
          </Pressable>
        ))}
      </View>

      {filteredPolicies.length > 0 ? (
        filteredPolicies.map((policy) => (
          <PolicyCard
            key={policy.id}
            policy={policy}
            onPress={() =>
              router.push({
                pathname: '/policy/[id]',
                params: { id: policy.id },
              })
            }
          />
        ))
      ) : (
        <EmptyState
          icon="shield-outline"
          title="No matching policies"
          description="Try a different status filter or check back once your policy data syncs."
          actionLabel="Clear filters"
          onAction={() => setSelectedFilter('All')}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  filterRow: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    flexWrap: 'wrap',
  },
  filterChip: {
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 8,
    backgroundColor: theme.colors.surface,
  },
  filterChipActive: {
    backgroundColor: '#EAF7F0',
    borderColor: '#C4E5D2',
  },
  filterChipText: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  filterChipTextActive: {
    color: theme.colors.primary,
  },
});
