import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandMark } from '@/components/brand-mark';
import { ScreenContainer } from '@/components/screen-container';
import { SectionHeader } from '@/components/section-header';
import { theme } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useCompanyProfile } from '@/hooks/use-company-profile';
import type { CompanyStatusChip } from '@/hooks/use-company-profile';
import { fetchInsuredAgentsByInsuredDatabaseId, InsuredAgentRecord } from '@/services/agent-api';
import { getPortalConfig } from '@/services/portal-config';
import { getNameFromCustomer } from '@/utils/format';
import {
  buildEmailLink,
  buildPhoneLink,
  buildSmsLink,
  openInAppBrowser,
  openExternalLink,
} from '@/utils/external-actions';

const AGENT_AVATARS: Record<string, number> = {
  ariesapcar: require('../../../assets/images/ariesapcar.jpg'),
  cindycardenas: require('../../../assets/images/cindycardenas.jpg'),
  markflorea: require('../../../assets/images/markflorea.jpg'),
  patricianegrete: require('../../../assets/images/patricianegrete.jpg'),
};

const AGENT_SCHEDULE_URLS: Record<string, string> = {
  markflorea:
    'https://calendar.google.com/calendar/u/0/appointments/schedules/AcZssZ1jwBkqzWMh8KNkeYgXs66QqJzwag1hzqJ5KO_boJ9lah8vHC1LZ3Fp41C_eZsvPeA-WOLBOE3r',
  cindycardenas:
    'https://calendar.google.com/calendar/u/0/appointments/schedules/AcZssZ1oK1hjqYp_WkUOBm-58aPNYhpFwwQg1F_iOOP7bA--257yuIJTuoWT28ulDbt3knIav0xOnro8',
  ariesapcar:
    'https://calendar.google.com/calendar/u/0/appointments/schedules/AcZssZ3UivKqDecpg4qEVEQ5S7mbzBK1nLV6ER9eLHO40CptAYmZJyuhnXlhCI62H5o1tRqPLN687awC',
  patricianegrete:
    'https://calendar.google.com/calendar/u/0/appointments/schedules/AcZssZ3Pew7a9naojBMlv07Dp8WaUnR_TEvCFmj-QCKHtKjNumC6rVdOxxjvpqbaj4et5UeeUGaIhprL',
};

const AGENT_AVATAR_IMAGE_ADJUSTMENTS: Record<string, { scale: number; translateY: number }> = {
  ariesapcar: { scale: 1.14, translateY: 3 },
};

const DASHBOARD_SKELETON_MIN_MS = 3000;

const COMPANY_STATUS_CHIP_STYLES: Record<
  CompanyStatusChip,
  { backgroundColor: string; textColor: string }
> = {
  Active: {
    backgroundColor: '#EBF9F1',
    textColor: theme.colors.success,
  },
  Current: {
    backgroundColor: '#E9F2FF',
    textColor: '#295E9C',
  },
  Inactive: {
    backgroundColor: theme.colors.dangerSoft,
    textColor: theme.colors.danger,
  },
};

type AgentAction = {
  id: 'contact' | 'schedule' | 'email' | 'sms';
  label: string;
  meta: string;
  icon: 'call-outline' | 'calendar-outline' | 'mail-outline' | 'chatbubble-ellipses-outline';
  target: string | null;
  unavailableMessage: string;
};

function getInitials(value: string) {
  const parts = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (parts.length === 0) return 'AG';
  return parts.map((part) => part.charAt(0).toUpperCase()).join('');
}

function normalizeText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function toAvatarKey(value: string) {
  return value.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
}

function lookupSummaryValue(
  summaryRows: Array<{ label: string; value: string }>,
  labels: string[]
) {
  const matches = labels.map((entry) => entry.toLowerCase());
  return (
    summaryRows.find((row) => matches.includes(row.label.trim().toLowerCase()))?.value ??
    'Not available'
  );
}

function DashboardSkeleton({
  dashboardBottomPadding,
  showHeaderBrandMark,
  isDesktopLayout,
}: {
  dashboardBottomPadding: number;
  showHeaderBrandMark: boolean;
  isDesktopLayout: boolean;
}) {
  if (isDesktopLayout) {
    return (
      <ScreenContainer
        includeTopInset={false}
        contentContainerStyle={styles.desktopScreenContent}>
        <View style={styles.desktopSummaryHeader}>
          <View style={styles.desktopSummaryIdentity}>
            <View style={styles.desktopAccountAvatar}>
              <View style={[styles.skeletonBlock, styles.skeletonAvatarInitials]} />
            </View>
            <View style={styles.desktopIdentityCopy}>
              <View style={[styles.skeletonBlock, styles.skeletonLabel]} />
              <View style={[styles.skeletonBlock, styles.skeletonLineMedium]} />
              <View style={[styles.skeletonBlock, styles.skeletonLineWide]} />
            </View>
          </View>
        </View>

        <View style={styles.desktopGrid}>
          <View style={styles.desktopMainColumn}>
            <View style={styles.card}>
              <SectionHeader title="Company Information" subtitle="License snapshot and compliance status" />
              <View style={styles.desktopSnapshotGrid}>
                {Array.from({ length: 4 }).map((_, index) => (
                  <View key={`snapshot-${index}`} style={styles.desktopSnapshotItem}>
                    <View style={[styles.skeletonBlock, styles.skeletonLineShort]} />
                    <View style={[styles.skeletonBlock, styles.skeletonLineMedium]} />
                  </View>
                ))}
              </View>
              <View style={[styles.skeletonBlock, styles.skeletonLineWide]} />
              <View style={styles.companyActions}>
                <View style={[styles.skeletonButton, styles.skeletonButtonPrimary]} />
                <View style={styles.skeletonButton} />
              </View>
            </View>

            <View style={styles.card}>
              <SectionHeader title="Workspace" subtitle="Forms, notes, tasks, and related details" />
              <View style={[styles.skeletonBlock, styles.skeletonLineWide]} />
              <View style={[styles.skeletonBlock, styles.skeletonLineMedium]} />
            </View>
          </View>

          <View style={styles.desktopSideColumn}>
            <View style={styles.card}>
              <SectionHeader title="Assigned Agent" subtitle="Support contact for your account" />
              <View style={styles.agentTopRow}>
                <View style={styles.skeletonAvatar} />
                <View style={styles.agentCopy}>
                  <View style={[styles.skeletonBlock, styles.skeletonLineMedium]} />
                  <View style={[styles.skeletonBlock, styles.skeletonLineWide]} />
                  <View style={[styles.skeletonBlock, styles.skeletonLineWide]} />
                </View>
              </View>
              <View style={styles.desktopActionList}>
                {Array.from({ length: 4 }).map((_, index) => (
                  <View key={`action-${index}`} style={styles.desktopActionRow}>
                    <View style={[styles.skeletonBlock, styles.skeletonIcon]} />
                    <View style={styles.desktopActionCopy}>
                      <View style={[styles.skeletonBlock, styles.skeletonLineMedium]} />
                      <View style={[styles.skeletonBlock, styles.skeletonLineShort]} />
                    </View>
                  </View>
                ))}
              </View>
              <View style={[styles.skeletonBlock, styles.skeletonLineMedium]} />
            </View>

            <View style={styles.card}>
              <SectionHeader title="Quick actions" subtitle="Portal shortcuts" />
              <View style={[styles.skeletonButton, styles.skeletonButtonPrimary]} />
              <View style={styles.skeletonButton} />
            </View>
          </View>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer contentContainerStyle={{ paddingBottom: dashboardBottomPadding }}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          {showHeaderBrandMark ? <BrandMark /> : null}
          <View style={styles.accountCard}>
            <View style={[styles.skeletonBlock, styles.skeletonLabel]} />
            <View style={[styles.skeletonBlock, styles.skeletonHeadline]} />
            <View style={[styles.skeletonBlock, styles.skeletonLineWide]} />
          </View>
        </View>
      </View>

      <SectionHeader title="Your Agent" />
      <View style={styles.card}>
        <View style={styles.agentTopRow}>
          <View style={styles.skeletonAvatar} />
          <View style={styles.agentCopy}>
            <View style={[styles.skeletonBlock, styles.skeletonLineMedium]} />
            <View style={[styles.skeletonBlock, styles.skeletonLineWide]} />
            <View style={[styles.skeletonBlock, styles.skeletonLineWide]} />
          </View>
        </View>
        <View style={styles.actionGrid}>
          {Array.from({ length: 4 }).map((_, index) => (
            <View key={index} style={[styles.actionCard, styles.skeletonCard]}>
              <View style={[styles.skeletonBlock, styles.skeletonIcon]} />
              <View style={[styles.skeletonBlock, styles.skeletonLineMedium]} />
              <View style={[styles.skeletonBlock, styles.skeletonLineShort]} />
            </View>
          ))}
        </View>
      </View>

      <SectionHeader title="Company Information" subtitle="License snapshot and compliance status" />
      <View style={styles.card}>
        {Array.from({ length: 3 }).map((_, index) => (
          <View key={index} style={styles.infoRow}>
            <View style={[styles.skeletonBlock, styles.skeletonLineShort]} />
            <View style={[styles.skeletonBlock, styles.skeletonLineMedium]} />
          </View>
        ))}
        <View style={styles.companyActions}>
          <View style={[styles.skeletonButton, styles.skeletonButtonPrimary]} />
          <View style={styles.skeletonButton} />
        </View>
      </View>

      <SectionHeader title="Actions" />
      <View style={styles.card}>
        <View style={[styles.skeletonButton, styles.skeletonButtonPrimary]} />
        <View style={styles.skeletonButton} />
      </View>
    </ScreenContainer>
  );
}

type DashboardScreenProps = {
  includeTabBarPadding?: boolean;
  showHeaderBrandMark?: boolean;
  isDesktopLayout?: boolean;
};

export default function DashboardScreen({
  includeTabBarPadding = true,
  showHeaderBrandMark = true,
  isDesktopLayout = false,
}: DashboardScreenProps) {
  const insets = useSafeAreaInsets();
  const { customer, userEmail } = useAuth();
  const portalConfig = useMemo(() => getPortalConfig(), []);
  const [agent, setAgent] = useState<InsuredAgentRecord | null>(null);
  const [isLoadingAgent, setIsLoadingAgent] = useState(false);
  const [agentLookupNotice, setAgentLookupNotice] = useState<string | null>(null);
  const [isMinimumSkeletonVisible, setIsMinimumSkeletonVisible] = useState(true);
  const { isLoadingCompany, companyLookupNotice, cslbLink, summaryRows, statusChips, statusFallbackText } =
    useCompanyProfile();
  // `/insuredAgents?insuredId=` expects the insured *database* id (UUID from `databaseId`).
  const insuredLookupId = useMemo(() => {
    const insuredDatabaseId = customer?.databaseId?.trim();
    if (insuredDatabaseId) return insuredDatabaseId;
    return customer?.insuredId?.trim() || '';
  }, [customer?.databaseId, customer?.insuredId]);

  useEffect(() => {
    let isMounted = true;

    const hydrateAgent = async () => {
      if (!insuredLookupId) {
        setAgent(null);
        setAgentLookupNotice(null);
        setIsLoadingAgent(false);
        return;
      }

      setIsLoadingAgent(true);
      setAgentLookupNotice(null);
      try {
        const agents = await fetchInsuredAgentsByInsuredDatabaseId(insuredLookupId);
        if (!isMounted) return;

        const primaryAgent = agents[0] ?? null;
        setAgent(primaryAgent);
        if (!primaryAgent) {
          setAgentLookupNotice('No assigned agent found from API. Showing configured fallback.');
        }
      } catch {
        if (!isMounted) return;
        setAgent(null);
        setAgentLookupNotice('Unable to load agent from API. Showing configured fallback.');
      } finally {
        if (isMounted) {
          setIsLoadingAgent(false);
        }
      }
    };

    void hydrateAgent();

    return () => {
      isMounted = false;
    };
  }, [insuredLookupId]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setIsMinimumSkeletonVisible(false);
    }, DASHBOARD_SKELETON_MIN_MS);

    return () => {
      clearTimeout(timeoutId);
    };
  }, []);

  const resolvedAgent = useMemo(() => {
    const fullName = [normalizeText(agent?.firstName), normalizeText(agent?.lastName)]
      .filter((entry): entry is string => Boolean(entry))
      .join(' ');

    return {
      name: fullName || portalConfig.agent.name,
      phone:
        normalizeText(agent?.phone) ??
        normalizeText(agent?.cellPhone) ??
        normalizeText(portalConfig.agent.phone),
      email: normalizeText(agent?.email) ?? normalizeText(portalConfig.agent.email),
      smsPhone:
        normalizeText(agent?.cellPhone) ??
        normalizeText(agent?.phone) ??
        normalizeText(portalConfig.agent.smsPhone),
    };
  }, [
    agent?.cellPhone,
    agent?.email,
    agent?.firstName,
    agent?.lastName,
    agent?.phone,
    portalConfig.agent.email,
    portalConfig.agent.name,
    portalConfig.agent.phone,
    portalConfig.agent.smsPhone,
  ]);
  const avatarSource = useMemo(
    () => AGENT_AVATARS[toAvatarKey(resolvedAgent.name)] ?? null,
    [resolvedAgent.name]
  );
  const avatarImageAdjustment = useMemo(
    () => AGENT_AVATAR_IMAGE_ADJUSTMENTS[toAvatarKey(resolvedAgent.name)] ?? null,
    [resolvedAgent.name]
  );
  const resolvedScheduleUrl = useMemo(
    () => AGENT_SCHEDULE_URLS[toAvatarKey(resolvedAgent.name)] ?? portalConfig.agent.scheduleUrl,
    [portalConfig.agent.scheduleUrl, resolvedAgent.name]
  );

  const agentActions = useMemo<AgentAction[]>(
    () => [
      {
        id: 'contact',
        label: 'Contact Agent',
        meta: 'Phone',
        icon: 'call-outline' as const,
        target: buildPhoneLink(resolvedAgent.phone),
        unavailableMessage: 'Agent phone number is not configured yet.',
      },
      {
        id: 'schedule',
        label: 'Schedule',
        meta: 'Calendar',
        icon: 'calendar-outline' as const,
        target: resolvedScheduleUrl,
        unavailableMessage: 'Scheduling link is not configured yet.',
      },
      {
        id: 'email',
        label: 'Email',
        meta: 'Google',
        icon: 'mail-outline' as const,
        target: buildEmailLink(resolvedAgent.email),
        unavailableMessage: 'Agent email is not configured yet.',
      },
      {
        id: 'sms',
        label: 'SMS',
        meta: 'Text',
        icon: 'chatbubble-ellipses-outline' as const,
        target: buildSmsLink(resolvedAgent.smsPhone),
        unavailableMessage: 'Agent SMS number is not configured yet.',
      },
    ],
    [resolvedAgent.email, resolvedAgent.phone, resolvedAgent.smsPhone, resolvedScheduleUrl]
  );

  const desktopActionOrder = useMemo(
    () =>
      ['contact', 'email', 'sms', 'schedule']
        .map((id) => agentActions.find((entry) => entry.id === id))
        .filter((entry): entry is AgentAction => Boolean(entry)),
    [agentActions]
  );

  const openAction = async (target: string | null, unavailableMessage: string) => {
    const result = await openExternalLink(target, unavailableMessage);
    if (!result.ok) {
      Alert.alert('Action unavailable', result.message ?? unavailableMessage);
    }
  };
  const openInAppAction = async (target: string | null, unavailableMessage: string) => {
    const result = await openInAppBrowser(target, unavailableMessage);
    if (!result.ok) {
      Alert.alert('Action unavailable', result.message ?? unavailableMessage);
    }
  };
  const dashboardBottomPadding = useMemo(
    () => insets.bottom + (includeTabBarPadding ? 116 : 24),
    [includeTabBarPadding, insets.bottom]
  );
  const showDashboardSkeleton = isMinimumSkeletonVisible || isLoadingAgent || isLoadingCompany;
  const accountHolderName = getNameFromCustomer(customer, userEmail);
  const accountHolderEmail = customer?.email ?? userEmail ?? 'member@email.com';
  const accountHolderInitials = getInitials(accountHolderName);
  const licenseNumber = lookupSummaryValue(summaryRows, ['license #', 'license']);
  const expiration = lookupSummaryValue(summaryRows, ['expiration']);
  const complianceState = lookupSummaryValue(summaryRows, ['current', 'compliance', 'current state']);

  if (showDashboardSkeleton) {
    return (
      <DashboardSkeleton
        dashboardBottomPadding={dashboardBottomPadding}
        showHeaderBrandMark={showHeaderBrandMark}
        isDesktopLayout={isDesktopLayout}
      />
    );
  }

  if (isDesktopLayout) {
    return (
      <ScreenContainer
        includeTopInset={false}
        contentContainerStyle={styles.desktopScreenContent}>
        <View style={styles.desktopSummaryHeader}>
          <View style={styles.desktopSummaryIdentity}>
            <View style={styles.desktopAccountAvatar}>
              <Text style={styles.avatarText}>{accountHolderInitials}</Text>
            </View>
            <View style={styles.desktopIdentityCopy}>
              <Text style={styles.accountLabel}>Account holder</Text>
              <Text style={styles.desktopAccountName}>{accountHolderName}</Text>
              <Text style={styles.accountEmail}>{accountHolderEmail}</Text>
            </View>
          </View>
        </View>

        <View style={styles.desktopGrid}>
          <View style={styles.desktopMainColumn}>
            <View style={styles.card}>
              <SectionHeader title="Company Information" subtitle="License snapshot and compliance status" />
              <View style={styles.desktopSnapshotGrid}>
                <View style={styles.desktopSnapshotItem}>
                  <Text style={styles.desktopSnapshotLabel}>License #</Text>
                  <Text style={styles.desktopSnapshotValue}>{licenseNumber}</Text>
                </View>
                <View style={styles.desktopSnapshotItem}>
                  <Text style={styles.desktopSnapshotLabel}>Status</Text>
                  {statusChips.length > 0 ? (
                    <View style={styles.desktopChipRow}>
                      {statusChips.map((chip) => {
                        const chipStyle = COMPANY_STATUS_CHIP_STYLES[chip];
                        return (
                          <View
                            key={chip}
                            style={[styles.statusChip, { backgroundColor: chipStyle.backgroundColor }]}>
                            <Text style={[styles.statusChipText, { color: chipStyle.textColor }]}>{chip}</Text>
                          </View>
                        );
                      })}
                    </View>
                  ) : (
                    <Text style={styles.desktopSnapshotValue}>{statusFallbackText}</Text>
                  )}
                </View>
                <View style={styles.desktopSnapshotItem}>
                  <Text style={styles.desktopSnapshotLabel}>Compliance</Text>
                  <Text style={styles.desktopSnapshotValue}>{complianceState}</Text>
                </View>
                <View style={styles.desktopSnapshotItem}>
                  <Text style={styles.desktopSnapshotLabel}>Expiration</Text>
                  <Text style={styles.desktopSnapshotValue}>{expiration}</Text>
                </View>
              </View>
              {isLoadingCompany ? <Text style={styles.agentHint}>Loading CSLB details...</Text> : null}
              {companyLookupNotice ? <Text style={styles.agentHint}>{companyLookupNotice}</Text> : null}
              <View style={styles.companyActions}>
                <Pressable
                  onPress={() => {
                    router.push('/company');
                  }}
                  style={({ pressed }) => [styles.detailLinkButton, pressed ? styles.pressed : null]}>
                  <Text style={styles.detailLinkButtonText}>View details</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    void openInAppAction(cslbLink, 'CSLB link is not available yet.');
                  }}
                  disabled={!cslbLink}
                  style={({ pressed }) => [
                    styles.linkButton,
                    !cslbLink ? styles.actionCardDisabled : null,
                    pressed && cslbLink ? styles.pressed : null,
                  ]}>
                  <Text style={styles.linkButtonText}>View on CSLB</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.card}>
              <SectionHeader title="Workspace" subtitle="Forms, notes, tasks, and related details" />
              <Text style={styles.agentHint}>
                Continue to use All Intake Forms and Company Details while additional dashboard sections are added.
              </Text>
            </View>
          </View>

          <View style={styles.desktopSideColumn}>
            <View style={styles.card}>
              <SectionHeader title="Assigned Agent" subtitle="Support contact for your account" />
              <View style={styles.agentTopRow}>
                <View style={styles.avatar}>
                  {avatarSource ? (
                    <Image
                      source={avatarSource}
                      style={[
                        styles.avatarImage,
                        avatarImageAdjustment
                          ? {
                              transform: [
                                { scale: avatarImageAdjustment.scale },
                                { translateY: avatarImageAdjustment.translateY },
                              ],
                            }
                          : null,
                      ]}
                      resizeMode="cover"
                    />
                  ) : (
                    <Text style={styles.avatarText}>{getInitials(resolvedAgent.name)}</Text>
                  )}
                </View>
                <View style={styles.agentCopy}>
                  <Text style={styles.agentName}>{resolvedAgent.name}</Text>
                  <Text style={styles.agentMeta}>Phone: {resolvedAgent.phone ?? 'Not available'}</Text>
                  <Text style={styles.agentMeta}>Email: {resolvedAgent.email ?? 'Not available'}</Text>
                </View>
              </View>
              <View style={styles.desktopActionList}>
                {desktopActionOrder.map((action) => {
                  const disabled = !action.target;
                  return (
                    <Pressable
                      key={action.id}
                      onPress={() => {
                        if (action.id === 'schedule') {
                          void openInAppAction(action.target, action.unavailableMessage);
                          return;
                        }
                        void openAction(action.target, action.unavailableMessage);
                      }}
                      disabled={disabled}
                      style={({ pressed }) => [
                        styles.desktopActionRow,
                        disabled ? styles.actionCardDisabled : null,
                        pressed && !disabled ? styles.pressed : null,
                      ]}>
                      <Ionicons name={action.icon} size={16} color={theme.colors.primary} />
                      <View style={styles.desktopActionCopy}>
                        <Text style={styles.actionTitle}>{action.label}</Text>
                        <Text style={styles.actionMeta}>{action.meta}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
              {isLoadingAgent ? <Text style={styles.agentHint}>Loading assigned agent...</Text> : null}
              {agentLookupNotice ? <Text style={styles.agentHint}>{agentLookupNotice}</Text> : null}
            </View>

            <View style={styles.card}>
              <SectionHeader title="Quick actions" subtitle="Portal shortcuts" />
              <Pressable
                onPress={() => {
                  router.push('/forms');
                }}
                style={({ pressed }) => [styles.primaryAction, pressed ? styles.pressed : null]}>
                <Text style={styles.primaryActionText}>All Intake Forms</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  void openAction(portalConfig.actions.issueCoiUrl, 'Issue COI link is not configured yet.');
                }}
                disabled={!portalConfig.actions.issueCoiUrl}
                style={({ pressed }) => [
                  styles.secondaryAction,
                  !portalConfig.actions.issueCoiUrl ? styles.actionCardDisabled : null,
                  pressed && portalConfig.actions.issueCoiUrl ? styles.pressed : null,
                  ]}>
                <Text style={styles.secondaryActionText}>Issue COI</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer contentContainerStyle={{ paddingBottom: dashboardBottomPadding }}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          {showHeaderBrandMark ? <BrandMark /> : null}
          <View style={styles.accountCard}>
            <Text style={styles.accountLabel}>Account holder</Text>
            <Text style={styles.accountName}>{accountHolderName}</Text>
            <Text style={styles.accountEmail}>{accountHolderEmail}</Text>
          </View>
        </View>
      </View>

      <SectionHeader title="Your Agent" />
      <View style={styles.card}>
        <View style={styles.agentTopRow}>
          <View style={styles.avatar}>
            {avatarSource ? (
              <Image
                source={avatarSource}
                style={[
                  styles.avatarImage,
                  avatarImageAdjustment
                    ? {
                        transform: [
                          { scale: avatarImageAdjustment.scale },
                          { translateY: avatarImageAdjustment.translateY },
                        ],
                      }
                    : null,
                ]}
                resizeMode="cover"
              />
            ) : (
              <Text style={styles.avatarText}>{getInitials(resolvedAgent.name)}</Text>
            )}
          </View>
          <View style={styles.agentCopy}>
            <Text style={styles.agentName}>{resolvedAgent.name}</Text>
            <Text style={styles.agentMeta}>Phone: {resolvedAgent.phone ?? 'Not available'}</Text>
            <Text style={styles.agentMeta}>Email: {resolvedAgent.email ?? 'Not available'}</Text>
          </View>
        </View>
        {isLoadingAgent ? <Text style={styles.agentHint}>Loading assigned agent...</Text> : null}
        {agentLookupNotice ? <Text style={styles.agentHint}>{agentLookupNotice}</Text> : null}

        <View style={styles.actionGrid}>
          {agentActions.map((action) => {
            const disabled = !action.target;
            return (
              <Pressable
                key={action.id}
                onPress={() => {
                  if (action.id === 'schedule') {
                    void openInAppAction(action.target, action.unavailableMessage);
                    return;
                  }
                  void openAction(action.target, action.unavailableMessage);
                }}
                disabled={disabled}
                style={({ pressed }) => [
                  styles.actionCard,
                  disabled ? styles.actionCardDisabled : null,
                  pressed && !disabled ? styles.pressed : null,
                ]}>
                <Ionicons name={action.icon} size={18} color={theme.colors.primary} />
                <Text style={styles.actionTitle}>{action.label}</Text>
                <Text style={styles.actionMeta}>{action.meta}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <SectionHeader title="Company Information" subtitle="License snapshot and compliance status" />
      <View style={styles.card}>
        {summaryRows.length > 0 ? (
          summaryRows.map((row) => (
            <View key={row.label} style={styles.infoRow}>
              <Text style={styles.infoLabel}>{row.label}</Text>
              {row.label === 'Status' ? (
                statusChips.length > 0 ? (
                  <View style={styles.statusChipRow}>
                    {statusChips.map((chip) => {
                      const chipStyle = COMPANY_STATUS_CHIP_STYLES[chip];
                      return (
                        <View
                          key={chip}
                          style={[styles.statusChip, { backgroundColor: chipStyle.backgroundColor }]}>
                          <Text style={[styles.statusChipText, { color: chipStyle.textColor }]}>{chip}</Text>
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <Text style={styles.infoValue}>{statusFallbackText}</Text>
                )
              ) : (
                <Text style={styles.infoValue}>{row.value}</Text>
              )}
            </View>
          ))
        ) : (
          <Text style={styles.agentHint}>Company summary is not available yet.</Text>
        )}
        {isLoadingCompany ? <Text style={styles.agentHint}>Loading CSLB details...</Text> : null}
        {companyLookupNotice ? <Text style={styles.agentHint}>{companyLookupNotice}</Text> : null}
        <View style={styles.companyActions}>
          <Pressable
            onPress={() => {
              router.push('/company');
            }}
            style={({ pressed }) => [styles.detailLinkButton, pressed ? styles.pressed : null]}>
            <Text style={styles.detailLinkButtonText}>View details</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              void openInAppAction(cslbLink, 'CSLB link is not available yet.');
            }}
            disabled={!cslbLink}
            style={({ pressed }) => [
              styles.linkButton,
              !cslbLink ? styles.actionCardDisabled : null,
              pressed && cslbLink ? styles.pressed : null,
            ]}>
            <Text style={styles.linkButtonText}>View on CSLB</Text>
          </Pressable>
        </View>
      </View>

      <SectionHeader title="Actions" />
      <View style={styles.card}>
        <Pressable
          onPress={() => {
            router.push('/forms');
          }}
          style={({ pressed }) => [
            styles.primaryAction,
            pressed ? styles.pressed : null,
          ]}>
          <Text style={styles.primaryActionText}>All Intake Forms</Text>
        </Pressable>

        <Pressable
          onPress={() => {
            void openAction(portalConfig.actions.issueCoiUrl, 'Issue COI link is not configured yet.');
          }}
          disabled={!portalConfig.actions.issueCoiUrl}
          style={({ pressed }) => [
            styles.secondaryAction,
            !portalConfig.actions.issueCoiUrl ? styles.actionCardDisabled : null,
            pressed && portalConfig.actions.issueCoiUrl ? styles.pressed : null,
          ]}>
          <Text style={styles.secondaryActionText}>Issue COI</Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  desktopScreenContent: {
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  desktopSummaryHeader: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    ...theme.shadows.surface,
  },
  desktopSummaryIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1.25,
    minWidth: 0,
    gap: theme.spacing.sm,
  },
  desktopAccountAvatar: {
    width: 54,
    height: 54,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceTint,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  desktopIdentityCopy: {
    minWidth: 0,
    flex: 1,
    gap: 2,
  },
  desktopAccountName: {
    ...theme.typography.h2,
    color: theme.colors.textStrong,
  },
  desktopChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
    alignItems: 'center',
  },
  desktopGrid: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
  },
  desktopMainColumn: {
    flex: 1.85,
    gap: theme.spacing.md,
  },
  desktopSideColumn: {
    flex: 1,
    gap: theme.spacing.md,
  },
  desktopSnapshotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  desktopSnapshotItem: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceTint,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    minWidth: 200,
    flexGrow: 1,
    gap: 4,
  },
  desktopSnapshotLabel: {
    ...theme.typography.caption,
    color: theme.colors.textSubtle,
  },
  desktopSnapshotValue: {
    ...theme.typography.bodySmall,
    color: theme.colors.textStrong,
    fontWeight: '700',
  },
  desktopActionList: {
    gap: theme.spacing.xs,
  },
  desktopActionRow: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceTint,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  desktopActionCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  header: {
    width: '100%',
  },
  headerCopy: {
    gap: theme.spacing.sm,
    width: '100%',
  },
  accountCard: {
    width: '100%',
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    gap: 4,
    ...theme.shadows.surface,
  },
  accountLabel: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.35,
  },
  accountName: {
    ...theme.typography.h1,
    color: theme.colors.textStrong,
  },
  accountEmail: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
  },
  card: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    ...theme.shadows.surface,
  },
  agentTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: theme.radius.pill,
    overflow: 'hidden',
    backgroundColor: theme.colors.surfaceTint,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    ...theme.typography.body,
    color: theme.colors.primaryDeep,
    fontWeight: '700',
  },
  agentCopy: {
    flex: 1,
    gap: 2,
  },
  agentName: {
    ...theme.typography.title,
    color: theme.colors.textStrong,
  },
  agentMeta: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
  },
  agentHint: {
    ...theme.typography.caption,
    color: theme.colors.textSubtle,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginTop: 2,
  },
  actionCard: {
    flexBasis: '47%',
    flexGrow: 1,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceTint,
    paddingVertical: 12,
    paddingHorizontal: theme.spacing.sm,
    gap: 2,
  },
  actionCardDisabled: {
    opacity: 0.5,
  },
  actionTitle: {
    ...theme.typography.bodySmall,
    color: theme.colors.textStrong,
    fontWeight: '700',
  },
  actionMeta: {
    ...theme.typography.caption,
    color: theme.colors.textSubtle,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  infoLabel: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
    flex: 1,
  },
  infoValue: {
    ...theme.typography.bodySmall,
    color: theme.colors.textStrong,
    fontWeight: '700',
    flex: 1,
    textAlign: 'right',
  },
  statusChipRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
  },
  statusChip: {
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  statusChipText: {
    ...theme.typography.caption,
    fontWeight: '700',
  },
  companyActions: {
    marginTop: theme.spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  detailLinkButton: {
    flex: 1,
    minWidth: 0,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
  },
  detailLinkButtonText: {
    ...theme.typography.bodySmall,
    color: theme.colors.white,
    fontWeight: '700',
  },
  linkButton: {
    flex: 1,
    minWidth: 0,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    backgroundColor: theme.colors.surfaceTint,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
  },
  linkButtonText: {
    ...theme.typography.bodySmall,
    color: theme.colors.primary,
    fontWeight: '700',
  },
  primaryAction: {
    minHeight: 46,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
  },
  primaryActionText: {
    ...theme.typography.bodySmall,
    color: theme.colors.white,
    fontWeight: '700',
  },
  secondaryAction: {
    minHeight: 46,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
  },
  secondaryActionText: {
    ...theme.typography.bodySmall,
    color: theme.colors.textStrong,
    fontWeight: '700',
  },
  skeletonBlock: {
    borderRadius: theme.radius.pill,
    backgroundColor: '#DFE8E3',
    height: 11,
  },
  skeletonLabel: {
    width: '26%',
    height: 9,
  },
  skeletonHeadline: {
    width: '62%',
    height: 24,
  },
  skeletonLineWide: {
    width: '88%',
  },
  skeletonLineMedium: {
    width: '62%',
  },
  skeletonLineShort: {
    width: '38%',
  },
  skeletonAvatar: {
    width: 54,
    height: 54,
    borderRadius: theme.radius.pill,
    backgroundColor: '#DFE8E3',
  },
  skeletonAvatarInitials: {
    width: 20,
    height: 20,
  },
  skeletonCard: {
    justifyContent: 'center',
  },
  skeletonIcon: {
    width: 18,
    height: 18,
  },
  skeletonButton: {
    minHeight: 44,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    backgroundColor: '#DFE8E3',
  },
  skeletonButtonPrimary: {
    backgroundColor: '#C4D5CC',
  },
  pressed: {
    transform: [{ scale: 0.992 }],
    opacity: 0.94,
  },
});
