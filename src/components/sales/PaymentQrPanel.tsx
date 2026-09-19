'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Maximize2, Minimize2, QrCode } from 'lucide-react';
import { can } from '@/lib/auth/permissions';
import { cn, formatPEN } from '@/lib/utils';
import { useAppStore } from '@/stores/useAppStore';

/**
 * QR de Yape/Plin para que el cliente escanee al pagar. Toca la imagen para ampliarla
 * (más fácil de escanear a distancia). Si aún no hay QR, guía a subirlo en Ajustes.
 */
export function PaymentQrPanel({
  method,
  qr,
  total,
}: {
  method: 'yape' | 'plin';
  qr: string | null;
  total: number;
}) {
  const [big, setBig] = useState(false);
  const role = useAppStore((s) => s.role);
  const label = method === 'yape' ? 'Yape' : 'Plin';

  if (!qr) {
    return (
      <div role="note" className="flex items-start gap-3 rounded-2xl border border-dashed border-border p-3 text-sm">
        <QrCode className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
        <p className="text-muted-foreground">
          Aún no subiste tu QR de {label}.{' '}
          {can(role, 'sell') && (
            <Link href="/ajustes" className="font-bold text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-400">
              Súbelo en Ajustes → Cobros con QR
            </Link>
          )}
          . Mientras tanto puedes cobrar y confirmar la venta normalmente.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-2xl border border-border/70 bg-secondary/40 p-3 text-center">
      <p className="text-sm font-semibold text-muted-foreground">Pide al cliente que escanee tu QR de {label}</p>
      <p className="text-2xl font-extrabold tabular text-emerald-700 dark:text-emerald-300">{formatPEN(total)}</p>
      <button
        type="button"
        onClick={() => setBig((b) => !b)}
        aria-label={big ? 'Reducir el QR' : 'Ampliar el QR'}
        className={cn(
          'relative mx-auto block rounded-2xl bg-white p-2 shadow-card transition-all active:scale-[0.99]',
          big ? 'w-full max-w-[420px]' : 'w-full max-w-[240px]'
        )}
      >
        {/* Fondo blanco fijo: el QR debe verse igual en modo oscuro para poder escanearse */}
        <img src={qr} alt={`Código QR de ${label} para pagar`} className="mx-auto block h-auto w-full object-contain" />
        <span className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white">
          {big ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </span>
      </button>
      <p className="text-xs text-muted-foreground">
        Cuando llegue el pago a tu {label}, confirma la venta abajo.
      </p>
    </div>
  );
}
