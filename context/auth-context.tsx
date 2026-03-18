import { PropsWithChildren, createContext, useContext, useMemo, useState } from 'react';

type AuthContextValue = {
  isAuthenticated: boolean;
  userEmail: string | null;
  pendingEmail: string;
  setPendingEmail: (email: string) => void;
  completeSignIn: (email: string) => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [pendingEmail, setPendingEmailState] = useState('');

  const setPendingEmail = (email: string) => {
    setPendingEmailState(normalizeEmail(email));
  };

  const completeSignIn = (email: string) => {
    const normalized = normalizeEmail(email);
    setUserEmail(normalized);
    setPendingEmailState(normalized);
  };

  const signOut = () => {
    setUserEmail(null);
    setPendingEmailState('');
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: Boolean(userEmail),
      userEmail,
      pendingEmail,
      setPendingEmail,
      completeSignIn,
      signOut,
    }),
    [pendingEmail, userEmail]
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
