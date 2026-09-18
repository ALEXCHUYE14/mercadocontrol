import Link from 'next/link';
import { Tag } from 'lucide-react';
import { InventoryList } from '@/components/inventory/InventoryList';

export default function MermasPage() {
  return (
    <>
      <div className="mb-4">
        <h1 className="text-2xl font-extrabold">Mermas y frescura</h1>
        <p className="text-muted-foreground">
          Registra pérdidas a un tap. Prioriza lo urgente para no perder plata.
        </p>
      </div>

      <Link
        href="/remates"
        className="mb-4 flex items-center gap-3 rounded-2xl bg-atencion/10 p-4 font-semibold text-atencion"
      >
        <Tag className="h-6 w-6" />
        Armar catálogo de remate para WhatsApp
      </Link>

      <InventoryList />
    </>
  );
}
