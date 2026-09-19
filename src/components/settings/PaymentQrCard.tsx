'use client';

import { useRef, useState } from 'react';
import { ImagePlus, QrCode, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ErrorNote } from '@/components/ui/feedback';
import { useSaveSettings, useSettings } from '@/hooks/useSales';
import { processQrFile } from '@/lib/media/qrImage';
import type { PaymentQr } from '@/lib/db/settings';
import { errorMessage } from '@/lib/utils';

type Slot = keyof PaymentQr;

const SLOTS: { key: Slot; label: string; emoji: string; hint: string }[] = [
  { key: 'yape', label: 'Yape', emoji: '📱', hint: 'En la app Yape: «Mi QR» → toma una captura y súbela.' },
  { key: 'plin', label: 'Plin', emoji: '📲', hint: 'En tu app de Plin: «Mi QR» → captura y súbela.' },
];

/** Sube tu propio QR de Yape / Plin: se mostrará al cobrar con ese método. Es un ajuste del dispositivo. */
export function PaymentQrCard() {
  const { data: settings } = useSettings();
  const save = useSaveSettings();
  const [busy, setBusy] = useState<Slot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const inputs = useRef<Record<Slot, HTMLInputElement | null>>({ yape: null, plin: null });

  const qr = settings?.paymentQr ?? { yape: null, plin: null };

  const update = async (slot: Slot, value: string | null) => {
    // Solo el espacio tocado: el guardado combina con lo último almacenado (no borra el otro QR)
    await save.mutateAsync({ paymentQr: { [slot]: value } });
  };

  const onFile = async (slot: Slot, file: File | undefined) => {
    if (!file || busy) return;
    setError(null);
    setOk(null);
    setBusy(slot);
    try {
      const dataUrl = await processQrFile(file);
      await update(slot, dataUrl);
      setOk(`QR de ${slot === 'yape' ? 'Yape' : 'Plin'} guardado`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
      const input = inputs.current[slot];
      if (input) input.value = ''; // permite volver a elegir el mismo archivo
    }
  };

  const remove = async (slot: Slot) => {
    if (busy) return;
    setError(null);
    setOk(null);
    setBusy(slot);
    try {
      await update(slot, null);
      setOk('QR eliminado');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="h-5 w-5" /> Cobros con QR
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Sube tu código QR y aparecerá grande al cobrar con Yape o Plin, para que el cliente lo escanee. Consejo:
          recorta la captura para que se vea solo el QR.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          {SLOTS.map(({ key, label, emoji, hint }) => {
            const value = qr[key];
            const isBusy = busy === key;
            return (
              <div key={key} className="space-y-3 rounded-2xl border border-border/70 p-3">
                <p className="font-bold">
                  {emoji} {label}
                </p>
                {value ? (
                  <div className="flex justify-center rounded-xl bg-white p-2">
                    {/* Data URL local: next/image no aplica */}
                    <img src={value} alt={`Código QR de ${label}`} className="h-40 w-40 object-contain" />
                  </div>
                ) : (
                  <div className="flex h-40 items-center justify-center rounded-xl border-2 border-dashed border-border text-center text-sm text-muted-foreground">
                    Sin QR
                  </div>
                )}
                <input
                  ref={(el) => {
                    inputs.current[key] = el;
                  }}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  aria-label={`Elegir imagen del QR de ${label}`}
                  onChange={(e) => void onFile(key, e.target.files?.[0])}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant={value ? 'outline' : 'primary'}
                    size="sm"
                    className={value ? '' : 'col-span-2'}
                    disabled={busy !== null}
                    onClick={() => inputs.current[key]?.click()}
                  >
                    <ImagePlus className="h-4 w-4" />
                    {isBusy ? 'Procesando…' : value ? 'Cambiar' : 'Subir QR'}
                  </Button>
                  {value && (
                    <Button variant="ghost" size="sm" className="text-alerta" disabled={busy !== null} onClick={() => void remove(key)}>
                      <Trash2 className="h-4 w-4" /> Quitar
                    </Button>
                  )}
                </div>
                {!value && <p className="text-xs text-muted-foreground">{hint}</p>}
              </div>
            );
          })}
        </div>

        <ErrorNote message={error} />
        {ok && <p role="status" className="rounded-xl bg-fresco/10 px-3 py-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">{ok}</p>}
        <p className="text-xs text-muted-foreground">
          El QR se guarda en este dispositivo. Si también cobras desde otro celular, súbelo allí.
        </p>
      </CardContent>
    </Card>
  );
}
