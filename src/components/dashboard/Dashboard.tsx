'use client';

import Link from 'next/link';
import { TrendingUp, Trash2, Wallet, AlertTriangle, ArrowRight } from 'lucide-react';
import { useTodayMetrics } from '@/hooks/useProducts';
import { MetricCard } from './MetricCard';
import { InventoryList } from '@/components/inventory/InventoryList';
import { formatPEN } from '@/lib/utils';

export function Dashboard() {
  const { data: m } = useTodayMetrics();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">Hola 👋</h1>
        <p className="text-muted-foreground">Así va tu puesto hoy</p>
      </div>

      {/* Métricas clave */}
      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          label="Ventas del día"
          value={formatPEN(m?.totalSales ?? 0)}
          icon={TrendingUp}
          tone="fresco"
        />
        <MetricCard
          label="Pérdida por merma"
          value={formatPEN(m?.wasteLoss ?? 0)}
          icon={Trash2}
          tone="alerta"
        />
        <MetricCard
          label="Capital en inventario"
          value={formatPEN(m?.inventoryCapital ?? 0)}
          icon={Wallet}
          tone="bosque"
        />
        <MetricCard
          label="Para vender ya"
          value={String((m?.redCount ?? 0) + (m?.yellowCount ?? 0))}
          icon={AlertTriangle}
          tone="atencion"
          hint={`${m?.redCount ?? 0} urgentes · ${m?.yellowCount ?? 0} prioritarios`}
        />
      </div>

      {/* Alerta de remate si hay productos urgentes */}
      {(m?.redCount ?? 0) > 0 && (
        <Link
          href="/remates"
          className="flex items-center justify-between rounded-2xl bg-alerta/10 p-4 text-alerta"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔴</span>
            <div>
              <p className="font-bold">{m?.redCount} producto(s) por vencer</p>
              <p className="text-sm">Arma un catálogo de remate para WhatsApp</p>
            </div>
          </div>
          <ArrowRight className="h-6 w-6" />
        </Link>
      )}

      {/* Vista rápida del inventario prioritario */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Atención prioritaria</h2>
          <Link href="/inventario" className="text-sm font-semibold text-fresco">
            Ver todo
          </Link>
        </div>
        <InventoryList limit={4} />
      </div>
    </div>
  );
}
