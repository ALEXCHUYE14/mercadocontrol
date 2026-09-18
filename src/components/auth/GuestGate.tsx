'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { SplashScreen } from '@/components/auth/SplashScreen';
import { useAuth } from '@/lib/auth/AuthProvider';

/** Pantallas públicas (login): si ya hay sesión, entra directo a la app. */
export function GuestGate({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (status === 'authenticated') router.replace('/');
  }, [status, router]);

  if (status !== 'unauthenticated') return <SplashScreen />;
  return <>{children}</>;
}
