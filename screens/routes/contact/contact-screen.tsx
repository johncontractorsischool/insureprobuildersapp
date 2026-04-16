import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { ScreenContainer } from '@/components/screen-container';
import { CONTACT_TOPIC_CONFIG, normalizeContactTopic } from '@/constants/contact-support';
import { theme } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { getPortalConfig } from '@/services/portal-config';
import { sendSmtpEmail } from '@/services/smtp-email-api';
import { getNameFromCustomer } from '@/utils/format';

function isEmailValid(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildContactEmailHtml({
  topicLabel,
  message,
  accountHolder,
  businessName,
  replyEmail,
  phone,
  databaseId,
  insuredId,
}: {
  topicLabel: string;
  message: string;
  accountHolder: string;
  businessName: string;
  replyEmail: string;
  phone: string;
  databaseId: string;
  insuredId: string;
}) {
  return `
    <div style="font-family:Arial,sans-serif;color:#1f2933;line-height:1.5;">
      <p>A new Contact Us request was submitted from the Insure Pro Builders app.</p>
      <p><strong>Type:</strong> ${escapeHtml(topicLabel)}</p>
      <p><strong>Account Holder:</strong> ${escapeHtml(accountHolder)}</p>
      <p><strong>Business Name:</strong> ${escapeHtml(businessName)}</p>
      <p><strong>Reply Email:</strong> ${escapeHtml(replyEmail)}</p>
      <p><strong>Phone:</strong> ${escapeHtml(phone)}</p>
      <p><strong>Database ID:</strong> ${escapeHtml(databaseId)}</p>
      <p><strong>Insured ID:</strong> ${escapeHtml(insuredId)}</p>
      <div style="margin-top:16px;padding:16px;border:1px solid #d7ddda;border-radius:12px;background:#f7faf8;">
        <p style="margin:0 0 8px 0;"><strong>Message</strong></p>
        <p style="margin:0;white-space:pre-wrap;">${escapeHtml(message)}</p>
      </div>
    </div>
  `.trim();
}

export default function ContactScreen() {
  const { topic } = useLocalSearchParams<{ topic?: string }>();
  const { customer, userEmail } = useAuth();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resolvedTopic = normalizeContactTopic(topic);
  const topicConfig = CONTACT_TOPIC_CONFIG[resolvedTopic];
  const supportEmail = getPortalConfig().actions.supportEmail;
  const accountHolder = getNameFromCustomer(customer, userEmail);
  const businessName = customer?.commercialName?.trim() || 'Not provided';
  const replyEmail = customer?.email?.trim() || userEmail?.trim() || '';
  const phone = customer?.cellPhone?.trim() || customer?.phone?.trim() || 'Not provided';
  const databaseId = customer?.databaseId?.trim() || 'Not provided';
  const insuredId = customer?.insuredId?.trim() || 'Not provided';

  const handleSubmit = async () => {
    const normalizedMessage = message.trim();

    if (!replyEmail || !isEmailValid(replyEmail)) {
      setError('A valid account email is required before sending this message.');
      return;
    }

    if (!normalizedMessage) {
      setError('Enter a message before sending.');
      return;
    }

    if (isSubmitting) return;

    setIsSubmitting(true);
    setError('');
    setNotice('');

    try {
      await sendSmtpEmail({
        subject: topicConfig.subject,
        html: buildContactEmailHtml({
          topicLabel: topicConfig.menuLabel,
          message: normalizedMessage,
          accountHolder,
          businessName,
          replyEmail,
          phone,
          databaseId,
          insuredId,
        }),
        to: [supportEmail],
      });

      setMessage('');
      setNotice(topicConfig.successMessage);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error && caughtError.message
          ? caughtError.message
          : 'Unable to send your message right now.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: topicConfig.screenTitle,
          headerShadowVisible: false,
          headerTintColor: theme.colors.textStrong,
          headerStyle: { backgroundColor: theme.colors.background },
        }}
      />
      <ScreenContainer keyboardAware keyboardVerticalOffset={96} includeTopInset={false}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 32 : 0}>
          <View style={styles.heroCard}>
            <Text style={styles.heroTitle}>{topicConfig.screenTitle}</Text>
            <Text style={styles.heroCopy}>{topicConfig.description}</Text>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.sectionLabel}>Message</Text>
            <View style={styles.messageWrap}>
              <TextInput
                accessibilityLabel="Message"
                multiline
                numberOfLines={8}
                value={message}
                onChangeText={setMessage}
                textAlignVertical="top"
                placeholder={topicConfig.placeholder}
                placeholderTextColor={theme.colors.textSubtle}
                style={styles.messageInput}
              />
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            {notice ? <Text style={styles.noticeText}>{notice}</Text> : null}

            <AppButton
              label={resolvedTopic === 'feedback' ? 'Send Feedback' : 'Send Support Request'}
              onPress={() => void handleSubmit()}
              loading={isSubmitting}
            />
          </View>
        </KeyboardAvoidingView>
      </ScreenContainer>
    </>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    gap: theme.spacing.xs,
    ...theme.shadows.surface,
  },
  heroTitle: {
    ...theme.typography.h2,
    color: theme.colors.textStrong,
  },
  heroCopy: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
  },
  formCard: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
    ...theme.shadows.surface,
  },
  sectionLabel: {
    ...theme.typography.label,
    color: theme.colors.textStrong,
  },
  messageWrap: {
    minHeight: 180,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  messageInput: {
    flex: 1,
    minHeight: 150,
    ...theme.typography.body,
    color: theme.colors.textStrong,
  },
  errorText: {
    ...theme.typography.bodySmall,
    color: theme.colors.danger,
  },
  noticeText: {
    ...theme.typography.bodySmall,
    color: theme.colors.success,
  },
});
