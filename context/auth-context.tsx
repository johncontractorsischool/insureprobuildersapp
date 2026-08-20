import AsyncStorage from '@react-native-async-storage/async-storage';
import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import type { ClientSignupRequest } from '@/services/client-signup-api';
import { resolveMyAccount, resolveMyAccountByLicense } from '@/services/customer-api';
import { PbiaApiError } from '@/services/pbia-client';
import { getPortalConfig } from '@/services/portal-config';
import { getSupabaseClient } from '@/services/supabase';
import type { Customer, CustomerLookupRecord } from '@/types/customer';
import { matchesCustomerInsuredId } from '@/utils/customer-selection';

const CUSTOMER_TABLE = process.env.EXPO_PUBLIC_SUPABASE_CUSTOMER_TABLE?.trim() || 'portal_customers';
const SELECTED_CUSTOMER_STORAGE_KEY = 'portal_selected_customer';
const REVIEW_SESSION_STORAGE_KEY = 'portal_review_session';
const LIVE_CUSTOMER_RESTORE_TIMEOUT_MS = 5000;
const CACHED_CUSTOMER_RESTORE_TIMEOUT_MS = 3000;

type AuthContextValue = {
  isLoadingAuth: boolean;
  isAuthenticated: boolean;
  userEmail: string | null;
  customer: Customer | null;
  pendingEmail: string;
  pendingInsuredId: string;
  pendingSignup: ClientSignupRequest | null;
  setPendingEmail: (email: string, insuredId?: string | null) => void;
  setPendingInsuredId: (insuredId: string) => void;
  setPendingSignup: (signup: ClientSignupRequest) => void;
  clearPendingSignup: () => void;
  setCustomer: (customer: Customer | null) => void;
  completeSignIn: (email: string, customerData?: Customer | null, insuredId?: string | null) => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function withTimeout<T>(operation: PromiseLike<T>, timeoutMs: number) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error('Customer account lookup timed out.')),
          timeoutMs
        );
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

type PersistedCustomerSelection = {
  email: string;
  insuredId: string;
};

type PersistedReviewSession = {
  email: string;
  insuredId: string;
};

type PortalCustomerRow = {
  database_id: string | null;
  commercial_name: string | null;
  first_name: string | null;
  last_name: string | null;
  source_payload?: Partial<CustomerLookupRecord> | null;
  email: string | null;
  phone: string | null;
  cell_phone: string | null;
  customer_id: string | null;
  insured_id: string | null;
  is_active: boolean | null;
};

async function readPersistedCustomerSelection() {
  try {
    const raw = await AsyncStorage.getItem(SELECTED_CUSTOMER_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<PersistedCustomerSelection>;
    if (typeof parsed.email !== 'string' || typeof parsed.insuredId !== 'string') {
      return null;
    }

    const email = normalizeEmail(parsed.email);
    const insuredId = parsed.insuredId.trim();
    if (!email || !insuredId) return null;

    return { email, insuredId };
  } catch {
    return null;
  }
}

async function persistSelectedCustomer(email: string, insuredId: string | null | undefined) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedInsuredId = insuredId?.trim() ?? '';

  if (!normalizedEmail || !normalizedInsuredId) {
    await AsyncStorage.removeItem(SELECTED_CUSTOMER_STORAGE_KEY);
    return;
  }

  await AsyncStorage.setItem(
    SELECTED_CUSTOMER_STORAGE_KEY,
    JSON.stringify({
      email: normalizedEmail,
      insuredId: normalizedInsuredId,
    } satisfies PersistedCustomerSelection)
  );
}

async function readPersistedReviewSession() {
  try {
    const raw = await AsyncStorage.getItem(REVIEW_SESSION_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<PersistedReviewSession>;
    if (typeof parsed.email !== 'string' || typeof parsed.insuredId !== 'string') {
      return null;
    }

    const email = normalizeEmail(parsed.email);
    const insuredId = parsed.insuredId.trim();
    if (!email || !insuredId) return null;

    return { email, insuredId };
  } catch {
    return null;
  }
}

async function persistReviewSession(email: string, insuredId: string | null | undefined) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedInsuredId = insuredId?.trim() ?? '';

  if (!normalizedEmail || !normalizedInsuredId) {
    await AsyncStorage.removeItem(REVIEW_SESSION_STORAGE_KEY);
    return;
  }

  await AsyncStorage.setItem(
    REVIEW_SESSION_STORAGE_KEY,
    JSON.stringify({
      email: normalizedEmail,
      insuredId: normalizedInsuredId,
    } satisfies PersistedReviewSession)
  );
}

function buildFullName(firstName: string | null, lastName: string | null, commercialName: string | null) {
  const first = firstName?.trim();
  const last = lastName?.trim();
  const combined = [first, last].filter(Boolean).join(' ');
  if (combined) return combined;
  return commercialName?.trim() || null;
}

function mapCustomerLookupToProfile(customer: CustomerLookupRecord): Customer {
  return {
    accountId: customer.accountId ?? customer.databaseId,
    legalName: customer.legalName ?? customer.commercialName,
    dba: customer.dba,
    licenseNumber: customer.licenseNumber ?? customer.insuredId,
    status: customer.status ?? (customer.active ? 'ACTIVE' : 'INACTIVE'),
    entityType: customer.entityType,
    agentId: customer.agentId,
    policyCount: customer.policyCount ?? null,
    databaseId: customer.databaseId,
    commercialName: customer.commercialName,
    fullName: buildFullName(customer.firstName, customer.lastName, customer.commercialName),
    firstName: customer.firstName,
    lastName: customer.lastName,
    type: customer.type,
    addressLine1: customer.addressLine1,
    addressLine2: customer.addressLine2,
    city: customer.city,
    stateNameOrAbbreviation: customer.stateNameOrAbbreviation,
    zipCode: customer.zipCode,
    email: customer.eMail,
    phone: customer.phone,
    cellPhone: customer.cellPhone,
    smsPhone: customer.smsPhone,
    description: customer.description,
    website: customer.website,
    fein: customer.fein,
    customerId: customer.customerId,
    insuredId: customer.insuredId,
    active: customer.active,
  };
}

function mapPortalCustomer(row: PortalCustomerRow, loginEmail: string): Customer {
  const sourcePayload = row.source_payload;

  return {
    accountId: row.database_id,
    legalName: sourcePayload?.legalName ?? row.commercial_name,
    dba: sourcePayload?.dba ?? null,
    licenseNumber: sourcePayload?.licenseNumber ?? row.insured_id,
    status: sourcePayload?.status ?? (row.is_active === false ? 'INACTIVE' : 'ACTIVE'),
    entityType: sourcePayload?.entityType ?? null,
    agentId: sourcePayload?.agentId ?? null,
    policyCount: sourcePayload?.policyCount ?? null,
    databaseId: row.database_id,
    commercialName: row.commercial_name,
    fullName: buildFullName(row.first_name, row.last_name, row.commercial_name),
    firstName: row.first_name,
    lastName: row.last_name,
    type: typeof sourcePayload?.type === 'number' ? sourcePayload.type : null,
    addressLine1: sourcePayload?.addressLine1 ?? null,
    addressLine2: sourcePayload?.addressLine2 ?? null,
    city: sourcePayload?.city ?? null,
    stateNameOrAbbreviation: sourcePayload?.stateNameOrAbbreviation ?? null,
    zipCode: sourcePayload?.zipCode ?? null,
    email: row.email ?? loginEmail,
    phone: row.phone,
    cellPhone: row.cell_phone,
    smsPhone: sourcePayload?.smsPhone ?? null,
    description: sourcePayload?.description ?? null,
    website: sourcePayload?.website ?? null,
    fein: sourcePayload?.fein ?? null,
    customerId: row.customer_id,
    insuredId: row.insured_id,
    active: row.is_active ?? true,
  };
}

function pickBestPortalCustomer(rows: PortalCustomerRow[], preferredInsuredId?: string | null) {
  const preferredCustomer = rows.find((row) =>
    matchesCustomerInsuredId(row.insured_id, preferredInsuredId)
  );
  if (preferredCustomer) return preferredCustomer;
  return rows.length === 1 ? rows[0] : null;
}

type LiveCustomerResolution = {
  customer: CustomerLookupRecord | null;
  selectedInsuredId: string;
  invalidStoredSelection: boolean;
};

async function resolveLiveCustomerForRestore(
  email: string,
  preferredInsuredId?: string | null
): Promise<LiveCustomerResolution> {
  const resolution = await resolveMyAccount(email);

  if (resolution.status === 'ACCOUNT_RESOLVED') {
    return {
      customer: resolution.account,
      selectedInsuredId: resolution.account.insuredId?.trim() ?? '',
      invalidStoredSelection: false,
    };
  }

  if (resolution.status !== 'LICENSE_REQUIRED' || !preferredInsuredId?.trim()) {
    return { customer: null, selectedInsuredId: '', invalidStoredSelection: false };
  }

  try {
    const selectedResolution = await resolveMyAccountByLicense(email, preferredInsuredId);
    return {
      customer: selectedResolution.account,
      selectedInsuredId:
        preferredInsuredId.trim() || selectedResolution.account.insuredId?.trim() || '',
      invalidStoredSelection: false,
    };
  } catch (selectionError) {
    if (
      selectionError instanceof PbiaApiError &&
      [400, 404, 409].includes(selectionError.status)
    ) {
      return { customer: null, selectedInsuredId: '', invalidStoredSelection: true };
    }
    throw selectionError;
  }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const portalConfig = getPortalConfig();
  const reviewEnabled = portalConfig.review.enabled;
  const reviewEmail = portalConfig.review.email;
  const reviewCustomer = portalConfig.review.data?.customer ?? null;
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [customer, setCustomerState] = useState<Customer | null>(null);
  const [pendingEmail, setPendingEmailState] = useState('');
  const [pendingInsuredId, setPendingInsuredIdState] = useState('');
  const [pendingSignup, setPendingSignupState] = useState<ClientSignupRequest | null>(null);
  const accountSelectionPendingRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    let unsubscribe: () => void = () => {};

    const hydrateCustomerForEmail = async (email: string, preferredInsuredId?: string | null) => {
      try {
        const normalizedEmail = normalizeEmail(email);

        try {
          const liveResolution = await withTimeout(
            resolveLiveCustomerForRestore(normalizedEmail, preferredInsuredId),
            LIVE_CUSTOMER_RESTORE_TIMEOUT_MS
          );
          if (!mounted) return;

          if (liveResolution.invalidStoredSelection) {
            setCustomerState(null);
            setPendingInsuredIdState('');
            void persistSelectedCustomer(normalizedEmail, null);
            return;
          }

          if (liveResolution.customer) {
            setCustomerState(mapCustomerLookupToProfile(liveResolution.customer));
            setPendingInsuredIdState(liveResolution.selectedInsuredId);
            void persistSelectedCustomer(normalizedEmail, liveResolution.selectedInsuredId);
            return;
          }

          // Never choose an account when signup is allowed or the verified email
          // has multiple records without a previously selected CSLB identifier.
          setCustomerState(null);
          setPendingInsuredIdState('');
          return;
        } catch (liveLookupError) {
          if (liveLookupError instanceof PbiaApiError && liveLookupError.status === 401) {
            setCustomerState(null);
            setPendingInsuredIdState('');
            return;
          }
          // Fall back to cached customer data when live lookup is unavailable.
        }

        const supabase = getSupabaseClient();
        const { data, error } = await withTimeout(
          supabase
            .from(CUSTOMER_TABLE)
            .select(
              'database_id, commercial_name, first_name, last_name, source_payload, email, phone, cell_phone, customer_id, insured_id, is_active'
            )
            .eq('login_email', normalizedEmail)
            .order('is_active', { ascending: false })
            .order('updated_at', { ascending: false }),
          CACHED_CUSTOMER_RESTORE_TIMEOUT_MS
        );

        if (!mounted || error || !data || data.length === 0) return;
        const cachedCustomer = pickBestPortalCustomer(data as PortalCustomerRow[], preferredInsuredId);
        if (!cachedCustomer) return;
        setCustomerState(mapPortalCustomer(cachedCustomer, normalizedEmail));
        const nextInsuredId = cachedCustomer.insured_id?.trim() ?? '';
        setPendingInsuredIdState(nextInsuredId);
      } catch {
        // Leave customer as-is when hydration fails.
      }
    };

    const initializeAuth = async () => {
      try {
        const supabase = getSupabaseClient();
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;

        const sessionEmail = data.session?.user?.email ?? null;
        const persistedSelection = await readPersistedCustomerSelection();
        const reviewSession = reviewEnabled ? await readPersistedReviewSession() : null;
        if (!reviewEnabled) {
          void AsyncStorage.removeItem(REVIEW_SESSION_STORAGE_KEY);
        }
        if (!mounted) return;
        const preferredInsuredId =
          sessionEmail && persistedSelection?.email === normalizeEmail(sessionEmail)
            ? persistedSelection.insuredId
            : '';
        const canRestoreReviewSession =
          !sessionEmail &&
          reviewEnabled &&
          reviewSession?.email === reviewEmail &&
          Boolean(reviewCustomer);

        setUserEmail(sessionEmail ?? (canRestoreReviewSession ? reviewSession?.email ?? null : null));
        setPendingEmailState(sessionEmail ?? (canRestoreReviewSession ? reviewSession?.email ?? '' : ''));
        setPendingInsuredIdState(
          canRestoreReviewSession ? reviewSession?.insuredId ?? '' : preferredInsuredId
        );
        if (sessionEmail) {
          await hydrateCustomerForEmail(sessionEmail, preferredInsuredId);
        } else if (canRestoreReviewSession && reviewCustomer) {
          setCustomerState({
            ...reviewCustomer,
            email: reviewSession?.email ?? reviewCustomer.email,
          });
        }
        setIsLoadingAuth(false);

        const authListener = supabase.auth.onAuthStateChange(async (_event, session) => {
          const shouldWaitForAccountSelection = accountSelectionPendingRef.current;
          const nextEmail = session?.user?.email ?? null;
          setUserEmail(nextEmail);
          if (!nextEmail) {
            const storedReviewSession = reviewEnabled ? await readPersistedReviewSession() : null;
            if (
              mounted &&
              reviewEnabled &&
              storedReviewSession?.email === reviewEmail &&
              reviewCustomer
            ) {
              setUserEmail(storedReviewSession.email);
              setPendingEmailState(storedReviewSession.email);
              setPendingInsuredIdState(storedReviewSession.insuredId);
              setCustomerState({ ...reviewCustomer, email: storedReviewSession.email });
              return;
            }

            accountSelectionPendingRef.current = false;
            setPendingEmailState('');
            setPendingInsuredIdState('');
            setPendingSignupState(null);
            setCustomerState(null);
            void AsyncStorage.removeItem(SELECTED_CUSTOMER_STORAGE_KEY);
            void AsyncStorage.removeItem(REVIEW_SESSION_STORAGE_KEY);
            return;
          }

          setPendingEmailState(nextEmail);
          if (shouldWaitForAccountSelection) {
            // OTP verification establishes the Supabase session before the app has
            // resolved which account a multi-account email is allowed to open.
            setPendingInsuredIdState('');
            setCustomerState(null);
            return;
          }

          const nextSelection = await readPersistedCustomerSelection();
          if (!mounted) return;
          const nextInsuredId =
            nextSelection?.email === normalizeEmail(nextEmail) ? nextSelection.insuredId : '';
          setPendingInsuredIdState(nextInsuredId);
          void AsyncStorage.removeItem(REVIEW_SESSION_STORAGE_KEY);
          void hydrateCustomerForEmail(nextEmail, nextInsuredId);
        });
        unsubscribe = () => authListener.data.subscription.unsubscribe();
      } catch {
        if (mounted) {
          setIsLoadingAuth(false);
        }
      }
    };

    void initializeAuth();

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [reviewCustomer, reviewEmail, reviewEnabled]);

  const setPendingEmail = (email: string, insuredId?: string | null) => {
    accountSelectionPendingRef.current = true;
    setPendingEmailState(normalizeEmail(email));
    setPendingInsuredIdState(insuredId?.trim() ?? '');
  };

  const setPendingInsuredId = (insuredId: string) => {
    setPendingInsuredIdState(insuredId.trim());
  };

  const setPendingSignup = (signup: ClientSignupRequest) => {
    setPendingSignupState(signup);
  };

  const clearPendingSignup = () => {
    setPendingSignupState(null);
  };

  const setCustomer = (nextCustomer: Customer | null) => {
    setCustomerState(nextCustomer);
  };

  const completeSignIn = useCallback((email: string, customerData?: Customer | null, insuredId?: string | null) => {
    const normalized = normalizeEmail(email);
    const normalizedInsuredId = insuredId?.trim() ?? customerData?.insuredId?.trim() ?? '';
    const isReviewSession = reviewEnabled && normalized === reviewEmail;
    accountSelectionPendingRef.current = false;
    setUserEmail(normalized);
    setPendingEmailState(normalized);
    setPendingInsuredIdState(normalizedInsuredId);
    setCustomerState({
      email: normalized,
      ...(customerData ?? {}),
    });
    setPendingSignupState(null);
    void persistSelectedCustomer(normalized, normalizedInsuredId);
    void (isReviewSession
      ? persistReviewSession(normalized, normalizedInsuredId)
      : AsyncStorage.removeItem(REVIEW_SESSION_STORAGE_KEY));
  }, [reviewEmail, reviewEnabled]);

  const signOut = async () => {
    try {
      const supabase = getSupabaseClient();
      await supabase.auth.signOut();
    } finally {
      accountSelectionPendingRef.current = false;
      setUserEmail(null);
      setPendingEmailState('');
      setPendingInsuredIdState('');
      setPendingSignupState(null);
      setCustomerState(null);
      await AsyncStorage.removeItem(SELECTED_CUSTOMER_STORAGE_KEY);
      await AsyncStorage.removeItem(REVIEW_SESSION_STORAGE_KEY);
    }
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      isLoadingAuth,
      isAuthenticated: Boolean(userEmail && customer),
      userEmail,
      customer,
      pendingEmail,
      pendingInsuredId,
      pendingSignup,
      setPendingEmail,
      setPendingInsuredId,
      setPendingSignup,
      clearPendingSignup,
      setCustomer,
      completeSignIn,
      signOut,
    }),
    [
      completeSignIn,
      customer,
      isLoadingAuth,
      pendingEmail,
      pendingInsuredId,
      pendingSignup,
      userEmail,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
