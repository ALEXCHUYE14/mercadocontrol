'use client';

import * as React from 'react';
import { getAuthService } from '@/lib/auth';
import type { AuthMode, AuthUser, SignInInput, SignUpInput, SignUpResult } from '@/lib/auth/types';

type Status = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  status: Status;
  user: AuthUser | null;
  mode: AuthMode;
  signIn: (input: SignInInput) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
  needsSignUp: () => Promise<boolean>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (next: string) => Promise<void>;
  changePassword: (current: string, next: string) => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

interface State {
  status: Status;
  user: AuthUser | null;
}

function sameUser(a: AuthUser | null, b: AuthUser | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.id === b.id &&
    a.email === b.email &&
    a.displayName === b.displayName &&
    a.stallName === b.stallName
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const service = React.useMemo(() => getAuthService(), []);
  const [state, setState] = React.useState<State>({ status: 'loading', user: null });

  // Evita re-renderizar toda la app cuando el proveedor re-emite el mismo usuario
  // (p. ej. renovaciones de token de Supabase).
  const apply = React.useCallback((user: AuthUser | null) => {
    setState((prev) =>
      prev.status !== 'loading' && sameUser(prev.user, user)
        ? prev
        : { status: user ? 'authenticated' : 'unauthenticated', user }
    );
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    service
      .getSession()
      .then((user) => {
        if (!cancelled) apply(user);
      })
      .catch(() => {
        if (!cancelled) apply(null);
      });
    const unsubscribe = service.onChange((user) => {
      if (!cancelled) apply(user);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [service, apply]);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      status: state.status,
      user: state.user,
      mode: service.mode,
      signIn: async (input) => {
        apply(await service.signIn(input));
      },
      signUp: async (input) => {
        const result = await service.signUp(input);
        if (result.user) apply(result.user);
        return result;
      },
      signOut: async () => {
        await service.signOut();
        apply(null);
      },
      needsSignUp: () => service.needsSignUp(),
      requestPasswordReset: (email) => service.requestPasswordReset(email),
      updatePassword: (next) => service.updatePassword(next),
      changePassword: (current, next) => service.changePassword(current, next),
    }),
    [service, state, apply]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
