'use client';

import { useState } from 'react';
import { UserMinus, UserPlus, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { ErrorNote, Spinner } from '@/components/ui/feedback';
import { useAddTeamMember, useRemoveTeamMember, useTeam } from '@/hooks/useTeam';
import { errorMessage } from '@/lib/utils';

/** Cajeros del puesto: pueden vender, ver inventario y cobrar fiados; nada más. */
export function TeamCard() {
  const { data, isLoading, error: loadError } = useTeam(true);
  const add = useAddTeamMember();
  const remove = useRemoveTeamMember();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await add.mutateAsync(email);
      setEmail('');
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const doRemove = async (id: string) => {
    setError(null);
    try {
      await remove.mutateAsync(id);
      setConfirmId(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" /> Equipo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Agrega cajeros con su propia cuenta. Ellos pueden <b>vender, ver el inventario y cobrar fiados</b>. No
          pueden anular ventas, ver reportes, editar productos ni cambiar ajustes del negocio.
        </p>

        <form onSubmit={submit} noValidate className="space-y-3">
          <Field label="Correo del cajero" htmlFor="team-email" hint="Debe haberse registrado antes en la app">
            <Input id="team-email" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="cajero@ejemplo.com" />
          </Field>
          <Button type="submit" className="w-full" disabled={!email.trim() || add.isPending}>
            <UserPlus className="h-5 w-5" /> {add.isPending ? 'Agregando…' : 'Agregar cajero'}
          </Button>
        </form>

        <ErrorNote message={error ?? (loadError ? errorMessage(loadError) : null)} />

        {isLoading ? (
          <div className="flex justify-center py-3">
            <Spinner />
          </div>
        ) : (
          <ul className="divide-y divide-border/70 rounded-2xl border border-border/70">
            {(data ?? []).map((m) => (
              <li key={m.member_id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{m.full_name || m.email}</span>
                  <span className="block truncate text-xs text-muted-foreground">{m.email} · Cajero</span>
                </span>
                {confirmId === m.member_id ? (
                  <span className="flex shrink-0 gap-1">
                    <Button size="sm" variant="outline" onClick={() => setConfirmId(null)}>
                      No
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => void doRemove(m.member_id)} disabled={remove.isPending}>
                      Quitar
                    </Button>
                  </span>
                ) : (
                  <button
                    type="button"
                    aria-label={`Quitar a ${m.full_name || m.email}`}
                    onClick={() => setConfirmId(m.member_id)}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-alerta hover:bg-alerta/10"
                  >
                    <UserMinus className="h-5 w-5" />
                  </button>
                )}
              </li>
            ))}
            {(data ?? []).length === 0 && (
              <li className="px-3 py-4 text-center text-sm text-muted-foreground">Aún no tienes cajeros</li>
            )}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
