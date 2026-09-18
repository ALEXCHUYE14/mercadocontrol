import type { Metadata } from 'next';
import { SalesScreen } from '@/components/sales/SalesScreen';

export const metadata: Metadata = { title: 'Ventas' };

export default function VentasPage() {
  return <SalesScreen />;
}
