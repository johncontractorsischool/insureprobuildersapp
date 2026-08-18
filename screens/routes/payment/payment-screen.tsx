import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as ScreenCapture from 'expo-screen-capture';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppInput } from '@/components/app-input';
import { EmptyState } from '@/components/empty-state';
import { LoadingState } from '@/components/loading-state';
import { ScreenContainer } from '@/components/screen-container';
import { theme } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { usePayments } from '@/context/payments-context';
import {
  PaymentApiError,
  getPaymentEligibility,
  submitPayment,
} from '@/services/payment-api';
import type {
  AchAccountType,
  AchBankAccountType,
  CardType,
  PaymentEligibility,
  PaymentMethod,
  PaymentTermOption,
  SubmitPaymentRequest,
  SuccessfulPayment,
} from '@/types/payment';
import {
  buildPaymentRecordLabel,
  getPaymentPurposeLabel,
  isFullUsStateName,
  isValidAbaRoutingNumber,
  normalizeUsStateName,
} from '@/utils/account-payment';
import { formatCurrency } from '@/utils/format';

const PAYMENT_COUNTRY = 'United States Of America' as const;

const CARD_TYPE_OPTIONS: Array<{ value: CardType; label: string }> = [
  { value: 'Visa', label: 'Visa' },
  { value: 'Mastercard', label: 'Mastercard' },
  { value: 'AmericanExpress', label: 'AmEx' },
  { value: 'Discover', label: 'Discover' },
];

type PaymentScreenProps = {
  showInContentBackButton?: boolean;
  isDesktopLayout?: boolean;
};

type IntentIdentity = {
  fingerprint: string;
  key: string;
};

function getRecordKey(record: PaymentEligibility) {
  return record.demandId;
}

function isRecordPayable(record: PaymentEligibility) {
  if (record.paymentState !== 'DUE' || !record.paymentNeeded) return false;
  return record.paymentMode === 'TERM_OPTIONS'
    ? record.termOptions.length >= 2 && record.termOptions.some((option) => option.amount > 0)
    : record.amountDue > 0;
}

function getRecordStatusDescription(record: PaymentEligibility) {
  if (record.paymentMode === 'TERM_OPTIONS') {
    return `${record.termOptions.length} term options available`;
  }
  return `${getPaymentPurposeLabel(record.purpose)} due`;
}

function getTermOptionAmount(record: PaymentEligibility) {
  if (record.paymentMode !== 'TERM_OPTIONS' || record.termOptions.length === 0) {
    return record.amountDue;
  }
  return Math.min(...record.termOptions.map((option) => option.amount));
}

function sameMoney(left: number | null, right: number | null) {
  if (left === null || right === null) return left === right;
  return Math.round(left * 100) === Math.round(right * 100);
}

function termOptionMatches(left: PaymentTermOption, right: PaymentTermOption) {
  return (
    left.id === right.id &&
    left.termYears === right.termYears &&
    left.currency === right.currency &&
    left.label === right.label &&
    sameMoney(left.amount, right.amount) &&
    sameMoney(left.cardConvenienceFee, right.cardConvenienceFee) &&
    sameMoney(left.cardTotalAmount, right.cardTotalAmount) &&
    sameMoney(left.achConvenienceFee, right.achConvenienceFee) &&
    sameMoney(left.achTotalAmount, right.achTotalAmount)
  );
}

function formatDemandDueDate(value: string | null) {
  if (!value) return 'No due date provided';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return 'No due date provided';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function formatExpirationInput(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
}

function getPaymentFailureMessage(error: unknown, paymentWasDefinitelyRejected = false) {
  if (!(error instanceof PaymentApiError)) {
    return 'Something went wrong while processing your payment. Please try again later.';
  }

  if (error.status === 401) {
    return 'Your secure sign-in session is unavailable. Please sign in again.';
  }
  if (error.status === 404) return 'This payment request is no longer available.';
  if (error.status === 409) {
    if (error.message.toLowerCase().includes('idempotency-key')) {
      return 'This payment attempt changed after it started. Reload the payment request before trying again.';
    }
    return 'This payment is already being processed. Reload before trying again.';
  }
  if (error.status === 502) {
    if (paymentWasDefinitelyRejected) {
      return 'Your payment was not accepted. Verify the cardholder and billing information, then try again. Your card was not charged.';
    }
    return 'We could not confirm your payment. Please contact PBIA before trying again.';
  }
  if (error.status === 503) {
    return 'Mobile payments are temporarily unavailable. Please try again later.';
  }
  if (error.status >= 500) {
    return 'Something went wrong while processing your payment. Please try again later.';
  }
  return error.message || 'Please review the payment information and try again.';
}

export default function PaymentScreen({
  showInContentBackButton = false,
  isDesktopLayout = false,
}: PaymentScreenProps) {
  const routeParams = useLocalSearchParams<{ demandId?: string | string[] }>();
  const requestedDemandId = Array.isArray(routeParams.demandId)
    ? routeParams.demandId[0]
    : routeParams.demandId;
  const { isAuthenticated, customer, userEmail } = useAuth();
  const {
    paymentRecords,
    payableRecords,
    isLoadingPayments,
    paymentsError,
    refreshPaymentEligibility,
  } = usePayments();
  const [selectedRecordKey, setSelectedRecordKey] = useState('');
  const [selectedPaymentOptionId, setSelectedPaymentOptionId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CARD');
  const [firstName, setFirstName] = useState(customer?.firstName?.trim() ?? '');
  const [lastName, setLastName] = useState(customer?.lastName?.trim() ?? '');
  const [address1, setAddress1] = useState(customer?.addressLine1?.trim() ?? '');
  const [address2, setAddress2] = useState(customer?.addressLine2?.trim() ?? '');
  const [city, setCity] = useState(customer?.city?.trim() ?? '');
  const [region, setRegion] = useState(
    normalizeUsStateName(customer?.stateNameOrAbbreviation)
  );
  const [postalCode, setPostalCode] = useState(customer?.zipCode?.trim() ?? '');
  const [phone, setPhone] = useState(
    customer?.phone?.trim() ?? customer?.cellPhone?.trim() ?? ''
  );
  const [cardType, setCardType] = useState<CardType>('Visa');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiration, setCardExpiration] = useState('');
  const [cardSecurityCode, setCardSecurityCode] = useState('');
  const [achBankAccountType, setAchBankAccountType] =
    useState<AchBankAccountType>('Checking');
  const [achAccountType, setAchAccountType] = useState<AchAccountType>('Business');
  const [achBankName, setAchBankName] = useState('');
  const [achRoutingNumber, setAchRoutingNumber] = useState('');
  const [achBankAccountNumber, setAchBankAccountNumber] = useState('');
  const [isReviewing, setIsReviewing] = useState(false);
  const [isCheckingEligibility, setIsCheckingEligibility] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [successfulPayment, setSuccessfulPayment] = useState<SuccessfulPayment | null>(null);
  const [blockedRecordKey, setBlockedRecordKey] = useState<string | null>(null);
  const [isPaymentUnavailable, setIsPaymentUnavailable] = useState(false);
  const paymentIntentRef = useRef<IntentIdentity | null>(null);
  const accountId = customer?.accountId?.trim() || customer?.databaseId?.trim() || '';

  const selectedRecord = useMemo(
    () => payableRecords.find((record) => getRecordKey(record) === selectedRecordKey) ?? null,
    [payableRecords, selectedRecordKey]
  );
  const selectedTermOption =
    selectedRecord?.paymentMode === 'TERM_OPTIONS'
      ? (selectedRecord.termOptions.find((option) => option.id === selectedPaymentOptionId) ?? null)
      : null;
  const selectedPaymentAmount = selectedRecord
    ? selectedRecord.paymentMode === 'TERM_OPTIONS'
      ? (selectedTermOption?.amount ?? null)
      : selectedRecord.amountDue
    : null;
  const selectedConvenienceFee = selectedRecord
    ? paymentMethod === 'CARD'
      ? selectedRecord.paymentMode === 'TERM_OPTIONS'
        ? (selectedTermOption?.cardConvenienceFee ?? null)
        : selectedRecord.cardConvenienceFee
      : selectedRecord.paymentMode === 'TERM_OPTIONS'
        ? (selectedTermOption?.achConvenienceFee ?? null)
        : selectedRecord.achConvenienceFee
    : null;
  const selectedTotalAmount = selectedRecord
    ? paymentMethod === 'CARD'
      ? selectedRecord.paymentMode === 'TERM_OPTIONS'
        ? (selectedTermOption?.cardTotalAmount ?? null)
        : selectedRecord.cardTotalAmount
      : selectedRecord.paymentMode === 'TERM_OPTIONS'
        ? (selectedTermOption?.achTotalAmount ?? null)
        : selectedRecord.achTotalAmount
    : null;

  useFocusEffect(
    useCallback(() => {
      void refreshPaymentEligibility();
    }, [refreshPaymentEligibility])
  );

  useEffect(() => {
    if (!isAuthenticated) router.replace('/(auth)/login');
  }, [isAuthenticated]);

  useEffect(() => {
    if (Platform.OS === 'web') return undefined;
    const captureKey = 'pbia-mobile-payment';
    void ScreenCapture.preventScreenCaptureAsync(captureKey).catch(() => undefined);
    if (Platform.OS === 'ios') {
      void ScreenCapture.enableAppSwitcherProtectionAsync().catch(() => undefined);
    }
    return () => {
      void ScreenCapture.allowScreenCaptureAsync(captureKey).catch(() => undefined);
      if (Platform.OS === 'ios') {
        void ScreenCapture.disableAppSwitcherProtectionAsync().catch(() => undefined);
      }
    };
  }, []);

  useEffect(() => {
    if (payableRecords.length === 0) {
      setSelectedRecordKey('');
      return;
    }

    const selectionStillExists = payableRecords.some(
      (record) => getRecordKey(record) === selectedRecordKey
    );
    if (!selectionStillExists) {
      const requestedRecord = payableRecords.find(
        (record) => record.demandId === requestedDemandId
      );
      setSelectedRecordKey(getRecordKey(requestedRecord ?? payableRecords[0]));
    }
  }, [payableRecords, requestedDemandId, selectedRecordKey]);

  useEffect(() => {
    if (!selectedRecord) return;
    setSelectedPaymentOptionId('');
    setIsReviewing(false);
    setFormError('');
    setCardNumber('');
    setCardExpiration('');
    setCardSecurityCode('');
    setAchBankName('');
    setAchRoutingNumber('');
    setAchBankAccountNumber('');
    paymentIntentRef.current = null;
  }, [selectedRecordKey]); // Deliberately reset only when the selected policy or quote changes.

  useEffect(
    () => () => {
      paymentIntentRef.current = null;
    },
    []
  );

  const clearSensitiveFields = useCallback(() => {
    setCardNumber('');
    setCardExpiration('');
    setCardSecurityCode('');
    setAchBankName('');
    setAchRoutingNumber('');
    setAchBankAccountNumber('');
  }, []);

  const clearAllPaymentFields = useCallback(() => {
    setSelectedPaymentOptionId('');
    setPaymentMethod('CARD');
    setFirstName('');
    setLastName('');
    setAddress1('');
    setAddress2('');
    setCity('');
    setRegion('');
    setPostalCode('');
    setPhone('');
    setCardType('Visa');
    setAchBankAccountType('Checking');
    setAchAccountType('Business');
    clearSensitiveFields();
    setIsReviewing(false);
  }, [clearSensitiveFields]);

  const resetReview = useCallback(() => {
    setIsReviewing(false);
    setSuccessfulPayment(null);
    setFormError('');
  }, []);

  const handleBack = () => {
    clearAllPaymentFields();
    paymentIntentRef.current = null;
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)');
  };

  const changePaymentMethod = (nextMethod: PaymentMethod) => {
    if (nextMethod === paymentMethod) return;
    clearSensitiveFields();
    setPaymentMethod(nextMethod);
    resetReview();
  };

  const changePaymentTerm = (paymentOptionId: string) => {
    if (paymentOptionId === selectedPaymentOptionId) return;
    setSelectedPaymentOptionId(paymentOptionId);
    paymentIntentRef.current = null;
    resetReview();
  };

  const buildPaymentRequest = (): { request: SubmitPaymentRequest } | { error: string } => {
    if (!selectedRecord) return { error: 'Select a payment request.' };
    if (selectedRecord.paymentMode === 'TERM_OPTIONS' && !selectedTermOption) {
      return { error: 'Select a payment term.' };
    }

    const signedInEmail = userEmail?.trim().toLowerCase();
    if (!signedInEmail) return { error: 'Your signed-in email is unavailable. Please sign in again.' };
    if (!firstName.trim() || !lastName.trim()) {
      return { error: 'Enter the payer’s first and last name.' };
    }
    if (!address1.trim() || !city.trim() || !postalCode.trim()) {
      return { error: 'Enter the payer’s street address, city, and ZIP code.' };
    }
    if (!isFullUsStateName(region)) {
      return { error: 'Enter the full state name, such as California, instead of CA.' };
    }

    const payer = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      address1: address1.trim(),
      ...(address2.trim() ? { address2: address2.trim() } : {}),
      country: PAYMENT_COUNTRY,
      city: city.trim(),
      region: normalizeUsStateName(region),
      postalCode: postalCode.trim(),
      email: signedInEmail,
      ...(phone.trim() ? { phone: phone.trim() } : {}),
    };
    const paymentSelection =
      selectedRecord.paymentMode === 'TERM_OPTIONS'
        ? { paymentOptionId: selectedTermOption!.id }
        : { amount: selectedRecord.amountDue, purpose: selectedRecord.purpose };

    if (paymentMethod === 'CARD') {
      if (selectedConvenienceFee === null || selectedTotalAmount === null) {
        return {
          error: 'Card payments are unavailable until the Input1 convenience fee is confirmed.',
        };
      }
      if (!/^\d{12,19}$/.test(cardNumber)) {
        return { error: 'Enter a valid 12–19 digit card number.' };
      }
      if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(cardExpiration)) {
        return { error: 'Enter the card expiration in MM/YY format.' };
      }
      if (!/^\d{3,4}$/.test(cardSecurityCode)) {
        return { error: 'Enter a valid 3 or 4 digit security code.' };
      }

      return {
        request: {
          ...paymentSelection,
          paymentMethod: 'CARD',
          emailReceipt: true,
          card: {
            ...payer,
            creditCardType: cardType,
            creditCardNumber: cardNumber,
            creditCardExpiration: cardExpiration,
            creditCardSecurityCode: cardSecurityCode,
          },
        },
      };
    }

    if (selectedConvenienceFee === null || selectedTotalAmount === null) {
      return {
        error: 'ACH payments are unavailable until the Input1 convenience fee is confirmed.',
      };
    }
    if (!achBankName.trim() || achBankName.trim().length > 100) {
      return { error: 'Enter a bank name of 100 characters or fewer.' };
    }
    if (!isValidAbaRoutingNumber(achRoutingNumber)) {
      return { error: 'Enter a valid 9-digit ABA routing number.' };
    }
    if (!/^\d{1,34}$/.test(achBankAccountNumber)) {
      return { error: 'Enter a valid numeric bank account number.' };
    }

    return {
      request: {
        ...paymentSelection,
        paymentMethod: 'ACH',
        emailReceipt: true,
        ach: {
          ...payer,
          achBankAccountType,
          accountType: achAccountType,
          achBankName: achBankName.trim(),
          achRoutingNumber,
          achBankAccountNumber,
        },
      },
    };
  };

  const ensureRecordIsPayable = async (
    record: PaymentEligibility,
    paymentOptionId: string
  ) => {
    if (!userEmail) throw new PaymentApiError(400, 'A valid signed-in client email is required.');
    if (!accountId) throw new PaymentApiError(400, 'A client account is required.');
    const current = await getPaymentEligibility(userEmail, accountId, record.demandId);
    if (!isRecordPayable(current)) {
      throw new PaymentApiError(404, 'This payment request is no longer available.');
    }
    let requestChanged =
      record.paymentMode !== current.paymentMode || record.purpose !== current.purpose;
    if (!requestChanged && record.paymentMode === 'TERM_OPTIONS') {
      const previousOption = record.termOptions.find((option) => option.id === paymentOptionId);
      const currentOption = current.termOptions.find((option) => option.id === paymentOptionId);
      requestChanged =
        current.paymentMode !== 'TERM_OPTIONS' ||
        !previousOption ||
        !currentOption ||
        !termOptionMatches(previousOption, currentOption);
    } else if (!requestChanged) {
      requestChanged =
        !sameMoney(record.amountDue, current.amountDue) ||
        !sameMoney(record.cardConvenienceFee, current.cardConvenienceFee) ||
        !sameMoney(record.cardTotalAmount, current.cardTotalAmount) ||
        !sameMoney(record.achConvenienceFee, current.achConvenienceFee) ||
        !sameMoney(record.achTotalAmount, current.achTotalAmount);
    }
    if (requestChanged) {
      await refreshPaymentEligibility();
      throw new PaymentApiError(
        400,
        'The payment request changed. Please review the updated amount, purpose, and term options.'
      );
    }
    return current;
  };

  const handleReviewPayment = async () => {
    const result = buildPaymentRequest();
    if ('error' in result || !selectedRecord) {
      setFormError('error' in result ? result.error : 'Select a payment request.');
      return;
    }

    setIsCheckingEligibility(true);
    setFormError('');
    try {
      await ensureRecordIsPayable(selectedRecord, selectedPaymentOptionId);
      setIsReviewing(true);
    } catch (error) {
      if (error instanceof PaymentApiError && error.status === 404) {
        await refreshPaymentEligibility();
      }
      if (error instanceof PaymentApiError && error.status === 503) {
        setIsPaymentUnavailable(true);
      }
      clearAllPaymentFields();
      setFormError(getPaymentFailureMessage(error));
    } finally {
      setIsCheckingEligibility(false);
    }
  };

  const handleSubmitPayment = async () => {
    const result = buildPaymentRequest();
    if ('error' in result || !selectedRecord || !userEmail || !accountId) {
      setFormError(
        'error' in result ? result.error : 'Your signed-in payment information is unavailable.'
      );
      setIsReviewing(false);
      return;
    }

    const recordKey = getRecordKey(selectedRecord);
    if (isPaymentUnavailable) {
      setFormError('Mobile payments are temporarily unavailable. Please try again later.');
      return;
    }
    if (blockedRecordKey === recordKey) {
      setFormError('Please contact PBIA to verify the earlier payment attempt before trying again.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');
    try {
      await ensureRecordIsPayable(selectedRecord, selectedPaymentOptionId);
      const requestFingerprint = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        JSON.stringify(result.request)
      );
      const fingerprint = `${recordKey}|${requestFingerprint}`;
      if (!paymentIntentRef.current || paymentIntentRef.current.fingerprint !== fingerprint) {
        paymentIntentRef.current = { fingerprint, key: Crypto.randomUUID() };
      }
      const payment = await submitPayment(
        userEmail,
        accountId,
        selectedRecord.demandId,
        paymentIntentRef.current.key,
        result.request
      );
      clearAllPaymentFields();
      paymentIntentRef.current = null;
      setSuccessfulPayment(payment);
      await refreshPaymentEligibility();
    } catch (error) {
      if (error instanceof PaymentApiError && error.status === 404) {
        await refreshPaymentEligibility();
      }
      let paymentWasDefinitelyRejected = false;
      if (error instanceof PaymentApiError && error.status === 502) {
        try {
          await getPaymentEligibility(userEmail, accountId, selectedRecord.demandId);
          paymentWasDefinitelyRejected = true;
          await refreshPaymentEligibility();
        } catch {
          // A demand that is still hidden remains blocked until PBIA reconciles it.
        }
      }
      const isUnconfirmed =
        error instanceof PaymentApiError &&
        error.status === 502 &&
        !paymentWasDefinitelyRejected;
      const isInvalidOrConflicting =
        error instanceof PaymentApiError && (error.status === 400 || error.status === 409);
      if (isUnconfirmed) setBlockedRecordKey(recordKey);
      if (paymentWasDefinitelyRejected) {
        setBlockedRecordKey((current) => (current === recordKey ? null : current));
      }
      if (error instanceof PaymentApiError && error.status === 503) {
        setIsPaymentUnavailable(true);
      }
      if (isUnconfirmed || isInvalidOrConflicting) paymentIntentRef.current = null;
      clearSensitiveFields();
      setIsReviewing(false);
      setFormError(getPaymentFailureMessage(error, paymentWasDefinitelyRejected));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingPayments) {
    return (
      <ScreenContainer scroll={false} includeTopInset={!isDesktopLayout}>
        <LoadingState title="Loading payment details" description="Checking your current balances..." />
      </ScreenContainer>
    );
  }

  if (paymentsError) {
    return (
      <ScreenContainer scroll={false} includeTopInset={!isDesktopLayout}>
        <EmptyState
          icon="warning-outline"
          title="Unable to load payment details"
          description={paymentsError}
          actionLabel="Retry"
          onAction={() => void refreshPaymentEligibility()}
        />
      </ScreenContainer>
    );
  }

  if (successfulPayment) {
    return (
      <ScreenContainer
        includeTopInset={!isDesktopLayout}
        maxContentWidth={isDesktopLayout ? 720 : undefined}>
        <View style={styles.successCard}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={42} color={theme.colors.success} />
          </View>
          <Text style={styles.cardTitle}>Payment successful</Text>
          <Text style={styles.successAmount}>
            {formatCurrency(successfulPayment.totalCharged ?? successfulPayment.amount)}
          </Text>
          <ReviewRow label="Payment amount" value={formatCurrency(successfulPayment.amount)} />
          {successfulPayment.termYears !== null ? (
            <ReviewRow
              label="Selected term"
              value={`${successfulPayment.termYears} ${successfulPayment.termYears === 1 ? 'year' : 'years'}`}
            />
          ) : null}
          {successfulPayment.convenienceFee !== null ? (
            <ReviewRow
              label="Convenience fee"
              value={formatCurrency(successfulPayment.convenienceFee)}
            />
          ) : null}
          {successfulPayment.addOnConvenienceFee !== null &&
          successfulPayment.addOnConvenienceFee > 0 ? (
            <ReviewRow
              label="Additional convenience fee"
              value={formatCurrency(successfulPayment.addOnConvenienceFee)}
            />
          ) : null}
          {successfulPayment.totalCharged !== null ? (
            <ReviewRow
              label="Total charged"
              value={formatCurrency(successfulPayment.totalCharged)}
            />
          ) : null}
          <Text style={styles.cardSubtitle}>A receipt was sent to {userEmail}.</Text>
          {successfulPayment.receiptId ? (
            <View style={styles.receiptRow}>
              <Text style={styles.reviewLabel}>Receipt ID</Text>
              <Text selectable style={styles.receiptValue}>{successfulPayment.receiptId}</Text>
            </View>
          ) : null}
          <AppButton label="Back to My Account" onPress={handleBack} />
        </View>
      </ScreenContainer>
    );
  }

  if (paymentRecords.length === 0) {
    return (
      <ScreenContainer scroll={false} includeTopInset={!isDesktopLayout}>
        <EmptyState
          icon="checkmark-circle-outline"
          title="No payment currently due"
          description="Your agent has not published a payment request for this account."
          actionLabel="Back to account"
          onAction={handleBack}
        />
      </ScreenContainer>
    );
  }

  const paymentSummary = selectedRecord ? (
    <View
      testID="payment-summary-card"
      style={[
        styles.balanceCard,
        isDesktopLayout ? styles.desktopBalanceCard : styles.mobileBalanceCard,
      ]}>
      <View style={styles.balanceIcon}>
        <Ionicons name="wallet-outline" size={22} color={theme.colors.primary} />
      </View>
      <Text style={styles.balanceLabel}>Amount Due</Text>
      <Text
        numberOfLines={2}
        style={[styles.balanceValue, !isDesktopLayout ? styles.mobileBalanceValue : null]}>
        {selectedRecord.paymentMode === 'TERM_OPTIONS' && selectedPaymentAmount === null
          ? 'Select a term'
          : formatCurrency(selectedPaymentAmount ?? selectedRecord.amountDue)}
      </Text>
      <Text style={styles.balanceRecord}>{buildPaymentRecordLabel(selectedRecord)}</Text>
      <View style={styles.balanceDivider} />
      {selectedTermOption ? (
        <ReviewRow label="Selected term" value={selectedTermOption.label} />
      ) : null}
      <ReviewRow
        label="Purpose"
        value={getPaymentPurposeLabel(selectedRecord.purpose)}
      />
      {selectedConvenienceFee !== null ? (
        <ReviewRow
          label={paymentMethod === 'CARD' ? 'Card convenience fee' : 'ACH convenience fee'}
          value={formatCurrency(selectedConvenienceFee)}
        />
      ) : null}
      {selectedTotalAmount !== null ? (
        <ReviewRow
          label={paymentMethod === 'CARD' ? 'Card total' : 'ACH total'}
          value={formatCurrency(selectedTotalAmount)}
        />
      ) : null}
      <ReviewRow
        label="Due date"
        value={formatDemandDueDate(selectedRecord.dueDate)}
      />
      <ReviewRow
        label="Type"
        value={selectedRecord.recordType === 'QUOTE' ? 'Quote' : 'Policy'}
      />
    </View>
  ) : null;

  return (
    <ScreenContainer
      includeTopInset={!isDesktopLayout}
      keyboardAware
      maxContentWidth={isDesktopLayout ? 1080 : undefined}
      contentContainerStyle={isDesktopLayout ? styles.desktopContent : styles.mobileContent}>
      <View style={styles.heading}>
        {showInContentBackButton ? (
          <Pressable accessibilityRole="button" onPress={handleBack} style={styles.backButton}>
            <Ionicons name="chevron-back" size={18} color={theme.colors.primary} />
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
        ) : null}
        <Text style={styles.eyebrow}>My Account</Text>
        <Text style={styles.title}>Make a Payment</Text>
        <Text style={styles.subtitle}>Review the payment requests published by your agent.</Text>
      </View>

      <View style={isDesktopLayout ? styles.desktopGrid : styles.mobileGrid}>
        <View style={styles.mainColumn}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Payment Requests</Text>
              <Text style={styles.cardSubtitle}>
                Review the exact amount or choose from the quote terms published by your agent.
              </Text>
            </View>
            <View style={styles.optionList}>
              {paymentRecords.map((record) => {
                const recordIsPayable = isRecordPayable(record);
                return (
                  <RecordOption
                    key={getRecordKey(record)}
                    record={record}
                    selected={getRecordKey(record) === selectedRecordKey}
                    disabled={!recordIsPayable || isReviewing || isSubmitting}
                    onPress={() => setSelectedRecordKey(getRecordKey(record))}
                  />
                );
              })}
            </View>
          </View>

          {!isDesktopLayout ? paymentSummary : null}

          {selectedRecord ? (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Payment Details</Text>
                <Text style={styles.cardSubtitle}>
                  Required fields are sent securely to PBIA for Input1 processing.
                </Text>
              </View>

              <View style={styles.demandDetails}>
                {selectedRecord.paymentMode === 'FIXED' ? (
                  <ReviewRow label="Amount" value={formatCurrency(selectedRecord.amountDue)} />
                ) : (
                  <ReviewRow
                    label="Payment amount"
                    value={
                      selectedPaymentAmount === null
                        ? 'Select a term below'
                        : formatCurrency(selectedPaymentAmount)
                    }
                  />
                )}
                <ReviewRow
                  label="Purpose"
                  value={getPaymentPurposeLabel(selectedRecord.purpose)}
                />
                <ReviewRow
                  label="Due date"
                  value={formatDemandDueDate(selectedRecord.dueDate)}
                />
                {selectedRecord.clientMessage ? (
                  <View style={styles.agentMessage}>
                    <Text style={styles.reviewLabel}>Message from your agent</Text>
                    <Text style={styles.agentMessageText}>{selectedRecord.clientMessage}</Text>
                  </View>
                ) : null}
              </View>

              {selectedRecord.paymentMode === 'TERM_OPTIONS' ? (
                <TermOptionSelector
                  options={selectedRecord.termOptions}
                  selectedOptionId={selectedPaymentOptionId}
                  disabled={isReviewing || isSubmitting}
                  onSelect={changePaymentTerm}
                />
              ) : null}

              <ChoiceGroup
                label="Payment Method"
                options={[
                  { value: 'CARD', label: 'Card' },
                  { value: 'ACH', label: 'Bank Account (ACH)' },
                ]}
                selected={paymentMethod}
                disabled={isReviewing || isSubmitting}
                onSelect={(value) => changePaymentMethod(value as PaymentMethod)}
              />

              <View style={styles.formSection}>
                <Text style={styles.sectionTitle}>Payer Information</Text>
                <View style={isDesktopLayout ? styles.twoColumnFields : styles.optionList}>
                  <View style={styles.fieldColumn}>
                    <AppInput label="First Name" value={firstName} onChangeText={setFirstName} editable={!isReviewing} />
                  </View>
                  <View style={styles.fieldColumn}>
                    <AppInput label="Last Name" value={lastName} onChangeText={setLastName} editable={!isReviewing} />
                  </View>
                </View>
                <AppInput label="Address" value={address1} onChangeText={setAddress1} editable={!isReviewing} />
                <AppInput label="Address 2 (Optional)" value={address2} onChangeText={setAddress2} editable={!isReviewing} />
                <View style={isDesktopLayout ? styles.twoColumnFields : styles.optionList}>
                  <View style={styles.fieldColumn}>
                    <AppInput label="City" value={city} onChangeText={setCity} editable={!isReviewing} />
                  </View>
                  <View style={styles.fieldColumn}>
                    <AppInput
                      label="State"
                      value={region}
                      onChangeText={setRegion}
                      editable={!isReviewing}
                      helperText="Use the full state name"
                    />
                  </View>
                </View>
                <View style={isDesktopLayout ? styles.twoColumnFields : styles.optionList}>
                  <View style={styles.fieldColumn}>
                    <AppInput label="ZIP Code" value={postalCode} onChangeText={setPostalCode} editable={!isReviewing} keyboardType="numbers-and-punctuation" />
                  </View>
                  <View style={styles.fieldColumn}>
                    <AppInput label="Phone (Optional)" value={phone} onChangeText={setPhone} editable={!isReviewing} keyboardType="phone-pad" />
                  </View>
                </View>
                <AppInput
                  label="Receipt Email"
                  value={userEmail ?? ''}
                  editable={false}
                  helperText="Securely taken from your signed-in account and cannot be changed here"
                />
                <AppInput label="Country" value={PAYMENT_COUNTRY} editable={false} />
              </View>

              {paymentMethod === 'CARD' ? (
                <View style={styles.formSection}>
                  <Text style={styles.sectionTitle}>Card Information</Text>
                  <ChoiceGroup
                    label="Card Type"
                    options={CARD_TYPE_OPTIONS}
                    selected={cardType}
                    disabled={isReviewing || isSubmitting}
                    onSelect={(value) => {
                      setCardType(value as CardType);
                      resetReview();
                    }}
                  />
                  <AppInput
                    label="Card Number"
                    value={cardNumber}
                    onChangeText={(value) => {
                      setCardNumber(value.replace(/\D/g, '').slice(0, 19));
                      resetReview();
                    }}
                    editable={!isReviewing}
                    keyboardType="number-pad"
                    secureTextEntry
                    autoComplete="off"
                    maxLength={19}
                  />
                  <View style={isDesktopLayout ? styles.twoColumnFields : styles.optionList}>
                    <View style={styles.fieldColumn}>
                      <AppInput
                        label="Expiration (MM/YY)"
                        value={cardExpiration}
                        onChangeText={(value) => {
                          setCardExpiration(formatExpirationInput(value));
                          resetReview();
                        }}
                        editable={!isReviewing}
                        keyboardType="number-pad"
                        placeholder="MM/YY"
                        maxLength={5}
                      />
                    </View>
                    <View style={styles.fieldColumn}>
                      <AppInput
                        label="Security Code"
                        value={cardSecurityCode}
                        onChangeText={(value) => {
                          setCardSecurityCode(value.replace(/\D/g, '').slice(0, 4));
                          resetReview();
                        }}
                        editable={!isReviewing}
                        keyboardType="number-pad"
                        secureTextEntry
                        autoComplete="off"
                        maxLength={4}
                      />
                    </View>
                  </View>
                </View>
              ) : (
                <View style={styles.formSection}>
                  <Text style={styles.sectionTitle}>Bank Account Information</Text>
                  <ChoiceGroup
                    label="Bank Account Type"
                    options={[
                      { value: 'Checking', label: 'Checking' },
                      { value: 'Savings', label: 'Savings' },
                    ]}
                    selected={achBankAccountType}
                    disabled={isReviewing || isSubmitting}
                    onSelect={(value) => {
                      setAchBankAccountType(value as AchBankAccountType);
                      resetReview();
                    }}
                  />
                  <ChoiceGroup
                    label="Account Ownership"
                    options={[
                      { value: 'Business', label: 'Business' },
                      { value: 'Personal', label: 'Personal' },
                    ]}
                    selected={achAccountType}
                    disabled={isReviewing || isSubmitting}
                    onSelect={(value) => {
                      setAchAccountType(value as AchAccountType);
                      resetReview();
                    }}
                  />
                  <AppInput label="Bank Name" value={achBankName} onChangeText={setAchBankName} editable={!isReviewing} maxLength={100} />
                  <AppInput
                    label="Routing Number"
                    value={achRoutingNumber}
                    onChangeText={(value) => {
                      setAchRoutingNumber(value.replace(/\D/g, '').slice(0, 9));
                      resetReview();
                    }}
                    editable={!isReviewing}
                    keyboardType="number-pad"
                    secureTextEntry
                    autoComplete="off"
                    maxLength={9}
                  />
                  <AppInput
                    label="Bank Account Number"
                    value={achBankAccountNumber}
                    onChangeText={(value) => {
                      setAchBankAccountNumber(value.replace(/\D/g, '').slice(0, 34));
                      resetReview();
                    }}
                    editable={!isReviewing}
                    keyboardType="number-pad"
                    secureTextEntry
                    autoComplete="off"
                    maxLength={34}
                  />
                </View>
              )}

              <View style={styles.securityNotice}>
                <Ionicons name="lock-closed-outline" size={18} color={theme.colors.primary} />
                <Text style={styles.securityNoticeText}>
                  Payment details are never saved to this device, analytics, or diagnostic logs.
                </Text>
              </View>

              {formError ? <Text accessibilityRole="alert" style={styles.errorText}>{formError}</Text> : null}

              {isReviewing ? (
                <View style={styles.reviewCard}>
                  <Text style={styles.sectionTitle}>Confirm Payment</Text>
                  <ReviewRow label="Record" value={buildPaymentRecordLabel(selectedRecord)} />
                  <ReviewRow
                    label="Payment amount"
                    value={formatCurrency(selectedPaymentAmount ?? selectedRecord.amountDue)}
                  />
                  {selectedTermOption ? (
                    <ReviewRow label="Selected term" value={selectedTermOption.label} />
                  ) : null}
                  {selectedConvenienceFee !== null ? (
                    <ReviewRow
                      label={
                        paymentMethod === 'CARD'
                          ? 'Card convenience fee'
                          : 'ACH convenience fee'
                      }
                      value={formatCurrency(selectedConvenienceFee)}
                    />
                  ) : null}
                  {selectedTotalAmount !== null ? (
                    <ReviewRow
                      label="Total charged"
                      value={formatCurrency(selectedTotalAmount)}
                    />
                  ) : null}
                  <ReviewRow
                    label="Purpose"
                    value={getPaymentPurposeLabel(selectedRecord.purpose)}
                  />
                  <ReviewRow
                    label="Method"
                    value={
                      paymentMethod === 'CARD'
                        ? `${cardType} ending in ${cardNumber.slice(-4)}`
                        : `${achBankAccountType} ending in ${achBankAccountNumber.slice(-4)}`
                    }
                  />
                  <Text style={styles.confirmationText}>
                    By confirming, you authorize PBIA to submit this payment through Input1
                    {selectedTotalAmount !== null
                      ? ` for a total charge of ${formatCurrency(selectedTotalAmount)}, including the displayed convenience fee.`
                      : '.'}{' '}
                    An email receipt is required.
                  </Text>
                  <AppButton label="Confirm Payment" onPress={() => void handleSubmitPayment()} loading={isSubmitting} />
                  <AppButton label="Edit Payment" variant="secondary" onPress={() => setIsReviewing(false)} disabled={isSubmitting} />
                  <AppButton label="Cancel and Clear" variant="ghost" onPress={handleBack} disabled={isSubmitting} />
                </View>
              ) : (
                <AppButton
                  label="Review Payment"
                  onPress={() => void handleReviewPayment()}
                  loading={isCheckingEligibility}
                  disabled={
                    isPaymentUnavailable ||
                    blockedRecordKey === selectedRecordKey ||
                    (selectedRecord.paymentMode === 'TERM_OPTIONS' && !selectedTermOption)
                  }
                />
              )}
            </View>
          ) : (
            <View style={styles.statusNotice}>
              <Ionicons name="information-circle-outline" size={20} color={theme.colors.primary} />
              <Text style={styles.statusNoticeText}>
                None of these records can accept a payment right now. Review each status above for details.
              </Text>
            </View>
          )}
        </View>

        {isDesktopLayout ? paymentSummary : null}
      </View>
    </ScreenContainer>
  );
}

function RecordOption({
  record,
  selected,
  disabled,
  onPress,
}: {
  record: PaymentEligibility;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.recordOption,
        selected ? styles.optionSelected : null,
        pressed ? styles.pressed : null,
      ]}>
      <View style={styles.recordCopy}>
        <Text style={styles.recordTitle}>{buildPaymentRecordLabel(record)}</Text>
        <Text style={styles.recordMeta}>{getRecordStatusDescription(record)}</Text>
      </View>
      <Text style={styles.recordAmount}>
        {record.paymentMode === 'TERM_OPTIONS'
          ? `From ${formatCurrency(getTermOptionAmount(record))}`
          : formatCurrency(record.amountDue)}
      </Text>
      <View style={[styles.radioOuter, selected ? styles.radioOuterSelected : null]}>
        {selected ? <View style={styles.radioInner} /> : null}
      </View>
    </Pressable>
  );
}

function TermOptionSelector({
  options,
  selectedOptionId,
  disabled,
  onSelect,
}: {
  options: PaymentTermOption[];
  selectedOptionId: string;
  disabled: boolean;
  onSelect: (paymentOptionId: string) => void;
}) {
  return (
    <View style={styles.termSection}>
      <View style={styles.cardHeader}>
        <Text style={styles.sectionTitle}>Choose your coverage term</Text>
        <Text style={styles.cardSubtitle}>
          Select one option. Your final total depends on the payment method.
        </Text>
      </View>
      <View accessibilityRole="radiogroup" style={styles.optionList}>
        {options.map((option) => {
          const selected = option.id === selectedOptionId;
          const cardTotal =
            option.cardTotalAmount === null
              ? 'Card unavailable'
              : `Card total ${formatCurrency(option.cardTotalAmount)}`;
          const achTotal =
            option.achTotalAmount === null
              ? 'ACH unavailable'
              : `ACH total ${formatCurrency(option.achTotalAmount)}`;
          return (
            <Pressable
              key={option.id}
              accessibilityRole="radio"
              accessibilityLabel={`${option.label}, ${formatCurrency(option.amount)}`}
              accessibilityState={{ checked: selected, disabled }}
              disabled={disabled}
              onPress={() => onSelect(option.id)}
              style={({ pressed }) => [
                styles.termOption,
                selected ? styles.optionSelected : null,
                pressed ? styles.pressed : null,
              ]}>
              <View style={styles.recordCopy}>
                <Text style={styles.termTitle}>{option.label}</Text>
                <Text style={styles.termFeeCopy}>{`${cardTotal} • ${achTotal}`}</Text>
              </View>
              <Text style={styles.recordAmount}>{formatCurrency(option.amount)}</Text>
              <View style={[styles.radioOuter, selected ? styles.radioOuterSelected : null]}>
                {selected ? <View style={styles.radioInner} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function ChoiceGroup({
  label,
  options,
  selected,
  disabled,
  onSelect,
}: {
  label: string;
  options: Array<{ value: string; label: string }>;
  selected: string;
  disabled: boolean;
  onSelect: (value: string) => void;
}) {
  return (
    <View style={styles.choiceGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.choiceOptions}>
        {options.map((option) => {
          const isSelected = option.value === selected;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected, disabled }}
              disabled={disabled}
              onPress={() => onSelect(option.value)}
              style={({ pressed }) => [
                styles.choiceOption,
                isSelected ? styles.choiceOptionSelected : null,
                pressed ? styles.pressed : null,
              ]}>
              <Text style={[styles.choiceText, isSelected ? styles.choiceTextSelected : null]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.reviewRow}>
      <Text style={styles.reviewLabel}>{label}</Text>
      <Text style={styles.reviewValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  mobileContent: { paddingBottom: theme.spacing.xxxl },
  desktopContent: { paddingBottom: theme.spacing.xxl, gap: theme.spacing.lg },
  heading: { gap: theme.spacing.xs },
  backButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  backButtonText: { ...theme.typography.bodySmall, color: theme.colors.primary, fontWeight: '700' },
  eyebrow: { ...theme.typography.label, color: theme.colors.primary },
  title: { ...theme.typography.h1, color: theme.colors.textStrong },
  subtitle: { ...theme.typography.body, color: theme.colors.textMuted },
  mobileGrid: { gap: theme.spacing.lg },
  desktopGrid: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.lg },
  mainColumn: { flex: 1.7, minWidth: 0, gap: theme.spacing.lg },
  card: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
    ...theme.shadows.surface,
  },
  cardHeader: { gap: 3 },
  cardTitle: { ...theme.typography.h2, color: theme.colors.textStrong },
  cardSubtitle: { ...theme.typography.bodySmall, color: theme.colors.textMuted },
  optionList: { gap: theme.spacing.sm },
  recordOption: {
    minHeight: 72,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceTint,
    padding: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  optionSelected: { borderColor: theme.colors.primary, backgroundColor: '#EDF7F2' },
  demandDetails: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceTint,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  termSection: {
    gap: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.lg,
  },
  termOption: {
    minHeight: 76,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceTint,
    padding: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  termTitle: {
    ...theme.typography.body,
    color: theme.colors.textStrong,
    fontWeight: '700',
  },
  termFeeCopy: { ...theme.typography.caption, color: theme.colors.textMuted },
  agentMessage: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  agentMessageText: { ...theme.typography.bodySmall, color: theme.colors.textStrong },
  recordCopy: { flex: 1, minWidth: 0, gap: 2 },
  recordTitle: { ...theme.typography.bodySmall, color: theme.colors.textStrong, fontWeight: '700' },
  recordMeta: { ...theme.typography.caption, color: theme.colors.textMuted },
  recordAmount: { ...theme.typography.title, color: theme.colors.primaryDeep },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: { borderColor: theme.colors.primary },
  radioInner: { width: 10, height: 10, borderRadius: theme.radius.pill, backgroundColor: theme.colors.primary },
  choiceGroup: { gap: theme.spacing.xs },
  fieldLabel: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    letterSpacing: 0.35,
    textTransform: 'uppercase',
  },
  choiceOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs },
  choiceOption: {
    minHeight: 42,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceOptionSelected: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary },
  choiceText: { ...theme.typography.bodySmall, color: theme.colors.textStrong, fontWeight: '700' },
  choiceTextSelected: { color: theme.colors.white },
  formSection: {
    gap: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.lg,
  },
  sectionTitle: { ...theme.typography.title, color: theme.colors.textStrong },
  twoColumnFields: { flexDirection: 'row', gap: theme.spacing.md },
  fieldColumn: { flex: 1, minWidth: 0 },
  securityNotice: {
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceTint,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.xs,
  },
  securityNoticeText: { ...theme.typography.bodySmall, color: theme.colors.textMuted, flex: 1 },
  errorText: { ...theme.typography.bodySmall, color: theme.colors.danger },
  statusNotice: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceTint,
    padding: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.xs,
  },
  statusNoticeText: { ...theme.typography.bodySmall, color: theme.colors.textMuted, flex: 1 },
  reviewCard: {
    borderRadius: theme.radius.md,
    backgroundColor: '#EDF7F2',
    borderWidth: 1,
    borderColor: '#C4DED2',
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  reviewRow: { flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.sm },
  reviewLabel: { ...theme.typography.bodySmall, color: theme.colors.textMuted },
  reviewValue: { ...theme.typography.bodySmall, color: theme.colors.textStrong, fontWeight: '700', textAlign: 'right', flexShrink: 1 },
  confirmationText: { ...theme.typography.caption, color: theme.colors.textMuted },
  balanceCard: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
    ...theme.shadows.surface,
  },
  desktopBalanceCard: { flex: 1, minWidth: 300 },
  mobileBalanceCard: { width: '100%', padding: theme.spacing.md },
  balanceIcon: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceLabel: { ...theme.typography.label, color: theme.colors.textMuted },
  balanceValue: { ...theme.typography.display, color: theme.colors.primaryDeep },
  mobileBalanceValue: { ...theme.typography.h1 },
  balanceRecord: { ...theme.typography.bodySmall, color: theme.colors.textMuted },
  balanceDivider: { height: 1, backgroundColor: theme.colors.border, marginVertical: theme.spacing.xs },
  successCard: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.xl,
    gap: theme.spacing.md,
    alignItems: 'center',
    ...theme.shadows.surface,
  },
  successIcon: { alignItems: 'center', justifyContent: 'center' },
  successAmount: { ...theme.typography.display, color: theme.colors.primaryDeep },
  receiptRow: {
    width: '100%',
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceTint,
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  receiptValue: { ...theme.typography.mono, color: theme.colors.textStrong },
  pressed: { opacity: 0.9 },
});
