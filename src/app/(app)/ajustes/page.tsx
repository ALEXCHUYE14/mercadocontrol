import type { Metadata } from 'next';
import { SettingsScreen } from '@/components/settings/SettingsScreen';

export const metadata: Metadata = { title: 'Ajustes' };

export default function AjustesPage() {
  return <SettingsScreen />;
}
