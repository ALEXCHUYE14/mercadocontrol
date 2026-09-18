'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, KeyRound, MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { ErrorNote } from '@/components/ui/feedback';
import { SupportLink } from '@/components/auth/SupportLink';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useAuth } from '@/lib/auth/AuthProvider';
import { ARRIVAL } from '@/lib/auth/recoveryArrival';
import { AuthError, MIN_PASSWORD_LENGTH } from '@/lib/auth/types';

type View = 'request' | 'sent' | 'reset' | 'done';

export function RecoveryScreen() {
  const { mode, requestPasswordReset, updatePassword } = useAuth();
  const router = useRouter();
  const [view, setView] = React.useState<View>(ARRIVAL.recovery ? 'reset' : 'request');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [error, setError] = React.useState<string | null>(
    ARRIVAL.expired ? 'El enlace venció o ya se usó. Solicita otro correo de recuperación.' : null
  );
  const [busy, setBusy] = React.useState(false);

  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof AuthError ? err.message : 'No se pudo completar la operación');
    } finally {
      setBusy(false);
    }
  };

  const sendEmail = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      await requestPasswordReset(email);
      setView('sent');
    });
  };

  const savePassword = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      if (password.length < MIN_PASSWORD_LENGTH) {
        throw new AuthError(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`);
      }
      if (password !== confirm) throw new AuthError('Las contraseñas no coinciden');
      await updatePassword(password);
      window.history.replaceState(null, '', '/recuperar'); // limpia tokens de la URL
      setView('done');
    });
  };

  return (
    <main className="relative flex min-h-dvh items-center justify-center px-4 py-10">
      <ThemeToggle className="absolute right-4 top-4" />
      <div className="w-full max-w-md rounded-3xl border border-border/70 bg-card p-6 shadow-pop">
        <Link href="/login" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Volver a ingresar
        </Link>

        {mode === 'local' ? (
          <div className="space-y-3">
            <h1 className="text-2xl font-extrabold tracking-tight">Recuperar acceso</h1>
            <p className="text-sm text-muted-foreground">
              En modo local no hay recuperación por correo: la clave vive solo en este dispositivo. Si aún puedes
              ingresar, cámbiala en <b>Ajustes → Seguridad</b>.
            </p>
          </div>
        ) : view === 'request' ? (
          <form onSubmit={sendEmail} noValidate className="space-y-4">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight">¿Olvidaste tu contraseña?</h1>
              <p className="mt-1 text-sm text-muted-foreground">Te enviaremos un enlace para crear una nueva.</p>
            </div>
            <Field label="Correo" htmlFor="rec-email">
              <Input id="rec-email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <ErrorNote message={error} />
            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              {busy ? 'Enviando…' : 'Enviar enlace'}
            </Button>
          </form>
        ) : view === 'sent' ? (
          <div className="space-y-3 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-fresco/10 text-fresco">
              <MailCheck className="h-7 w-7" />
            </span>
            <h1 className="text-2xl font-extrabold tracking-tight">Revisa tu correo</h1>
            <p className="text-sm text-muted-foreground">
              Si <b>{email.trim()}</b> tiene una cuenta, recibirás un enlace para crear una contraseña nueva. Revisa
              también la carpeta de spam.
            </p>
          </div>
        ) : view === 'reset' ? (
          <form onSubmit={savePassword} noValidate className="space-y-4">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight">Crea tu nueva contraseña</h1>
              <p className="mt-1 text-sm text-muted-foreground">Mínimo {MIN_PASSWORD_LENGTH} caracteres.</p>
            </div>
            <Field label="Contraseña nueva" htmlFor="rec-pass">
              <Input id="rec-pass" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            <Field label="Repite la contraseña" htmlFor="rec-confirm">
              <Input id="rec-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </Field>
            <ErrorNote message={error} />
            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              <KeyRound className="h-5 w-5" /> {busy ? 'Guardando…' : 'Guardar contraseña'}
            </Button>
            {error && (
              <button type="button" onClick={() => setView('request')} className="w-full text-center text-sm font-bold text-fresco">
                Solicitar un enlace nuevo
              </button>
            )}
          </form>
        ) : (
          <div className="space-y-4 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-fresco/10 text-fresco">
              <KeyRound className="h-7 w-7" />
            </span>
            <h1 className="text-2xl font-extrabold tracking-tight">¡Contraseña actualizada!</h1>
            <Button size="lg" className="w-full" onClick={() => router.replace('/')}>
              Entrar a mi puesto
            </Button>
          </div>
        )}
        <SupportLink context="recuperar contraseña" className="mt-6" />
      </div>
    </main>
  );
}
