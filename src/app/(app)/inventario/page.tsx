import type { Metadata } from 'next';
import { InventoryList } from '@/components/inventory/InventoryList';
import { AddButton } from '@/components/layout/AddButton';
import { PageHeader } from '@/components/ui/feedback';

export const metadata: Metadata = { title: 'Inventario' };

export default function InventarioPage() {
  return (
    <>
      <PageHeader title="Inventario" subtitle="Vende o registra merma con un toque" />
      <InventoryList />
      <AddButton />
    </>
  );
}
