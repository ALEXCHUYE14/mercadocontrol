'use client';

import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { ErrorNote } from '@/components/ui/feedback';
import { useAuth } from '@/lib/auth/AuthProvider';
import { AuthError } from '@/lib/auth/types';

/** Cambio de contraseña (nube) o de clave de acceso (local). Exige la actual. */
export function SecurityCard() {
  const { mode, changePassword } = useAuth();
  const label = mode === 'local' ? 'clave' : 'contraseña';
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setDone(false);
    if (next !== confirm) {
      setError(`La ${label} nueva y su repetición no coinciden`);
      return;
    }
    setBusy(true);
    try {
      await changePassword(current, next);
      setCurrent('');
      setNext('');
      setConfirm('');
      setDone(true);
    } catch (err) {
      setError(err instanceof AuthError ? err.message : 'No se pudo cambiar. Inténtalo de nuevo');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-5 w-5" /> Seguridad
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} noValidate className="space-y-3">
          <Field label={`${label[0].toUpperCase()}${label.slice(1)} actual`} htmlFor="sec-current">
            <Input id="sec-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </Field>
          <Field label={`${label[0].toUpperCase()}${label.slice(1)} nueva`} htmlFor="sec-next">
            <Input id="sec-next" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
          </Field>
          <Field label={`Repite la ${label} nueva`} htmlFor="sec-confirm">
            <Input id="sec-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
          <ErrorNote message={error} />
          {done && (
            <p role="status" className="rounded-xl bg-fresco/10 px-3 py-2 text-sm font-semibold text-fresco">
              ✓ Tu {label} se actualizó
            </p>
          )}
          <Button type="submit" variant="outline" className="w-full" disabled={busy || !current || !next}>
            {busy ? 'Guardando…' : `Cambiar ${label}`}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
