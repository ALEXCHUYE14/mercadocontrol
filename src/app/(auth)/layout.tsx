import { GuestGate } from '@/components/auth/GuestGate';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <GuestGate>{children}</GuestGate>;
}
