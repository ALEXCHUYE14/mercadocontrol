'use client';

import * as React from 'react';
import Link from 'next/link';
import { Eye, EyeOff, Lock, Mail, Store, User, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, IconInput } from '@/components/ui/input';
import { ErrorNote, Spinner } from '@/components/ui/feedback';
import { SupportLink } from '@/components/auth/SupportLink';
import { useAuth } from '@/lib/auth/AuthProvider';
import { AuthError, MIN_LOCAL_SECRET_LENGTH, MIN_PASSWORD_LENGTH } from '@/lib/auth/types';

type View = 'signin' | 'signup';

function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  placeholder?: string;
}) {
  const [show, setShow] = React.useState(false);
  return (
    <IconInput
      id={id}
      icon={Lock}
      type={show ? 'text' : 'password'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      autoComplete={autoComplete}
      placeholder={placeholder ?? '••••••••'}
      trailing={
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={show}
          className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
        >
          {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      }
    />
  );
}

export function LoginForm() {
  const { mode, signIn, signUp, needsSignUp } = useAuth();
  const isLocal = mode === 'local';
  const [view, setView] = React.useState<View | null>(isLocal ? null : 'signin');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [fullName, setFullName] = React.useState('');
  const [stallName, setStallName] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  // Modo local: si aún no hay cuenta en este dispositivo, se muestra el registro
  React.useEffect(() => {
    if (!isLocal) return;
    let cancelled = false;
    needsSignUp()
      .then((needs) => {
        if (!cancelled) setView(needs ? 'signup' : 'signin');
      })
      .catch(() => {
        if (!cancelled) setView('signin');
      });
    return () => {
      cancelled = true;
    };
  }, [isLocal, needsSignUp]);

  if (view === null) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  }

  const switchView = (v: View) => {
    setView(v);
    setError(null);
    setNotice(null);
    setPassword('');
    setConfirm('');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setNotice(null);

    if (view === 'signup') {
      const min = isLocal ? MIN_LOCAL_SECRET_LENGTH : MIN_PASSWORD_LENGTH;
      if (password.length < min) {
        setError(`${isLocal ? 'La clave' : 'La contraseña'} debe tener al menos ${min} caracteres`);
        return;
      }
      if (isLocal && password !== confirm) {
        setError('Las claves no coinciden');
        return;
      }
    }

    setBusy(true);
    try {
      if (view === 'signin') {
        await signIn({ email, password });
      } else {
        const result = await signUp({ email, password, fullName, stallName });
        if (result.needsConfirmation) {
          switchView('signin');
          setNotice('Cuenta creada. Revisa tu correo para confirmarla y luego inicia sesión.');
        }
      }
      // Con sesión activa, GuestGate redirige a la app
    } catch (err) {
      setError(err instanceof AuthError ? err.message : 'No se pudo completar la operación');
    } finally {
      setBusy(false);
    }
  };

  const secretLabel = isLocal ? 'Clave de acceso' : 'Contraseña';
  const title = view === 'signin' ? 'Bienvenido' : isLocal ? 'Crea tu acceso' : 'Crea tu cuenta';
  const subtitle =
    view === 'signin'
      ? isLocal
        ? 'Ingresa tu clave para acceder al sistema'
        : 'Ingresa tus credenciales para acceder al sistema'
      : isLocal
        ? 'Protege esta app en tu dispositivo con una clave'
        : 'Toma menos de un minuto';

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-emerald-900 dark:text-emerald-300">{title}</h1>
        <p className="mt-1.5 text-muted-foreground">{subtitle}</p>
      </header>

      <form
        onSubmit={submit}
        noValidate
        className="space-y-5 rounded-3xl border border-border/70 bg-card p-6 shadow-card sm:p-8"
      >
        {view === 'signup' && (
          <>
            <Field label="Tu nombre" htmlFor="fullName">
              <IconInput id="fullName" icon={User} value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" placeholder="Ej. María Quispe" />
            </Field>
            <Field label="Nombre de tu puesto" htmlFor="stallName">
              <IconInput id="stallName" icon={Store} value={stallName} onChange={(e) => setStallName(e.target.value)} placeholder="Ej. Frutas Doña María" />
            </Field>
          </>
        )}

        {!isLocal && (
          <Field label="Correo electrónico" htmlFor="email">
            <IconInput
              id="email"
              icon={Mail}
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@correo.com"
            />
          </Field>
        )}

        <Field label={secretLabel} htmlFor="password">
          <PasswordInput
            id="password"
            value={password}
            onChange={setPassword}
            autoComplete={view === 'signin' ? 'current-password' : 'new-password'}
          />
        </Field>

        {view === 'signup' && isLocal && (
          <Field label="Repite la clave" htmlFor="confirm">
            <PasswordInput id="confirm" value={confirm} onChange={setConfirm} autoComplete="new-password" />
          </Field>
        )}

        {!isLocal && view === 'signin' && (
          <div className="-mt-2 text-right">
            <Link href="/recuperar" className="text-sm font-semibold text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-400">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
        )}

        {notice && <p role="status" className="rounded-xl bg-fresco/10 px-3 py-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">{notice}</p>}
        <ErrorNote message={error} />

        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {view === 'signin' ? <Lock className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
          {busy ? 'Un momento…' : view === 'signin' ? 'Ingresar al sistema' : 'Crear cuenta'}
        </Button>

        {/* En modo local solo existe una cuenta por dispositivo: no hay alternancia */}
        {!isLocal && (
          <p className="text-center text-sm text-muted-foreground">
            {view === 'signin' ? '¿Aún no tienes cuenta?' : '¿Ya tienes cuenta?'}{' '}
            <button
              type="button"
              onClick={() => switchView(view === 'signin' ? 'signup' : 'signin')}
              className="font-bold text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-400"
            >
              {view === 'signin' ? 'Regístrate' : 'Inicia sesión'}
            </button>
          </p>
        )}
      </form>

      <SupportLink className="mt-5" />

      {isLocal && (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Modo sin nube: tus datos viven solo en este dispositivo.
        </p>
      )}
    </div>
  );
}
