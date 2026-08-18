import * as ImagePicker from 'expo-image-picker';
import { Redirect } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppInput } from '@/components/app-input';
import { BusinessCardBrandingEditor } from '@/components/digital-card/business-card-branding-editor';
import { DigitalCardPreview } from '@/components/digital-card/digital-card-preview';
import { DigitalCardShareActions } from '@/components/digital-card/digital-card-share-actions';
import { DigitalCardStep, DigitalCardStepper } from '@/components/digital-card/digital-card-stepper';
import { LoadingState } from '@/components/loading-state';
import { ScreenContainer } from '@/components/screen-container';
import { theme } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useDigitalCard } from '@/context/digital-card-context';
import { usePolicies } from '@/context/policies-context';
import { useDigitalCardDraft } from '@/hooks/use-digital-card-draft';
import { isDigitalCardBackendConfigured } from '@/services/digital-card-api';
import type { DigitalBusinessCard, DigitalCardDraft, DigitalCardPrimaryAction } from '@/types/digital-card';
import { getDigitalCardPrimaryColor } from '@/utils/digital-card-branding';
import { buildDigitalCardInsuranceSummary } from '@/utils/digital-card-insurance';
import { buildDigitalCardPublicUrl, isDigitalCardPublishingConfigured } from '@/utils/digital-card-links';
import {
  buildInitialDigitalCardDraft,
  getDigitalCardBioCharactersRemaining,
  getDigitalCardOwnerId,
  validateDigitalCardDraft,
} from '@/utils/digital-card-validation';

const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024;
const VALID_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function draftFromCard(card: DigitalBusinessCard): DigitalCardDraft {
  return {
    slug: card.slug,
    templateId: 'insurepro-classic',
    status: card.status,
    localImageUri: null,
    imageUrl: card.imageUrl,
    fullName: card.fullName,
    title: card.title,
    company: card.company,
    phone: card.phone,
    email: card.email,
    website: card.website,
    bio: card.bio,
    serviceArea: card.serviceArea,
    primaryAction: card.primaryAction,
    primaryColor: card.primaryColor,
    cslbLicenseNumber: card.cslbLicenseNumber,
    licenseClassification: card.licenseClassification,
    insuranceSummary: card.insuranceSummary,
  };
}

function Section({ title, children }: React.PropsWithChildren<{ title: string }>) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function PrimaryActionPicker({
  value,
  onChange,
}: {
  value: DigitalCardPrimaryAction;
  onChange: (value: DigitalCardPrimaryAction) => void;
}) {
  const options: Array<{ value: DigitalCardPrimaryAction; label: string }> = [
    { value: 'quote', label: 'Request a quote' },
    { value: 'call', label: 'Call now' },
    { value: 'email', label: 'Send an email' },
  ];

  return (
    <View style={styles.segmentedGroup}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.segment,
              selected ? styles.segmentSelected : null,
              pressed ? styles.segmentPressed : null,
            ]}>
            <Text style={[styles.segmentText, selected ? styles.segmentTextSelected : null]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function DigitalCardScreen() {
  const { customer, userEmail, isAuthenticated, isLoadingAuth } = useAuth();
  const { policies, isLoadingPolicies } = usePolicies();
  const { width } = useWindowDimensions();
  const { card, isSaving, publish, update, refreshDraftStatus } = useDigitalCard();
  const [step, setStep] = useState<DigitalCardStep>(card ? 'share' : 'template');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [summaryError, setSummaryError] = useState('');
  const [imageError, setImageError] = useState('');
  const ownerId = getDigitalCardOwnerId(customer, userEmail);
  const initialDraft = useMemo(
    () => (card ? draftFromCard(card) : buildInitialDigitalCardDraft(customer, userEmail)),
    [card, customer, userEmail]
  );
  const { draft, setDraft, persistDraft, clearDraft, isHydratingDraft, hasPersistedDraft } =
    useDigitalCardDraft(ownerId, initialDraft);
  const isWideLayout = Platform.OS === 'web' && width >= 900;
  const isPublicUrlConfigured = isDigitalCardPublishingConfigured();
  const isBackendConfigured = isDigitalCardBackendConfigured();
  const publishingBlocked = !isPublicUrlConfigured || !isBackendConfigured;
  const insuranceSummary = useMemo(() => buildDigitalCardInsuranceSummary(policies), [policies]);

  useEffect(() => {
    if (card) {
      setStep('share');
      return;
    }

    if (hasPersistedDraft) {
      setStep('details');
    }
  }, [card, hasPersistedDraft]);

  if (isLoadingAuth || isHydratingDraft) {
    return (
      <ScreenContainer scroll={false}>
        <LoadingState title="Loading card" description="Preparing your digital business card." />
      </ScreenContainer>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  const updateDraft = (patch: Partial<DigitalCardDraft>) => {
    const nextDraft = { ...draft, ...patch };
    setDraft(nextDraft);
    setFieldErrors({});
    setSummaryError('');
    void persistDraft(nextDraft).then(refreshDraftStatus);
  };

  const chooseImage = async () => {
    setImageError('');

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.86,
    });

    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset) return;

    if (asset.fileSize && asset.fileSize > MAX_IMAGE_SIZE_BYTES) {
      setImageError('Choose an image smaller than 2 MB.');
      return;
    }

    if (asset.mimeType && !VALID_IMAGE_TYPES.has(asset.mimeType)) {
      setImageError('Choose a JPEG, PNG, or WebP image.');
      return;
    }

    updateDraft({
      localImageUri: asset.uri,
      imageUrl: asset.uri,
    });
  };

  const resetBranding = () => {
    updateDraft({
      localImageUri: null,
      imageUrl: null,
      primaryColor: getDigitalCardPrimaryColor(null),
    });
    setImageError('');
  };

  const cancelEdits = () => {
    const nextDraft = card ? draftFromCard(card) : initialDraft;
    setDraft(nextDraft);
    setFieldErrors({});
    setSummaryError('');
    setImageError('');
    void persistDraft(nextDraft).then(refreshDraftStatus);
    setStep(card ? 'share' : 'template');
  };

  const saveCard = async () => {
    const result = validateDigitalCardDraft(draft);
    setFieldErrors(result.fieldErrors);
    setSummaryError(result.summaryError ?? '');

    if (!result.isValid) return;

    if (!isBackendConfigured) {
      setSummaryError('Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY before publishing cards.');
      return;
    }

    if (!isPublicUrlConfigured) {
      setSummaryError('Set EXPO_PUBLIC_DIGITAL_CARD_BASE_URL to an HTTPS origin before publishing cards.');
      return;
    }

    const publishDraft = {
      ...result.draft,
      insuranceSummary,
    };
    const nextCard = card ? await update(publishDraft) : await publish(publishDraft);
    await clearDraft();
    await refreshDraftStatus();
    setDraft(draftFromCard(nextCard));
    setStep('share');
  };

  const templateStep = (
    <View style={styles.cardShell}>
      <View style={styles.copyStack}>
        <Text style={styles.eyebrow}>Recommended template</Text>
        <Text style={styles.heading}>Insure Pro Classic</Text>
        <Text style={styles.bodyText}>
          A mobile-optimized card with direct contact actions, branded trust cues, and QR sharing.
        </Text>
        <View style={styles.benefitList}>
          <Text style={styles.benefitText}>Mobile optimized</Text>
          <Text style={styles.benefitText}>Direct call, email, and website actions</Text>
          <Text style={styles.benefitText}>QR-ready public link</Text>
        </View>
        <AppButton label="Use this template" onPress={() => setStep('details')} />
      </View>
      <DigitalCardPreview card={draft} />
    </View>
  );

  const detailsForm = (
    <View style={styles.formStack}>
      {summaryError ? <Text style={styles.errorText}>{summaryError}</Text> : null}
      {!isPublicUrlConfigured || !isBackendConfigured ? (
        <Text style={styles.helperWarning}>
          Draft editing works now. Publishing requires Supabase env values and an HTTPS
          EXPO_PUBLIC_DIGITAL_CARD_BASE_URL.
        </Text>
      ) : null}

      <Section title="Branding">
        <BusinessCardBrandingEditor
          imageUri={draft.localImageUri || draft.imageUrl}
          primaryColor={draft.primaryColor}
          colorError={fieldErrors.primaryColor}
          imageError={imageError}
          onChooseLogo={chooseImage}
          onRemoveLogo={() => updateDraft({ localImageUri: null, imageUrl: null })}
          onChangeColor={(primaryColor) => updateDraft({ primaryColor })}
          onResetBranding={resetBranding}
        />
      </Section>

      <Section title="Identity">
        <AppInput
          label="Full name"
          value={draft.fullName}
          onChangeText={(value) => updateDraft({ fullName: value })}
          leftIcon="person-outline"
          errorText={fieldErrors.fullName}
        />
        <AppInput
          label="Professional title"
          value={draft.title}
          onChangeText={(value) => updateDraft({ title: value })}
          leftIcon="briefcase-outline"
          placeholder="General contractor"
        />
        <AppInput
          label="Company name"
          value={draft.company}
          onChangeText={(value) => updateDraft({ company: value })}
          leftIcon="business-outline"
          errorText={fieldErrors.company}
        />
        <AppInput
          label="Short bio"
          value={draft.bio}
          onChangeText={(value) => updateDraft({ bio: value })}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          style={styles.multilineInput}
          errorText={fieldErrors.bio}
          helperText={`${getDigitalCardBioCharactersRemaining(draft.bio)} characters remaining`}
        />
      </Section>

      <Section title="Contact and action">
        <AppInput
          label="Phone"
          value={draft.phone}
          onChangeText={(value) => updateDraft({ phone: value })}
          keyboardType="phone-pad"
          leftIcon="call-outline"
          errorText={fieldErrors.phone}
        />
        <AppInput
          label="Email"
          value={draft.email}
          onChangeText={(value) => updateDraft({ email: value })}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          leftIcon="mail-outline"
          errorText={fieldErrors.email}
        />
        <AppInput
          label="Website"
          value={draft.website}
          onChangeText={(value) => updateDraft({ website: value })}
          keyboardType="url"
          autoCapitalize="none"
          autoCorrect={false}
          leftIcon="globe-outline"
          placeholder="https://example.com"
          errorText={fieldErrors.website}
        />
        <AppInput
          label="Service area"
          value={draft.serviceArea}
          onChangeText={(value) => updateDraft({ serviceArea: value })}
          leftIcon="location-outline"
          placeholder="Los Angeles, CA"
        />
        <AppInput
          label="CSLB license number"
          value={draft.cslbLicenseNumber}
          onChangeText={(value) => updateDraft({ cslbLicenseNumber: value })}
          leftIcon="ribbon-outline"
          placeholder="123456"
        />
        <AppInput
          label="License classification"
          value={draft.licenseClassification}
          onChangeText={(value) => updateDraft({ licenseClassification: value })}
          leftIcon="construct-outline"
          placeholder="B - General Building"
        />
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Primary action</Text>
          <PrimaryActionPicker
            value={draft.primaryAction}
            onChange={(primaryAction) => updateDraft({ primaryAction })}
          />
        </View>
      </Section>

      <Section title="Insurance shown publicly">
        {isLoadingPolicies ? (
          <Text style={styles.insuranceMutedText}>Loading active policy details...</Text>
        ) : insuranceSummary.length > 0 ? (
          <>
            <Text style={styles.insuranceMutedText}>
              These active policy lines will appear on the public card. Policy numbers, premiums, and carriers stay private.
            </Text>
            <View style={styles.insuranceList}>
              {insuranceSummary.map((summary) => (
                <View key={summary.label} style={styles.insuranceRow}>
                  <Text style={styles.insuranceLabel}>{summary.label}</Text>
                  <Text style={styles.insuranceDetail}>{summary.detail}</Text>
                </View>
              ))}
            </View>
          </>
        ) : (
          <Text style={styles.insuranceMutedText}>
            No active policy lines are available to show on this public card.
          </Text>
        )}
      </Section>

      <View style={styles.stickyActions}>
        <AppButton
          label={card ? 'Save updates' : 'Save and create card'}
          onPress={saveCard}
          loading={isSaving}
          disabled={publishingBlocked}
        />
        <AppButton label={card ? 'Cancel edits' : 'Reset setup'} variant="ghost" onPress={cancelEdits} />
      </View>
    </View>
  );

  const detailsStep = (
    <View style={[styles.detailsLayout, isWideLayout ? styles.detailsLayoutWide : null]}>
      <View style={styles.detailsColumn}>{detailsForm}</View>
      <View style={styles.previewColumn}>
        <Text style={styles.previewTitle}>Live preview</Text>
        <DigitalCardPreview card={draft} />
      </View>
    </View>
  );

  const shareStep = card ? (
    <View style={styles.shareLayout}>
      <View style={styles.cardShell}>
        <View style={styles.copyStack}>
          <Text style={styles.eyebrow}>Published</Text>
          <Text style={styles.heading}>Your card is live</Text>
          <Text style={styles.bodyText}>Clients can scan the QR code or open the public link without signing in.</Text>
          <Text style={styles.updatedText}>Last updated {new Date(card.updatedAt).toLocaleString()}</Text>
        </View>
        <DigitalCardPreview card={card} />
      </View>
      <DigitalCardShareActions
        publicUrl={buildDigitalCardPublicUrl(card.slug)}
        slug={card.slug}
        onEdit={() => setStep('details')}
      />
    </View>
  ) : null;

  return (
    <ScreenContainer keyboardAware maxContentWidth={isWideLayout ? 1080 : theme.layout.maxContentWidth}>
      <DigitalCardStepper currentStep={step} />
      {step === 'template' ? templateStep : null}
      {step === 'details' ? detailsStep : null}
      {step === 'share' ? shareStep : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  cardShell: {
    gap: theme.spacing.lg,
  },
  copyStack: {
    gap: theme.spacing.sm,
  },
  eyebrow: {
    ...theme.typography.caption,
    color: theme.colors.primary,
    textTransform: 'uppercase',
  },
  heading: {
    ...theme.typography.h1,
    color: theme.colors.textStrong,
  },
  bodyText: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
  },
  benefitList: {
    gap: theme.spacing.xs,
  },
  benefitText: {
    ...theme.typography.bodySmall,
    color: theme.colors.textStrong,
    fontWeight: '700',
  },
  detailsLayout: {
    gap: theme.spacing.lg,
  },
  detailsLayoutWide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  detailsColumn: {
    flex: 1.1,
    minWidth: 0,
  },
  previewColumn: {
    flex: 0.9,
    minWidth: 320,
    gap: theme.spacing.sm,
  },
  previewTitle: {
    ...theme.typography.title,
    color: theme.colors.textStrong,
  },
  formStack: {
    gap: theme.spacing.md,
  },
  section: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
    ...theme.shadows.surface,
  },
  sectionTitle: {
    ...theme.typography.title,
    color: theme.colors.textStrong,
  },
  helperWarning: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: '#EAD8A4',
    backgroundColor: '#FFF8E7',
    padding: theme.spacing.md,
  },
  errorText: {
    ...theme.typography.bodySmall,
    color: theme.colors.danger,
  },
  multilineInput: {
    minHeight: 96,
  },
  fieldGroup: {
    gap: theme.spacing.xs,
  },
  fieldLabel: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    letterSpacing: 0.35,
    textTransform: 'uppercase',
  },
  segmentedGroup: {
    gap: theme.spacing.xs,
  },
  segment: {
    minHeight: 46,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.md,
  },
  segmentSelected: {
    borderColor: theme.colors.primaryAccent,
    backgroundColor: theme.colors.surfaceTint,
  },
  segmentPressed: {
    opacity: 0.86,
  },
  segmentText: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
    fontWeight: '700',
  },
  segmentTextSelected: {
    color: theme.colors.primaryDeep,
  },
  insuranceMutedText: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
  },
  insuranceList: {
    gap: theme.spacing.xs,
  },
  insuranceRow: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceTint,
    padding: theme.spacing.sm,
    gap: theme.spacing.xxs,
  },
  insuranceLabel: {
    ...theme.typography.bodySmall,
    color: theme.colors.textStrong,
    fontWeight: '800',
  },
  insuranceDetail: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  stickyActions: {
    gap: theme.spacing.xs,
  },
  shareLayout: {
    gap: theme.spacing.lg,
  },
  updatedText: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
  },
});
