'use client';

import { useMemo, useState } from 'react';
import { ChevronRight, HandCoins, Search, Send, UserPlus, Wallet } from 'lucide-react';
import { PageHeader, EmptyState, ErrorNote, Spinner } from '@/components/ui/feedback';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { useAddCustomer, useCreditOverview, useCreditPayment } from '@/hooks/useCredit';
import { useTicketBusiness } from '@/hooks/useSales';
import { buildReminderText, customerLedger, totalReceivable, type CustomerBalance } from '@/lib/logic/credit';
import { parseMoney } from '@/lib/logic/cart';
import { PAYMENT_METHODS, formatTicketDate } from '@/lib/logic/ticket';
import { waLink } from '@/lib/logic/whatsapp';
import { cn, errorMessage, formatPEN } from '@/lib/utils';
import type { CashMethod } from '@/types';

const CASH_METHODS = PAYMENT_METHODS.filter((m) => m.value !== 'fiado') as { value: CashMethod; label: string; emoji: string }[];

function normalize(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

export function CreditScreen() {
  const { data, isLoading } = useCreditOverview();
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const total = useMemo(() => totalReceivable(data?.balances ?? []), [data]);
  const debtors = (data?.balances ?? []).filter((b) => b.balance > 0).length;
  const list = useMemo(() => {
    const q = normalize(query.trim());
    return (data?.balances ?? []).filter((b) => !q || normalize(b.customer.name).includes(q));
  }, [data, query]);
  const selected = data?.balances.find((b) => b.customer.id === selectedId) ?? null;

  return (
    <>
      <PageHeader
        title="Fiados"
        subtitle="Quién te debe y cuánto"
        action={
          <Button size="sm" variant="soft" onClick={() => setAdding(true)}>
            <UserPlus className="h-4 w-4" /> Cliente
          </Button>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3">
        <MetricCard label="Por cobrar" value={formatPEN(total)} icon={Wallet} tone="alerta" />
        <MetricCard label="Clientes con deuda" value={String(debtors)} icon={HandCoins} tone="atencion" />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : !data?.balances.length ? (
        <EmptyState
          icon={HandCoins}
          title="Aún no fías a nadie"
          text="En Ventas, elige «Fiado» como método de pago y selecciona al cliente. Aquí verás lo que te debe."
        />
      ) : (
        <div className="space-y-3">
          <div className="relative">
            <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar cliente…"
              aria-label="Buscar cliente"
              className="min-h-touch w-full rounded-xl border-2 border-input bg-card pl-12 pr-4 text-lg focus-visible:border-fresco focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fresco/25"
            />
          </div>
          <ul className="divide-y divide-border/70 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-card">
            {list.map((b) => (
              <li key={b.customer.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(b.customer.id)}
                  className="flex min-h-[64px] w-full items-center gap-3 px-4 py-3 text-left active:bg-secondary"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary font-extrabold">
                    {b.customer.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{b.customer.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {b.lastActivity ? `Último movimiento ${formatTicketDate(b.lastActivity).split(' ')[0]}` : 'Sin movimientos'}
                    </span>
                  </span>
                  <span className={cn('shrink-0 font-extrabold tabular', b.balance > 0 ? 'text-alerta' : 'text-fresco')}>
                    {b.balance > 0 ? formatPEN(b.balance) : 'Al día'}
                  </span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                </button>
              </li>
            ))}
            {list.length === 0 && <li className="py-8 text-center text-muted-foreground">Sin coincidencias</li>}
          </ul>
        </div>
      )}

      {selected && <CustomerSheet key={selected.customer.id} balance={selected} onClose={() => setSelectedId(null)} />}
      {adding && <NewCustomerSheet onClose={() => setAdding(false)} />}
    </>
  );
}

function NewCustomerSheet({ onClose }: { onClose: () => void }) {
  const add = useAddCustomer();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    try {
      await add.mutateAsync({ name, phone });
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Sheet open onClose={onClose} title="Nuevo cliente">
      <div className="space-y-4">
        <Field label="Nombre" htmlFor="nc-name">
          <Input id="nc-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus />
        </Field>
        <Field label="Celular (opcional)" htmlFor="nc-phone">
          <Input id="nc-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} />
        </Field>
        <ErrorNote message={error} />
        <Button size="lg" className="w-full" onClick={save} disabled={!name.trim() || add.isPending}>
          {add.isPending ? 'Guardando…' : 'Guardar cliente'}
        </Button>
      </div>
    </Sheet>
  );
}

function CustomerSheet({ balance, onClose }: { balance: CustomerBalance; onClose: () => void }) {
  const { data } = useCreditOverview();
  const { data: ctx } = useTicketBusiness();
  const pay = useCreditPayment();
  const [amountText, setAmountText] = useState('');
  const [method, setMethod] = useState<CashMethod>('efectivo');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const { customer } = balance;
  const amount = parseMoney(amountText);
  const owes = balance.balance > 0;
  const tooMuch = amount !== null && amount > balance.balance + 1e-9;
  const canPay = owes && amount !== null && amount > 0 && !tooMuch && !pay.isPending;

  const ledger = useMemo(
    () => customerLedger(customer.id, data?.sales ?? [], data?.payments ?? []),
    [customer.id, data]
  );

  const submit = async () => {
    if (!canPay || amount === null) return;
    setError(null);
    setDone(null);
    try {
      await pay.mutateAsync({ customerId: customer.id, amount, method });
      setDone(`Abono de ${formatPEN(amount)} registrado`);
      setAmountText('');
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const reminder = buildReminderText(customer.name, balance.balance, ctx?.business.name ?? 'tu puesto');

  return (
    <Sheet open onClose={onClose} title={customer.name}>
      <div className="space-y-5">
        <div className="flex items-center justify-between rounded-2xl bg-secondary/70 p-4">
          <span className="font-semibold text-muted-foreground">Debe</span>
          <span className={cn('text-3xl font-extrabold tabular', owes ? 'text-alerta' : 'text-fresco')}>
            {formatPEN(balance.balance)}
          </span>
        </div>

        {owes && (
          <div className="space-y-3">
            <Field label="Registrar abono (S/)" htmlFor="pay-amount" error={tooMuch ? 'Supera la deuda' : amountText && amount === null ? 'Monto inválido' : null}>
              <Input id="pay-amount" inputMode="decimal" placeholder="0.00" value={amountText} onChange={(e) => setAmountText(e.target.value)} aria-invalid={tooMuch} />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setAmountText(balance.balance.toFixed(2))}>
                Pagar todo
              </Button>
              {CASH_METHODS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  aria-pressed={method === m.value}
                  onClick={() => setMethod(m.value)}
                  className={cn(
                    'min-h-[44px] rounded-full border-2 px-3 text-sm font-semibold active:scale-95',
                    method === m.value ? 'border-fresco bg-fresco/10 text-fresco' : 'border-border'
                  )}
                >
                  {m.emoji} {m.label}
                </button>
              ))}
            </div>
            <ErrorNote message={error} />
            {done && <p role="status" className="rounded-xl bg-fresco/10 px-3 py-2 text-sm font-semibold text-fresco">{done}</p>}
            <Button size="lg" className="w-full" onClick={submit} disabled={!canPay}>
              <HandCoins className="h-5 w-5" /> {pay.isPending ? 'Guardando…' : 'Registrar abono'}
            </Button>
            <a
              href={waLink(reminder, customer.phone)}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-[#25D366] font-bold text-white active:scale-[0.98]"
            >
              <Send className="h-5 w-5" /> Recordar por WhatsApp
            </a>
            {!customer.phone && (
              <p className="text-xs text-muted-foreground">Sin celular guardado: WhatsApp te pedirá elegir el contacto.</p>
            )}
          </div>
        )}

        <section>
          <h3 className="mb-2 font-extrabold">Movimientos</h3>
          {ledger.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin movimientos.</p>
          ) : (
            <ul className="divide-y divide-border/70 rounded-2xl border border-border/70">
              {ledger.map((e) => (
                <li key={`${e.kind}-${e.id}`} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <span className="min-w-0">
                    <span className={cn('block text-sm font-semibold', e.voided && 'line-through opacity-60')}>{e.label}</span>
                    <span className="block text-xs text-muted-foreground">
                      {formatTicketDate(e.date)}
                      {e.voided ? ' · anulada' : ''}
                    </span>
                  </span>
                  <span className={cn('font-bold tabular', e.amount < 0 ? 'text-fresco' : 'text-alerta', e.voided && 'line-through opacity-60')}>
                    {e.amount < 0 ? '−' : '+'}
                    {formatPEN(Math.abs(e.amount))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Sheet>
  );
}
