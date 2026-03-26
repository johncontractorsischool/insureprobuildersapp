import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ComponentProps } from 'react';
import { Alert, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';

import { ScreenContainer } from '@/components/screen-container';
import {
  PBIA_FORMS,
  type PbiaFormRegistryItem,
  type PbiaFormSlug,
} from '@/constants/pbia-forms';
import { theme } from '@/constants/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

type IntakeFormItem = {
  slug: PbiaFormSlug;
  description?: string;
  icon?: IconName;
};

type IntakeFormSection = {
  key: string;
  title: string;
  data: IntakeFormItem[];
};

const FORM_REGISTRY_BY_SLUG: Record<PbiaFormSlug, PbiaFormRegistryItem> = PBIA_FORMS.reduce(
  (registry, form) => {
    registry[form.slug] = form;
    return registry;
  },
  {} as Record<PbiaFormSlug, PbiaFormRegistryItem>
);

const INTAKE_FORM_SECTIONS: readonly IntakeFormSection[] = [
  {
    key: 'core-coverage',
    title: 'Core Coverage',
    data: [
      {
        slug: 'commercial-auto',
        description: 'Coverage for business vehicles',
        icon: 'car-sport-outline',
      },
      {
        slug: 'general-liability',
        description: 'Protection for third-party injury and damage',
        icon: 'shield-checkmark-outline',
      },
      {
        slug: 'workers-comp',
        description: 'Coverage for employee work-related injuries',
        icon: 'briefcase-outline',
      },
    ],
  },
  {
    key: 'bonds',
    title: 'Bonds',
    data: [
      {
        slug: 'bond-quote',
        description: 'Start a new bond quote request',
        icon: 'ribbon-outline',
      },
      {
        slug: 'bond-request',
        description: 'Submit details for a bond',
        icon: 'document-text-outline',
      },
    ],
  },
  {
    key: 'certificates-admin',
    title: 'Certificates / Admin',
    data: [
      {
        slug: 'additional-insured-request',
        description: 'Request to add another party to a certificate',
        icon: 'person-add-outline',
      },
      {
        slug: 'total-net-worth',
        description: 'Provide financial information for underwriting',
        icon: 'calculator-outline',
      },
    ],
  },
  {
    key: 'specialty-coverage',
    title: 'Specialty Coverage',
    data: [
      {
        slug: 'inland-marine-intake',
        description: 'Coverage for tools, equipment, and property in transit',
        icon: 'boat-outline',
      },
      {
        slug: 'pollution-liability-intake',
        description: 'Coverage for pollution-related claims',
        icon: 'leaf-outline',
      },
      {
        slug: 'builder-risk-quote-request',
        description: 'Coverage for buildings under construction',
        icon: 'construct-outline',
      },
      {
        slug: 'professional-liability-quote-request',
        description: 'Coverage for professional errors and omissions',
        icon: 'document-lock-outline',
      },
    ],
  },
] as const;

export default function PbiaFormsScreen() {
  const handleFormPress = (item: IntakeFormItem) => {
    const selectedForm = FORM_REGISTRY_BY_SLUG[item.slug];
    if (!selectedForm) {
      Alert.alert('Form unavailable', 'Please refresh and try again.');
      return;
    }

    router.push({
      pathname: '/forms/[slug]',
      params: { slug: selectedForm.slug },
    });
  };

  return (
    <ScreenContainer includeTopInset={false} scroll={false} style={styles.screen}>
      <SectionList
        sections={INTAKE_FORM_SECTIONS}
        keyExtractor={(item, index) => `${item.slug}-${index}`}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        SectionSeparatorComponent={() => <View style={styles.sectionGap} />}
        ListHeaderComponent={
          <View style={styles.introCard}>
            <Text style={styles.introTitle}>Select A Form To Begin</Text>
            <Text style={styles.introDescription}>
              Choose the request type that best matches your coverage or service need.
            </Text>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionTitle}>{section.title}</Text>
        )}
        renderItem={({ item }) => {
          const form = FORM_REGISTRY_BY_SLUG[item.slug];
          const iconName = item.icon ?? 'document-text-outline';

          return (
            <Pressable
              onPress={() => handleFormPress(item)}
              android_ripple={{ color: '#E6EFEA' }}
              style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}>
              <View style={styles.iconContainer}>
                <Ionicons name={iconName} size={18} color={theme.colors.primaryDeep} />
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.title}>{form?.title ?? item.slug}</Text>
                {item.description ? <Text style={styles.subtitle}>{item.description}</Text> : null}
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textSubtle} />
            </Pressable>
          );
        }}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingTop: 0,
    gap: 0,
  },
  listContent: {
    paddingTop: theme.spacing.xs,
    paddingBottom: theme.spacing.xxl,
  },
  introCard: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
    gap: 4,
    ...theme.shadows.surface,
  },
  introTitle: {
    ...theme.typography.label,
    color: theme.colors.primaryDeep,
  },
  introDescription: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
  },
  sectionTitle: {
    ...theme.typography.label,
    color: theme.colors.textStrong,
    marginBottom: theme.spacing.sm,
  },
  sectionGap: {
    height: theme.spacing.lg,
  },
  card: {
    minHeight: 72,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    ...theme.shadows.surface,
  },
  pressed: {
    transform: [{ scale: 0.995 }],
    opacity: 0.95,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceTint,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  textContainer: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    ...theme.typography.body,
    color: theme.colors.textStrong,
    fontWeight: '700',
    flexShrink: 1,
  },
  subtitle: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
    flexShrink: 1,
  },
});
