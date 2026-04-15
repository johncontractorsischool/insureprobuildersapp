import { PropsWithChildren, createContext, useContext, useEffect, useMemo, useState } from 'react';

import { Customer } from '@/types/customer';
import { fetchCustomersByEmail } from '@/services/customer-api';
import { getSupabaseClient } from '@/services/supabase';
import { CustomerLookupRecord } from '@/types/customer';

const CUSTOMER_TABLE = process.env.EXPO_PUBLIC_SUPABASE_CUSTOMER_TABLE?.trim() || 'portal_customers';

type AuthContextValue = {
  isLoadingAuth: boolean;
  isAuthenticated: boolean;
  userEmail: string | null;
  customer: Customer | null;
  pendingEmail: string;
  setPendingEmail: (email: string) => void;
  setCustomer: (customer: Customer | null) => void;
  completeSignIn: (email: string, customerData?: Customer | null) => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

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

function pickBestCustomerLookup(customers: CustomerLookupRecord[]) {
  return customers.find((customer) => customer.active && hasText(customer.insuredId)) ??
    customers.find((customer) => customer.active) ??
    customers.find((customer) => hasText(customer.insuredId)) ??
    customers[0] ??
    null;
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

function pickBestPortalCustomer(rows: PortalCustomerRow[]) {
  return (
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

  useEffect(() => {
    let mounted = true;
    let unsubscribe: () => void = () => {};

    const hydrateCustomerForEmail = async (email: string) => {
      try {
        const normalizedEmail = normalizeEmail(email);

        try {
          const customers = await fetchCustomersByEmail(normalizedEmail);
          if (!mounted) return;

          const nextCustomer = pickBestCustomerLookup(customers);
          if (nextCustomer) {
            setCustomerState(mapCustomerLookupToProfile(nextCustomer));
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
        const cachedCustomer = pickBestPortalCustomer(data as PortalCustomerRow[]);
        if (!cachedCustomer) return;
        setCustomerState(mapPortalCustomer(cachedCustomer, normalizedEmail));
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
        setUserEmail(sessionEmail);
        if (sessionEmail) setPendingEmailState(sessionEmail);
        if (sessionEmail) {
          void hydrateCustomerForEmail(sessionEmail);
        }
        setIsLoadingAuth(false);

        const authListener = supabase.auth.onAuthStateChange((_event, session) => {
          const nextEmail = session?.user?.email ?? null;
          setUserEmail(nextEmail);
          if (!nextEmail) {
            setPendingEmailState('');
            setCustomerState(null);
            return;
          }
          setPendingEmailState(nextEmail);
          void hydrateCustomerForEmail(nextEmail);
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

  const setPendingEmail = (email: string) => {
    setPendingEmailState(normalizeEmail(email));
  };

  const setCustomer = (nextCustomer: Customer | null) => {
    setCustomerState(nextCustomer);
  };

  const completeSignIn = (email: string, customerData?: Customer | null) => {
    const normalized = normalizeEmail(email);
    setUserEmail(normalized);
    setPendingEmailState(normalized);
    setCustomerState({
      email: normalized,
      ...(customerData ?? {}),
    });
  };

  const signOut = async () => {
    try {
      const supabase = getSupabaseClient();
      await supabase.auth.signOut();
    } finally {
      setUserEmail(null);
      setPendingEmailState('');
      setCustomerState(null);
    }
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      isLoadingAuth,
      isAuthenticated: Boolean(userEmail),
      userEmail,
      customer,
      pendingEmail,
      setPendingEmail,
      setCustomer,
      completeSignIn,
      signOut,
    }),
    [customer, isLoadingAuth, pendingEmail, userEmail]
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
