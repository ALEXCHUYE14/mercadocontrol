'use client';

import { useState } from 'react';
import { Check, Trash2 } from 'lucide-react';
import { Sheet } from '@/components/ui/sheet';
import { Stepper } from '@/components/ui/stepper';
import { Field, Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ErrorNote } from '@/components/ui/feedback';
import { CustomerPicker } from '@/components/credit/CustomerPicker';
import { PaymentQrPanel } from '@/components/sales/PaymentQrPanel';
import { useSettings } from '@/hooks/useSales';
import { useCheckout } from '@/hooks/useProducts';
import { cartTotals, cashChange, parseMoney, quickCashOptions, lineSubtotal } from '@/lib/logic/cart';
import { PAYMENT_METHODS } from '@/lib/logic/ticket';
import { cn, errorMessage, formatPEN, formatQty } from '@/lib/utils';
import type { PaymentMethod, Product, SaleWithItems } from '@/types';

export interface CartEntry {
  productId: string;
  quantity: number;
  /** Texto del precio (editable) */
  price: string;
}

interface CartSheetProps {
  open: boolean;
  entries: CartEntry[];
  products: Map<string, Product>;
  onChange: (entries: CartEntry[]) => void;
  onClose: () => void;
  onSold: (sale: SaleWithItems) => void;
}

export function CartSheet(props: CartSheetProps) {
  // Se monta solo abierto: pago, descuento y cliente parten limpios en cada cobro
  if (!props.open) return null;
  return <CartBody {...props} />;
}

function CartBody({ entries, products, onChange, onClose, onSold }: CartSheetProps) {
  const checkout = useCheckout();
  const { data: settings } = useSettings();
  const [method, setMethod] = useState<PaymentMethod>('efectivo');
  const [discountText, setDiscountText] = useState('');
  const [receivedText, setReceivedText] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [creditCustomerId, setCreditCustomerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const parsed = entries.map((e) => ({ e, price: parseMoney(e.price) }));
  const allPricesValid = parsed.every((x) => x.price !== null);
  const lines = parsed.map((x) => ({ productId: x.e.productId, quantity: x.e.quantity, unitPrice: x.price ?? 0 }));

  const discountValue = discountText.trim() === '' ? 0 : parseMoney(discountText);
  const discountValid = discountValue !== null;
  const totals = cartTotals(lines, discountValue ?? 0);
  const discountTooHigh = discountValid && discountValue > totals.subtotal;

  const receivedValue = receivedText.trim() === '' ? null : parseMoney(receivedText);
  const isCredit = method === 'fiado';
  const cash = method === 'efectivo' && receivedValue !== null ? cashChange(totals.total, receivedValue) : null;
  const receivedInvalid = method === 'efectivo' && receivedText.trim() !== '' && receivedValue === null;

  const canConfirm =
    entries.length > 0 &&
    allPricesValid &&
    discountValid &&
    !discountTooHigh &&
    !receivedInvalid &&
    !(cash && cash.missing > 0) &&
    !(isCredit && !creditCustomerId) &&
    !checkout.isPending;

  const update = (productId: string, patch: Partial<CartEntry>) =>
    onChange(entries.map((e) => (e.productId === productId ? { ...e, ...patch } : e)));

  const confirm = async () => {
    if (!canConfirm) return;
    setError(null);
    try {
      const sale = await checkout.mutateAsync({
        items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity, unitPrice: l.unitPrice })),
        paymentMethod: method,
        discount: totals.discount,
        customerName: isCredit ? null : customerName || null,
        customerPhone: isCredit ? null : customerPhone || null,
        customerId: isCredit ? creditCustomerId : null,
        amountPaid: method === 'efectivo' ? receivedValue : null,
      });
      onSold(sale);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Sheet open onClose={onClose} title="Cobrar venta">
      <div className="space-y-5">
        {/* Líneas del carrito */}
        <ul className="space-y-3">
          {parsed.map(({ e, price }, i) => {
            const p = products.get(e.productId);
            if (!p) return null;
            const step = p.unit === 'kg' || p.unit === 'litro' ? 0.5 : 1;
            return (
              <li key={e.productId} className="rounded-2xl border border-border/70 bg-secondary/40 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-bold">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Stock {formatQty(p.current_stock, p.unit)}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Quitar ${p.name}`}
                    onClick={() => onChange(entries.filter((x) => x.productId !== e.productId))}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-alerta hover:bg-alerta/10"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <Stepper
                    size="sm"
                    value={e.quantity}
                    step={step}
                    min={Math.min(step, p.current_stock)}
                    max={p.current_stock}
                    onChange={(q) => update(e.productId, { quantity: q })}
                    className="flex-1"
                  />
                  <div className="w-24 shrink-0">
                    <Input
                      aria-label={`Precio de ${p.name}`}
                      inputMode="decimal"
                      value={e.price}
                      onChange={(ev) => update(e.productId, { price: ev.target.value })}
                      aria-invalid={price === null}
                      className="min-h-[44px] px-3 py-2 text-base"
                    />
                  </div>
                </div>
                <p className="mt-1.5 text-right text-sm font-bold tabular">
                  {price === null ? '—' : formatPEN(lineSubtotal({ productId: e.productId, quantity: e.quantity, unitPrice: price }))}
                </p>
                {i === 0 && !allPricesValid && (
                  <p role="alert" className="text-xs font-medium text-alerta">Revisa los precios marcados</p>
                )}
              </li>
            );
          })}
        </ul>

        {/* Descuento */}
        <Field
          label="Descuento (S/) — opcional"
          htmlFor="cart-discount"
          error={!discountValid ? 'Monto inválido' : discountTooHigh ? 'No puede superar el subtotal' : null}
        >
          <Input
            id="cart-discount"
            inputMode="decimal"
            placeholder="0.00"
            value={discountText}
            onChange={(ev) => setDiscountText(ev.target.value)}
            aria-invalid={!discountValid || discountTooHigh}
          />
        </Field>

        {/* Método de pago */}
        <fieldset>
          <legend className="mb-1.5 text-sm font-semibold text-muted-foreground">Método de pago</legend>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {PAYMENT_METHODS.map((m) => (
              <button
                key={m.value}
                type="button"
                aria-pressed={method === m.value}
                onClick={() => setMethod(m.value)}
                className={cn(
                  'flex min-h-[64px] flex-col items-center justify-center gap-0.5 rounded-xl border-2 text-sm font-bold transition-colors active:scale-95',
                  method === m.value ? 'border-fresco bg-fresco/10 text-fresco' : 'border-border bg-card'
                )}
              >
                <span className="text-xl">{m.emoji}</span>
                {m.label}
              </button>
            ))}
          </div>
        </fieldset>

        {/* Yape / Plin: QR propio para que el cliente escanee */}
        {(method === 'yape' || method === 'plin') && (
          <PaymentQrPanel method={method} qr={settings?.paymentQr[method] ?? null} total={totals.total} />
        )}

        {/* Efectivo: recibido y vuelto */}
        {method === 'efectivo' && (
          <div className="space-y-2">
            <Field
              label="Efectivo recibido (S/) — opcional"
              htmlFor="cart-received"
              error={receivedInvalid ? 'Monto inválido' : null}
            >
              <Input
                id="cart-received"
                inputMode="decimal"
                placeholder={totals.total.toFixed(2)}
                value={receivedText}
                onChange={(ev) => setReceivedText(ev.target.value)}
                aria-invalid={receivedInvalid}
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setReceivedText(totals.total.toFixed(2))}>
                Exacto
              </Button>
              {quickCashOptions(totals.total).map((v) => (
                <Button key={v} variant="outline" size="sm" onClick={() => setReceivedText(String(v))}>
                  S/ {v}
                </Button>
              ))}
            </div>
            {cash && (
              <p
                className={cn(
                  'rounded-xl px-3 py-2 text-lg font-extrabold tabular',
                  cash.missing > 0 ? 'bg-alerta/10 text-alerta' : 'bg-fresco/10 text-fresco'
                )}
              >
                {cash.missing > 0 ? `Falta ${formatPEN(cash.missing)}` : `Vuelto ${formatPEN(cash.change)}`}
              </p>
            )}
          </div>
        )}

        {/* Fiado: cliente obligatorio */}
        {isCredit && (
          <CustomerPicker
            selectedId={creditCustomerId}
            onSelect={(c) => setCreditCustomerId(c.id)}
          />
        )}

        {/* Cliente (opcional) */}
        {!isCredit && (
        <details className="rounded-xl border border-border/70 px-3 py-2">
          <summary className="min-h-[40px] cursor-pointer select-none py-2 text-sm font-semibold text-muted-foreground">
            Datos del cliente (opcional)
          </summary>
          <div className="space-y-3 pb-2 pt-1">
            <Field label="Nombre" htmlFor="cart-customer">
              <Input id="cart-customer" value={customerName} onChange={(ev) => setCustomerName(ev.target.value)} maxLength={80} />
            </Field>
            <Field label="Celular (para enviar el ticket por WhatsApp)" htmlFor="cart-phone">
              <Input
                id="cart-phone"
                type="tel"
                inputMode="tel"
                value={customerPhone}
                onChange={(ev) => setCustomerPhone(ev.target.value)}
                maxLength={20}
                placeholder="999 999 999"
              />
            </Field>
          </div>
        </details>
        )}

        {/* Resumen */}
        <div className="space-y-1 rounded-2xl bg-fresco/10 p-4">
          {totals.discount > 0 && (
            <>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Subtotal</span>
                <span className="tabular">{formatPEN(totals.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Descuento</span>
                <span className="tabular">-{formatPEN(totals.discount)}</span>
              </div>
            </>
          )}
          <div className="flex items-center justify-between">
            <span className="font-semibold text-muted-foreground">Total a cobrar</span>
            <span className="text-3xl font-extrabold tabular text-fresco">{formatPEN(totals.total)}</span>
          </div>
        </div>

        <ErrorNote message={error} />

        <Button size="lg" className="w-full" onClick={confirm} disabled={!canConfirm}>
          <Check className="h-6 w-6" />
          {checkout.isPending ? 'Guardando…' : 'Confirmar venta'}
        </Button>
      </div>
    </Sheet>
  );
}
