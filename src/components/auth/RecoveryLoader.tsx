'use client';

import dynamic from 'next/dynamic';
import { SplashScreen } from '@/components/auth/SplashScreen';
import '@/lib/auth/recoveryArrival'; // efecto de módulo: captura la URL antes de que Supabase la limpie

// Solo en el navegador: el estado inicial depende de la URL (enlace del correo),
// que el servidor no conoce; renderizarla en SSR causaría un desajuste de hidratación.
const RecoveryScreen = dynamic(
  () => import('@/components/auth/RecoveryScreen').then((m) => m.RecoveryScreen),
  { ssr: false, loading: () => <SplashScreen /> }
);

export function RecoveryLoader() {
  return <RecoveryScreen />;
}
