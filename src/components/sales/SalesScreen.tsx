'use client';

import { useState } from 'react';
import { NewSale } from '@/components/sales/NewSale';
import { SalesHistory } from '@/components/sales/SalesHistory';
import { PageHeader, Segmented } from '@/components/ui/feedback';

type Tab = 'vender' | 'historial';

export function SalesScreen() {
  const [tab, setTab] = useState<Tab>('vender');
  return (
    <>
      <PageHeader title="Ventas" subtitle="Cobra con ticket para imprimir o enviar por WhatsApp" />
      <div className="mb-4">
        <Segmented<Tab>
          label="Ventas"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'vender', label: 'Nueva venta' },
            { value: 'historial', label: 'Historial' },
          ]}
        />
      </div>
      {tab === 'vender' ? <NewSale /> : <SalesHistory />}
    </>
  );
}
