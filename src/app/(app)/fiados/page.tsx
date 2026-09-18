import type { Metadata } from 'next';
import { CreditScreen } from '@/components/credit/CreditScreen';

export const metadata: Metadata = { title: 'Fiados' };

export default function FiadosPage() {
  return <CreditScreen />;
}
