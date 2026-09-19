'use client';

import { useState } from 'react';
import { Bluetooth, Printer, Unlink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ErrorNote } from '@/components/ui/feedback';
import { BluetoothHelp } from '@/components/ticket/BluetoothHelp';
import { useSaveSettings, useTicketBusiness } from '@/hooks/useSales';
import {
  BluetoothPrintError,
  disconnectPrinter,
  bluetoothSupport,
  pairPrinter,
  printBytes,
} from '@/lib/print/bluetooth';
import { encodeTicketEscpos } from '@/lib/print/escpos';
import { printHtml } from '@/lib/print/printHtml';
import { buildSampleTicket, renderTicketHtml } from '@/lib/logic/ticket';
import { errorMessage } from '@/lib/utils';

/** Impresora térmica: emparejar por Bluetooth, probar y olvidar. Es un ajuste del dispositivo. */
export function PrinterCard() {
  const { data: ctx } = useTicketBusiness();
  const save = useSaveSettings();
  const [busy, setBusy] = useState<null | 'pair' | 'test' | 'system'>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const bt = bluetoothSupport();
  const supported = bt.ok;
  const printer = ctx?.settings.bluetoothPrinter ?? null;
  const paper = ctx?.settings.paperWidth ?? 80;

  const run = async (kind: 'pair' | 'test' | 'system', fn: () => Promise<void>) => {
    if (busy) return;
    setError(null);
    setOk(null);
    setBusy(kind);
    try {
      await fn();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const pair = () =>
    run('pair', async () => {
      try {
        const p = await pairPrinter();
        await save.mutateAsync({ bluetoothPrinter: p });
        setOk(`Impresora «${p.name}» emparejada`);
      } catch (err) {
        if (err instanceof BluetoothPrintError && err.code === 'cancelled') return; // no es un error
        throw err;
      }
    });

  const sampleTicket = () =>
    buildSampleTicket(
      {
        name: ctx?.business.name ?? 'Mi Puesto',
        phone: ctx?.business.phone ?? null,
        address: ctx?.business.address ?? null,
        taxId: ctx?.business.taxId ?? null,
      },
      ctx?.settings.ticketFooter
    );

  const testBluetooth = () =>
    run('test', async () => {
      const bytes = encodeTicketEscpos(sampleTicket(), paper, { cut: ctx?.settings.autoCut });
      await printBytes(bytes, printer);
      setOk('Ticket de prueba enviado');
    });

  const testSystem = () =>
    run('system', async () => {
      await printHtml(renderTicketHtml(sampleTicket(), paper));
    });

  const forget = async () => {
    disconnectPrinter();
    await save.mutateAsync({ bluetoothPrinter: null });
    setOk('Impresora olvidada');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Printer className="h-5 w-5" /> Impresora
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {supported ? (
          <>
            <div className="flex items-center gap-3 rounded-2xl bg-secondary/70 p-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-card text-fresco">
                <Bluetooth className="h-6 w-6" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{printer ? printer.name : 'Sin impresora emparejada'}</p>
                <p className="text-xs text-muted-foreground">
                  {printer ? 'Bluetooth (BLE) · lista para imprimir' : 'Enciéndela y toca «Emparejar»'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button onClick={pair} disabled={busy !== null}>
                <Bluetooth className="h-5 w-5" /> {busy === 'pair' ? 'Buscando…' : printer ? 'Cambiar' : 'Emparejar'}
              </Button>
              <Button variant="outline" onClick={testBluetooth} disabled={!printer || busy !== null}>
                {busy === 'test' ? 'Enviando…' : 'Probar'}
              </Button>
              {printer && (
                <Button variant="ghost" className="col-span-2 text-alerta" onClick={forget} disabled={busy !== null}>
                  <Unlink className="h-4 w-4" /> Olvidar impresora
                </Button>
              )}
            </div>

            <label className="flex min-h-[48px] cursor-pointer items-center justify-between gap-3 rounded-xl border border-border/70 px-3">
              <span>
                <span className="block text-sm font-semibold">Cortar el papel al terminar</span>
                <span className="block text-xs text-muted-foreground">Actívalo solo si tu impresora tiene cortador</span>
              </span>
              <input
                type="checkbox"
                className="h-6 w-6 accent-emerald-600"
                checked={ctx?.settings.autoCut ?? false}
                onChange={(e) => save.mutate({ autoCut: e.target.checked })}
              />
            </label>

            <p className="text-xs text-muted-foreground">
              Funciona con impresoras térmicas <b>Bluetooth Low Energy (BLE)</b> en Chrome/Edge (Android o PC). Si la
              tuya es Bluetooth clásico, empareja en los ajustes de Android y usa RawBT o «Imprimir con el sistema».
              No disponible en iPhone/iPad.
            </p>
          </>
        ) : (
          !bt.ok && <BluetoothHelp reason={bt.reason} />
        )}

        <Button variant="outline" className="w-full" onClick={testSystem} disabled={busy !== null || !ctx}>
          <Printer className="h-5 w-5" /> {busy === 'system' ? 'Preparando…' : 'Ticket de prueba (sistema / PDF)'}
        </Button>

        <ErrorNote message={error} />
        {ok && <p role="status" className="rounded-xl bg-fresco/10 px-3 py-2 text-sm font-semibold text-fresco">{ok}</p>}
      </CardContent>
    </Card>
  );
}
