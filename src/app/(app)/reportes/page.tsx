import type { Metadata } from 'next';
import { ReportsScreen } from '@/components/reports/ReportsScreen';

export const metadata: Metadata = { title: 'Reportes' };

export default function ReportesPage() {
  return <ReportsScreen />;
}
