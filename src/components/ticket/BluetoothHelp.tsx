'use client';

import { useRef, useState } from 'react';
import { BluetoothOff, Check, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { bluetoothHelpMessage, type BluetoothUnsupportedReason } from '@/lib/print/bluetooth';

/** Explica por qué no hay Bluetooth en este dispositivo y qué hacer (con enlace copiable para iPhone). */
export function BluetoothHelp({ reason }: { reason: BluetoothUnsupportedReason }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const copyLink = async () => {
    setFailed(false);
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      setFailed(true); // p. ej. sin permiso del portapapeles: se muestra la dirección para copiarla a mano
    }
  };

  return (
    <div role="note" className="space-y-3 rounded-2xl border border-atencion/30 bg-atencion/10 p-3 text-sm">
      <p className="flex items-start gap-2">
        <BluetoothOff className="mt-0.5 h-5 w-5 shrink-0 text-atencion" />
        <span>{bluetoothHelpMessage(reason)}</span>
      </p>
      {reason === 'ios' && (
        <div className="space-y-2">
          <Button variant="outline" size="sm" className="w-full" onClick={copyLink}>
            {copied ? <Check className="h-4 w-4 text-fresco" /> : <Link2 className="h-4 w-4" />}
            {copied ? 'Enlace copiado: pégalo en Bluefy' : 'Copiar enlace de la app'}
          </Button>
          {failed && (
            <p className="break-all rounded-lg bg-card px-2 py-1.5 text-xs font-semibold">{window.location.origin}</p>
          )}
        </div>
      )}
    </div>
  );
}
