'use client';

import { useMemo, useState } from 'react';
import { Send, Copy, Check, Tag } from 'lucide-react';
import { useCategories, useProducts } from '@/hooks/useProducts';
import { buildRemateCatalog, waLink } from '@/lib/logic/whatsapp';

const DISCOUNTS = [0.2, 0.3, 0.4, 0.5];

/** Genera el catálogo de remate para vender el lote a restaurantes por WhatsApp. */
export function RemateCatalog() {
  const { data: products } = useProducts();
  const { data: categories } = useCategories();
  const [discount, setDiscount] = useState(0.3);
  const [copied, setCopied] = useState(false);

  const catMap = useMemo(
    () => new Map((categories ?? []).map((c) => [c.id, c])),
    [categories]
  );

  const catalog = useMemo(
    () => buildRemateCatalog(products ?? [], catMap, { discount }),
    [products, catMap, discount]
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(catalog.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* noop */ }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Tag className="h-6 w-6 text-atencion" />
        <h1 className="text-2xl font-extrabold">Catálogo de remate</h1>
      </div>
      <p className="text-muted-foreground">
        Vende rápido lo que está por vencer. {catalog.count} producto(s) en oferta.
      </p>

      {/* Descuento */}
      <div>
        <p className="mb-2 text-sm font-semibold text-muted-foreground">Descuento a aplicar</p>
        <div className="flex gap-2">
          {DISCOUNTS.map((d) => (
            <button
              key={d}
              onClick={() => setDiscount(d)}
              className={
                'min-h-[52px] flex-1 rounded-xl border-2 font-bold active:scale-95 ' +
                (discount === d ? 'border-atencion bg-atencion/10 text-atencion' : 'border-border')
              }
            >
              -{Math.round(d * 100)}%
            </button>
          ))}
        </div>
      </div>

      {/* Vista previa del mensaje */}
      <pre className="whitespace-pre-wrap rounded-xl bg-secondary/70 p-4 text-sm">{catalog.text}</pre>

      {/* Acciones */}
      <div className="grid grid-cols-1 gap-2">
        <a
          href={waLink(catalog.text)}
          target="_blank"
          rel="noreferrer"
          className="flex min-h-[64px] items-center justify-center gap-2 rounded-xl bg-[#25D366] text-lg font-bold text-white active:scale-[0.98]"
        >
          <Send className="h-6 w-6" /> Compartir por WhatsApp
        </a>
        <button
          onClick={copy}
          className="flex min-h-[56px] items-center justify-center gap-2 rounded-xl border-2 border-border font-bold active:scale-[0.98]"
        >
          {copied ? <Check className="h-5 w-5 text-fresco" /> : <Copy className="h-5 w-5" />}
          {copied ? 'Copiado' : 'Copiar texto'}
        </button>
      </div>
    </div>
  );
}
