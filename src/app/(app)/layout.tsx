import { SessionGate } from '@/components/auth/SessionGate';
import { AppShell } from '@/components/layout/AppShell';

export default function PrivateLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionGate>
      <AppShell>{children}</AppShell>
    </SessionGate>
  );
}
