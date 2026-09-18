import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Tag } from 'lucide-react';
import { InventoryList } from '@/components/inventory/InventoryList';
import { PageHeader } from '@/components/ui/feedback';

export const metadata: Metadata = { title: 'Mermas' };

export default function MermasPage() {
  return (
    <>
      <PageHeader
        title="Mermas y frescura"
        subtitle="Registra pérdidas a un tap. Prioriza lo urgente para no perder plata."
      />

      <Link
        href="/remates"
        className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-atencion/20 bg-atencion/10 p-4 font-semibold text-atencion active:scale-[0.99]"
      >
        <span className="flex items-center gap-3">
          <Tag className="h-6 w-6" />
          Armar catálogo de remate para WhatsApp
        </span>
        <ArrowRight className="h-5 w-5 shrink-0" />
      </Link>

      <InventoryList />
    </>
  );
}
