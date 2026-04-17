import AsyncStorage from '@react-native-async-storage/async-storage';
import { PropsWithChildren, createContext, useContext, useEffect, useMemo, useState } from 'react';

import { Customer } from '@/types/customer';
import { fetchCustomersByEmail } from '@/services/customer-api';
import { getSupabaseClient } from '@/services/supabase';
import { CustomerLookupRecord } from '@/types/customer';
import { matchesCustomerInsuredId, pickPreferredCustomerLookup } from '@/utils/customer-selection';

const CUSTOMER_TABLE = process.env.EXPO_PUBLIC_SUPABASE_CUSTOMER_TABLE?.trim() || 'portal_customers';
const SELECTED_CUSTOMER_STORAGE_KEY = 'portal_selected_customer';

type AuthContextValue = {
  isLoadingAuth: boolean;
  isAuthenticated: boolean;
  userEmail: string | null;
  customer: Customer | null;
  pendingEmail: string;
  pendingInsuredId: string;
  setPendingEmail: (email: string, insuredId?: string | null) => void;
  setPendingInsuredId: (insuredId: string) => void;
  setCustomer: (customer: Customer | null) => void;
  completeSignIn: (email: string, customerData?: Customer | null, insuredId?: string | null) => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

type PersistedCustomerSelection = {
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

function hasText(value: string | null | undefined) {
  return Boolean(value?.trim());
}

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

function buildFullName(firstName: string | null, lastName: string | null, commercialName: string | null) {
  const first = firstName?.trim();
  const last = lastName?.trim();
  const combined = [first, last].filter(Boolean).join(' ');
  if (combined) return combined;
  return commercialName?.trim() || null;
}

function mapCustomerLookupToProfile(customer: CustomerLookupRecord): Customer {
  return {
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
  return (
    rows.find((row) => matchesCustomerInsuredId(row.insured_id, preferredInsuredId)) ??
    rows.find((row) => row.is_active !== false && hasText(row.insured_id)) ??
    rows.find((row) => row.is_active !== false) ??
    rows.find((row) => hasText(row.insured_id)) ??
    rows[0] ??
    null
  );
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [customer, setCustomerState] = useState<Customer | null>(null);
  const [pendingEmail, setPendingEmailState] = useState('');
  const [pendingInsuredId, setPendingInsuredIdState] = useState('');

  useEffect(() => {
    let mounted = true;
    let unsubscribe: () => void = () => {};

    const hydrateCustomerForEmail = async (email: string, preferredInsuredId?: string | null) => {
      try {
        const normalizedEmail = normalizeEmail(email);

        try {
          const customers = await fetchCustomersByEmail(normalizedEmail);
          if (!mounted) return;

          const nextCustomer = pickPreferredCustomerLookup(customers, preferredInsuredId);
          if (nextCustomer) {
            setCustomerState(mapCustomerLookupToProfile(nextCustomer));
            const nextInsuredId = nextCustomer.insuredId?.trim() ?? '';
            setPendingInsuredIdState(nextInsuredId);
            void persistSelectedCustomer(normalizedEmail, nextInsuredId);
            return;
          }
        } catch {
          // Fall back to cached customer data when live lookup is unavailable.
        }

        const supabase = getSupabaseClient();
        const { data, error } = await supabase
          .from(CUSTOMER_TABLE)
          .select(
            'database_id, commercial_name, first_name, last_name, source_payload, email, phone, cell_phone, customer_id, insured_id, is_active'
          )
          .eq('login_email', normalizedEmail)
          .order('is_active', { ascending: false })
          .order('updated_at', { ascending: false });

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
        if (!mounted) return;
        const preferredInsuredId =
          sessionEmail && persistedSelection?.email === normalizeEmail(sessionEmail)
            ? persistedSelection.insuredId
            : '';
        setUserEmail(sessionEmail);
        if (sessionEmail) setPendingEmailState(sessionEmail);
        setPendingInsuredIdState(preferredInsuredId);
        if (sessionEmail) {
          void hydrateCustomerForEmail(sessionEmail, preferredInsuredId);
        }
        setIsLoadingAuth(false);

        const authListener = supabase.auth.onAuthStateChange(async (_event, session) => {
          const nextEmail = session?.user?.email ?? null;
          setUserEmail(nextEmail);
          if (!nextEmail) {
            setPendingEmailState('');
            setPendingInsuredIdState('');
            setCustomerState(null);
            void AsyncStorage.removeItem(SELECTED_CUSTOMER_STORAGE_KEY);
            return;
          }
          const nextSelection = await readPersistedCustomerSelection();
          if (!mounted) return;
          const nextInsuredId =
            nextSelection?.email === normalizeEmail(nextEmail) ? nextSelection.insuredId : '';
          setPendingEmailState(nextEmail);
          setPendingInsuredIdState(nextInsuredId);
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
  }, []);

  const setPendingEmail = (email: string, insuredId?: string | null) => {
    setPendingEmailState(normalizeEmail(email));
    setPendingInsuredIdState(insuredId?.trim() ?? '');
  };

  const setPendingInsuredId = (insuredId: string) => {
    setPendingInsuredIdState(insuredId.trim());
  };

  const setCustomer = (nextCustomer: Customer | null) => {
    setCustomerState(nextCustomer);
  };

  const completeSignIn = (email: string, customerData?: Customer | null, insuredId?: string | null) => {
    const normalized = normalizeEmail(email);
    const normalizedInsuredId = insuredId?.trim() ?? customerData?.insuredId?.trim() ?? '';
    setUserEmail(normalized);
    setPendingEmailState(normalized);
    setPendingInsuredIdState(normalizedInsuredId);
    setCustomerState({
      email: normalized,
      ...(customerData ?? {}),
    });
    void persistSelectedCustomer(normalized, normalizedInsuredId);
  };

  const signOut = async () => {
    try {
      const supabase = getSupabaseClient();
      await supabase.auth.signOut();
    } finally {
      setUserEmail(null);
      setPendingEmailState('');
      setPendingInsuredIdState('');
      setCustomerState(null);
      await AsyncStorage.removeItem(SELECTED_CUSTOMER_STORAGE_KEY);
    }
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      isLoadingAuth,
      isAuthenticated: Boolean(userEmail),
      userEmail,
      customer,
      pendingEmail,
      pendingInsuredId,
      setPendingEmail,
      setPendingInsuredId,
      setCustomer,
      completeSignIn,
      signOut,
    }),
    [customer, isLoadingAuth, pendingEmail, pendingInsuredId, userEmail]
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
