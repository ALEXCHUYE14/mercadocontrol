import type { Metadata } from 'next';
import { RecoveryLoader } from '@/components/auth/RecoveryLoader';

export const metadata: Metadata = { title: 'Recuperar contraseña' };

export default function RecuperarPage() {
  return <RecoveryLoader />;
}
