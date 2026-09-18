'use client';

import { useMemo, useState } from 'react';
import { Check, Search, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { ErrorNote } from '@/components/ui/feedback';
import { useAddCustomer, useCreditOverview } from '@/hooks/useCredit';
import { cn, errorMessage, formatPEN } from '@/lib/utils';
import type { Customer } from '@/types';

function normalize(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

/** Elige (o crea) el cliente al que se le fía. Muestra lo que ya debe. */
export function CustomerPicker({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (customer: Customer) => void;
}) {
  const { data } = useCreditOverview();
  const addCustomer = useAddCustomer();
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);

  const balances = useMemo(() => {
    const q = normalize(query.trim());
    return (data?.balances ?? []).filter((b) => !q || normalize(b.customer.name).includes(q)).slice(0, 8);
  }, [data, query]);

  const create = async () => {
    setError(null);
    try {
      const customer = await addCustomer.mutateAsync({ name, phone });
      onSelect(customer);
      setCreating(false);
      setName('');
      setPhone('');
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div className="space-y-3 rounded-2xl border-2 border-border/70 p-3">
      <p className="text-sm font-semibold text-muted-foreground">Cliente que queda debiendo</p>

      {creating ? (
        <div className="space-y-3">
          <Field label="Nombre" htmlFor="new-customer-name">
            <Input id="new-customer-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus />
          </Field>
          <Field label="Celular (para recordatorios por WhatsApp)" htmlFor="new-customer-phone">
            <Input id="new-customer-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} />
          </Field>
          <ErrorNote message={error} />
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" onClick={() => setCreating(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={create} disabled={!name.trim() || addCustomer.isPending}>
              {addCustomer.isPending ? 'Guardando…' : 'Guardar cliente'}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar cliente…"
              aria-label="Buscar cliente"
              className="min-h-[48px] w-full rounded-xl border-2 border-input bg-card pl-10 pr-3 focus-visible:border-fresco focus-visible:outline-none"
            />
          </div>
          <ul className="space-y-1.5">
            {balances.map(({ customer, balance }) => (
              <li key={customer.id}>
                <button
                  type="button"
                  aria-pressed={selectedId === customer.id}
                  onClick={() => onSelect(customer)}
                  className={cn(
                    'flex min-h-[52px] w-full items-center justify-between gap-2 rounded-xl border-2 px-3 text-left transition-colors active:scale-[0.99]',
                    selectedId === customer.id ? 'border-fresco bg-fresco/10' : 'border-border bg-card'
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {selectedId === customer.id && <Check className="h-4 w-4 shrink-0 text-fresco" />}
                    <span className="truncate font-semibold">{customer.name}</span>
                  </span>
                  {balance > 0 && <span className="shrink-0 text-xs font-bold text-alerta">Debe {formatPEN(balance)}</span>}
                </button>
              </li>
            ))}
            {balances.length === 0 && <li className="py-2 text-center text-sm text-muted-foreground">Sin coincidencias</li>}
          </ul>
          <Button variant="soft" size="sm" className="w-full" onClick={() => setCreating(true)}>
            <UserPlus className="h-4 w-4" /> Nuevo cliente
          </Button>
        </>
      )}
    </div>
  );
}
