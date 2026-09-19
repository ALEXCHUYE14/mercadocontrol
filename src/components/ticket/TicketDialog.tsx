'use client';

import { useMemo, useRef, useState } from 'react';
import { Ban, Bluetooth, Check, Copy, Printer, Send, Share2, Smartphone } from 'lucide-react';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { ErrorNote, Segmented, Spinner } from '@/components/ui/feedback';
import { useSaveSettings, useTicketBusiness } from '@/hooks/useSales';
import { useVoidSale } from '@/hooks/useProducts';
import { can } from '@/lib/auth/permissions';
import { BluetoothPrintError, bluetoothSupport, pairPrinter, printBytes } from '@/lib/print/bluetooth';
import { BluetoothHelp } from '@/components/ticket/BluetoothHelp';
import { encodeTicketEscpos, rawbtUrl } from '@/lib/print/escpos';
import { printHtml } from '@/lib/print/printHtml';
import {
  buildTicket,
  formatTicketText,
  renderTicketHtml,
  type PaperWidth,
} from '@/lib/logic/ticket';
import { waLink } from '@/lib/logic/whatsapp';
import { errorMessage, formatPEN } from '@/lib/utils';
import { useAppStore } from '@/stores/useAppStore';
import type { SaleWithItems } from '@/types';

interface TicketDialogProps {
  data: SaleWithItems | null;
  onClose: () => void;
  /** true justo después de cobrar: muestra la confirmación de venta */
  justSold?: boolean;
}

/** Vista previa del ticket con imprimir (sistema / Bluetooth), WhatsApp, copiar, compartir y anular. */
export function TicketDialog({ data, onClose, justSold = false }: TicketDialogProps) {
  if (!data) return null;
  return <TicketBody key={data.sale.id} initial={data} onClose={onClose} justSold={justSold} />;
}

function TicketBody({ initial, onClose, justSold }: { initial: SaleWithItems; onClose: () => void; justSold: boolean }) {
  const [data, setData] = useState(initial);
  const { data: ctx } = useTicketBusiness();
  const saveSettings = useSaveSettings();
  const voidSale = useVoidSale();
  const role = useAppStore((s) => s.role);
  const [paperOverride, setPaperOverride] = useState<PaperWidth | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<null | 'system' | 'bluetooth'>(null);
  const [error, setError] = useState<string | null>(null);
  const [btHelp, setBtHelp] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const [reason, setReason] = useState('');
  const copyTimer = useRef<ReturnType<typeof setTimeout>>();

  const paper: PaperWidth = paperOverride ?? ctx?.settings.paperWidth ?? 80;
  const ticket = useMemo(
    () => (ctx ? buildTicket(data.sale, data.items, ctx.business, ctx.settings.ticketFooter) : null),
    [ctx, data]
  );
  // La vista previa/WhatsApp usa 42 columnas en 80 mm (48 es el máximo de la térmica, pero se ve ancho en pantalla)
  const cols = paper === 58 ? 32 : 42;
  const text = useMemo(() => (ticket ? formatTicketText(ticket, cols) : ''), [ticket, cols]);
  const savedPrinter = ctx?.settings.bluetoothPrinter ?? null;
  const bt = bluetoothSupport();
  const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
  const canVoid = can(role, 'voidSale') && !data.sale.voided_at && !justSold;

  const changePaper = (w: PaperWidth) => {
    setPaperOverride(w);
    saveSettings.mutate({ paperWidth: w }); // recuerda la impresora del dispositivo
  };

  const printSystem = async () => {
    if (!ticket) return;
    setError(null);
    setBusy('system');
    try {
      await printHtml(renderTicketHtml(ticket, paper));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const printBluetooth = async () => {
    if (!ticket || !ctx) return;
    // Sin Bluetooth web (iPhone, http…) se explica en vez de fallar o esconder el botón
    if (!bt.ok) {
      setBtHelp(true);
      return;
    }
    setError(null);
    setBusy('bluetooth');
    try {
      const bytes = encodeTicketEscpos(ticket, paper, { cut: ctx.settings.autoCut });
      let printer = savedPrinter;
      // Primero emparejar (necesita un toque del usuario, por eso va antes de cualquier espera)
      if (!printer) {
        printer = await pairPrinter();
        await saveSettings.mutateAsync({ bluetoothPrinter: printer });
      }
      try {
        await printBytes(bytes, printer);
      } catch (err) {
        // El navegador olvidó el permiso: se pide elegir la impresora de nuevo y se reintenta
        if (err instanceof BluetoothPrintError && err.code === 'not-paired') {
          printer = await pairPrinter();
          await saveSettings.mutateAsync({ bluetoothPrinter: printer });
          await printBytes(bytes, printer);
        } else {
          throw err;
        }
      }
    } catch (err) {
      if (err instanceof BluetoothPrintError && err.code === 'cancelled') setError(err.message);
      else setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      setError('No se pudo copiar. Selecciona el texto manualmente.');
    }
  };

  const share = async () => {
    try {
      await navigator.share({ title: `Ticket ${data.sale.ticket_number}`, text });
    } catch (err) {
      // AbortError = la persona cerró el menú de compartir: no es un error
      if (!(err instanceof DOMException && err.name === 'AbortError')) setError('No se pudo compartir');
    }
  };

  const confirmVoid = async () => {
    setError(null);
    try {
      const updated = await voidSale.mutateAsync({ saleId: data.sale.id, reason });
      setData(updated);
      setVoiding(false);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const title = justSold ? '¡Venta registrada!' : `Ticket N° ${data.sale.ticket_number}`;

  return (
    <Sheet open onClose={onClose} title={title}>
      <div className="space-y-4">
        {justSold && (
          <div className="flex items-center gap-3 rounded-2xl bg-fresco/10 p-4 text-fresco">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-fresco text-fresco-fg">
              <Check className="h-6 w-6" />
            </span>
            <div>
              <p className="text-sm font-semibold">Ticket N° {data.sale.ticket_number}</p>
              <p className="text-2xl font-extrabold tabular">{formatPEN(data.sale.total)}</p>
            </div>
          </div>
        )}

        {data.sale.voided_at && (
          <p role="status" className="rounded-2xl bg-alerta/10 p-3 text-sm font-bold text-alerta">
            Venta anulada{data.sale.void_reason ? `: ${data.sale.void_reason}` : ''}
          </p>
        )}

        <Segmented<'58' | '80'>
          label="Ancho del papel"
          value={String(paper) as '58' | '80'}
          onChange={(v) => changePaper(Number(v) as PaperWidth)}
          options={[
            { value: '58', label: 'Papel 58 mm' },
            { value: '80', label: 'Papel 80 mm' },
          ]}
        />

        {/* Vista previa tipo recibo */}
        <div className="flex justify-center rounded-2xl bg-secondary/70 p-4">
          {ticket ? (
            <pre
              aria-label="Vista previa del ticket"
              className="max-w-full overflow-x-auto rounded-md bg-white p-3 font-mono text-[11px] leading-snug text-black shadow-card"
            >
              {text}
            </pre>
          ) : (
            <Spinner />
          )}
        </div>

        <ErrorNote message={error} />

        <div className="grid grid-cols-2 gap-2">
          {/* El botón de Bluetooth SIEMPRE se muestra: si el dispositivo no lo soporta, explica qué hacer */}
          {bt.ok ? (
            <>
              <Button size="lg" className="col-span-2" onClick={printBluetooth} disabled={!ticket || busy !== null}>
                <Bluetooth className="h-6 w-6" />
                {busy === 'bluetooth'
                  ? 'Imprimiendo…'
                  : savedPrinter
                    ? `Imprimir · ${savedPrinter.name}`
                    : 'Imprimir por Bluetooth'}
              </Button>
              <Button variant="outline" className="col-span-2" onClick={printSystem} disabled={!ticket || busy !== null}>
                <Printer className="h-5 w-5" /> {busy === 'system' ? 'Preparando…' : 'Imprimir con el sistema / PDF'}
              </Button>
            </>
          ) : (
            <>
              <Button size="lg" className="col-span-2" onClick={printSystem} disabled={!ticket || busy !== null}>
                <Printer className="h-6 w-6" /> {busy === 'system' ? 'Preparando…' : 'Imprimir ticket'}
              </Button>
              <Button
                variant="outline"
                className="col-span-2"
                onClick={() => setBtHelp((v) => !v)}
                aria-expanded={btHelp}
              >
                <Bluetooth className="h-5 w-5" /> Imprimir por Bluetooth
              </Button>
              {btHelp && !bt.ok && (
                <div className="col-span-2">
                  <BluetoothHelp reason={bt.reason} />
                </div>
              )}
            </>
          )}

          {isAndroid && ticket && (
            <a
              href={rawbtUrl(encodeTicketEscpos(ticket, paper, { cut: ctx?.settings.autoCut }))}
              className="col-span-2 flex min-h-[48px] items-center justify-center gap-2 rounded-xl border-2 border-border bg-card text-sm font-bold active:scale-[0.98]"
            >
              <Smartphone className="h-5 w-5" /> Imprimir con RawBT (impresoras Bluetooth clásicas)
            </a>
          )}

          <a
            href={ticket ? waLink('```\n' + text + '\n```', data.sale.customer_phone) : undefined}
            target="_blank"
            rel="noreferrer"
            aria-disabled={!ticket}
            className="flex min-h-[56px] items-center justify-center gap-2 rounded-xl bg-[#25D366] font-bold text-white active:scale-[0.98]"
          >
            <Send className="h-5 w-5" /> WhatsApp
          </a>
          <Button variant="outline" onClick={copy} disabled={!ticket}>
            {copied ? <Check className="h-5 w-5 text-fresco" /> : <Copy className="h-5 w-5" />}
            {copied ? 'Copiado' : 'Copiar'}
          </Button>
          {canShare && (
            <Button variant="outline" className="col-span-2" onClick={share} disabled={!ticket}>
              <Share2 className="h-5 w-5" /> Compartir…
            </Button>
          )}
        </div>

        {/* Anulación (solo dueño) */}
        {canVoid &&
          (voiding ? (
            <div className="space-y-3 rounded-2xl border-2 border-alerta/30 bg-alerta/5 p-4">
              <p className="text-sm font-bold text-alerta">
                Se devolverá el stock y la venta dejará de contar en tus reportes. Esto no se puede deshacer.
              </p>
              <Field label="Motivo de la anulación" htmlFor="void-reason">
                <Input id="void-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={160} placeholder="Ej. Error de precio" />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => setVoiding(false)} disabled={voidSale.isPending}>
                  Cancelar
                </Button>
                <Button variant="danger" onClick={confirmVoid} disabled={!reason.trim() || voidSale.isPending}>
                  {voidSale.isPending ? 'Anulando…' : 'Anular venta'}
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="ghost" className="w-full text-alerta" onClick={() => setVoiding(true)}>
              <Ban className="h-5 w-5" /> Anular esta venta
            </Button>
          ))}

        <Button variant="ghost" className="w-full" onClick={onClose}>
          {justSold ? 'Nueva venta' : 'Cerrar'}
        </Button>
      </div>
    </Sheet>
  );
}
