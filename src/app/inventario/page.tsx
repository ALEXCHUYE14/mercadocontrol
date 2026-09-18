import { InventoryList } from '@/components/inventory/InventoryList';
import { AddButton } from '@/components/layout/AddButton';

export default function InventarioPage() {
  return (
    <>
      <div className="mb-4">
        <h1 className="text-2xl font-extrabold">Inventario</h1>
        <p className="text-muted-foreground">Toca un producto para vender o registrar merma</p>
      </div>
      <InventoryList />
      <AddButton />
    </>
  );
}
