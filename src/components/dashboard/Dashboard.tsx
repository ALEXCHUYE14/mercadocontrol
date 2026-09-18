'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  HandCoins,
  PackageMinus,
  Percent,
  Plus,
  Receipt,
  Trash2,
  TrendingUp,
  Trophy,
  Wallet,
} from 'lucide-react';
import { useTodayMetrics } from '@/hooks/useProducts';
import { useCreditOverview } from '@/hooks/useCredit';
import { useDashboardReport, useProfile } from '@/hooks/useSales';
import { totalReceivable } from '@/lib/logic/credit';
import { useAuth } from '@/lib/auth/AuthProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { InventoryList } from '@/components/inventory/InventoryList';
import { AddProductModal } from '@/components/inventory/AddProductModal';
import { MetricCard } from './MetricCard';
import { WeekChart } from './WeekChart';
import { formatPEN, formatQty } from '@/lib/utils';

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
}

export function Dashboard() {
  const { data: m } = useTodayMetrics();
  const { data: report } = useDashboardReport();
  const { data: profile } = useProfile();
  const { data: credit } = useCreditOverview();
  const { user } = useAuth();
  const [adding, setAdding] = useState(false);

  const name = (profile?.full_name || user?.displayName || '').trim().split(' ')[0];
  const today = report?.week[report.week.length - 1];
  const urgent = (m?.redCount ?? 0) + (m?.yellowCount ?? 0);

  return (
    <div className="space-y-6">
      {/* Hero: ventas de hoy */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-bosque via-emerald-800 to-fresco p-6 text-bosque-fg shadow-pop">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
        <p className="relative text-sm font-semibold text-white/80">
          {greeting()}{name ? `, ${name}` : ''} 👋
        </p>
        <p className="relative mt-3 text-sm font-medium text-white/75">Ventas de hoy</p>
        <p className="relative text-4xl font-extrabold tracking-tight tabular sm:text-5xl">
          {formatPEN(m?.totalSales ?? 0)}
        </p>
        <p className="relative mt-1 text-sm text-white/80">
          {today?.count ?? 0} {today?.count === 1 ? 'venta' : 'ventas'} con ticket
        </p>
        <div className="relative mt-5 grid grid-cols-2 gap-3">
          <Link
            href="/ventas"
            className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-white font-bold text-bosque shadow-sm active:scale-[0.98]"
          >
            <Receipt className="h-5 w-5" /> Nueva venta
          </Link>
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-white/15 font-bold text-white active:scale-[0.98]"
          >
            <Plus className="h-5 w-5" /> Producto
          </button>
        </div>
      </section>

      {/* Métricas clave */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <MetricCard label="Ganancia de hoy" value={formatPEN(report?.todayProfit ?? 0)} icon={Percent} tone="fresco" hint="Ventas − costo" />
        <MetricCard
          label="Por cobrar (fiado)"
          value={formatPEN(totalReceivable(credit?.balances ?? []))}
          icon={HandCoins}
          tone="alerta"
        />
        <MetricCard
          label="Stock bajo"
          value={String(m?.lowStockCount ?? 0)}
          icon={PackageMinus}
          tone="atencion"
          hint="Productos por reponer"
        />
        <MetricCard label="Pérdida por merma" value={formatPEN(m?.wasteLoss ?? 0)} icon={Trash2} tone="alerta" />
        <MetricCard label="Capital en inventario" value={formatPEN(m?.inventoryCapital ?? 0)} icon={Wallet} tone="bosque" />
        <MetricCard
          label="Para vender ya"
          value={String(urgent)}
          icon={AlertTriangle}
          tone="atencion"
          hint={`${m?.redCount ?? 0} urgentes · ${m?.yellowCount ?? 0} prioritarios`}
        />
      </div>

      {/* Alerta de remate si hay productos urgentes */}
      {(m?.redCount ?? 0) > 0 && (
        <Link
          href="/remates"
          className="flex items-center justify-between gap-3 rounded-2xl border border-alerta/20 bg-alerta/10 p-4 text-alerta active:scale-[0.99]"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔴</span>
            <div>
              <p className="font-bold">{m?.redCount} producto(s) por vencer</p>
              <p className="text-sm">Arma un catálogo de remate para WhatsApp</p>
            </div>
          </div>
          <ArrowRight className="h-6 w-6 shrink-0" />
        </Link>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-fresco" /> Ventas de la semana
            </CardTitle>
          </CardHeader>
          <CardContent>{report ? <WeekChart days={report.week} /> : <div className="h-40" />}</CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-atencion" /> Más vendidos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {report && report.top.length > 0 ? (
              <ol className="space-y-2.5">
                {report.top.map((p, i) => (
                  <li key={`${p.name}-${p.unit}`} className="flex items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-extrabold">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{formatQty(p.quantity, p.unit)}</p>
                    </div>
                    <span className="text-sm font-bold tabular">{formatPEN(p.revenue)}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Aún no hay ventas esta semana. Registra tu primera venta 🧾
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Vista rápida del inventario prioritario */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-extrabold">Atención prioritaria</h2>
          <Link href="/inventario" className="text-sm font-bold text-fresco">
            Ver todo
          </Link>
        </div>
        <InventoryList limit={4} />
      </section>

      <AddProductModal open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}
