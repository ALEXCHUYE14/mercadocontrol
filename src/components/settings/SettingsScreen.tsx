'use client';

import { useState } from 'react';
import { Check, LogOut, Save } from 'lucide-react';
import { PageHeader, ErrorNote, Segmented, Spinner } from '@/components/ui/feedback';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { AppearanceCard } from '@/components/settings/AppearanceCard';
import { PaymentQrCard } from '@/components/settings/PaymentQrCard';
import { PrinterCard } from '@/components/settings/PrinterCard';
import { SecurityCard } from '@/components/settings/SecurityCard';
import { TeamCard } from '@/components/settings/TeamCard';
import { useProfile, useSaveSettings, useSettings, useUpdateProfile } from '@/hooks/useSales';
import { can } from '@/lib/auth/permissions';
import { useAuth } from '@/lib/auth/AuthProvider';
import type { AppSettings } from '@/lib/db/settings';
import { parseMoney } from '@/lib/logic/cart';
import type { PaperWidth } from '@/lib/logic/ticket';
import { errorMessage } from '@/lib/utils';
import { useAppStore } from '@/stores/useAppStore';
import type { Profile } from '@/types';

export function SettingsScreen() {
  const { data: profile } = useProfile();
  const { data: settings } = useSettings();
  const { mode } = useAuth();
  const role = useAppStore((s) => s.role);

  return (
    <>
      <PageHeader title="Ajustes" subtitle="Tu negocio, la impresora y tu cuenta" />
      {!settings || (!profile && role === 'owner') ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-5">
          <BusinessForm profile={profile ?? null} settings={settings} role={role} />
          <PaymentQrCard />
          <PrinterCard />
          <AppearanceCard />
          <SecurityCard />
          {mode === 'supabase' && can(role, 'manageTeam') && <TeamCard />}
          <AccountCard />
        </div>
      )}
    </>
  );
}

function BusinessForm({ profile, settings, role }: { profile: Profile | null; settings: AppSettings; role: 'owner' | 'cajero' }) {
  const updateProfile = useUpdateProfile();
  const saveSettings = useSaveSettings();
  const isOwner = can(role, 'editBusiness');
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [stallName, setStallName] = useState(profile?.stall_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [address, setAddress] = useState(settings.address);
  const [taxId, setTaxId] = useState(settings.taxId);
  const [footer, setFooter] = useState(settings.ticketFooter);
  const [paper, setPaper] = useState<PaperWidth>(settings.paperWidth);
  const [lowStock, setLowStock] = useState(String(settings.lowStockDefault));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const lowStockValue = parseMoney(lowStock);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);
    if (isOwner && !stallName.trim()) {
      setError('El nombre del puesto es obligatorio (aparece en el ticket)');
      return;
    }
    if (lowStockValue === null) {
      setError('El stock mínimo por defecto debe ser un número');
      return;
    }
    try {
      await saveSettings.mutateAsync({
        address,
        taxId,
        ticketFooter: footer,
        paperWidth: paper,
        ...(isOwner ? { lowStockDefault: lowStockValue } : {}),
      });
      if (isOwner) await updateProfile.mutateAsync({ full_name: fullName, stall_name: stallName, phone });
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const busy = saveSettings.isPending || updateProfile.isPending;

  return (
    <form onSubmit={save} noValidate className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Mi negocio</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isOwner && (
            <p className="rounded-xl bg-secondary/70 px-3 py-2 text-sm text-muted-foreground">
              Los datos del negocio los administra el dueño. Aquí puedes ajustar el ticket de este dispositivo.
            </p>
          )}
          <Field label="Nombre del puesto" htmlFor="stallName">
            <Input id="stallName" value={stallName} onChange={(e) => setStallName(e.target.value)} maxLength={80} disabled={!isOwner} />
          </Field>
          <Field label="Tu nombre" htmlFor="fullName">
            <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={80} autoComplete="name" disabled={!isOwner} />
          </Field>
          <Field label="Celular del negocio" htmlFor="phone" hint="Aparece en el ticket y en los pedidos por WhatsApp">
            <Input id="phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} disabled={!isOwner} />
          </Field>
          {isOwner && (
            <Field
              label="Stock mínimo por defecto"
              htmlFor="lowStock"
              hint="Te avisamos cuando un producto sin umbral propio llegue a esta cantidad"
              error={lowStockValue === null ? 'Escribe un número' : null}
            >
              <Input id="lowStock" inputMode="decimal" value={lowStock} onChange={(e) => setLowStock(e.target.value)} aria-invalid={lowStockValue === null} />
            </Field>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ticket de venta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="mb-1.5 text-sm font-semibold text-muted-foreground">Papel de tu impresora</p>
            <Segmented<'58' | '80'>
              label="Ancho del papel"
              value={String(paper) as '58' | '80'}
              onChange={(v) => setPaper(Number(v) as PaperWidth)}
              options={[
                { value: '58', label: '58 mm' },
                { value: '80', label: '80 mm' },
              ]}
            />
          </div>
          <Field label="Dirección (opcional)" htmlFor="address">
            <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={120} placeholder="Mercado Central, puesto 45" />
          </Field>
          <Field label="RUC / DNI (opcional)" htmlFor="taxId">
            <Input id="taxId" value={taxId} onChange={(e) => setTaxId(e.target.value)} maxLength={20} inputMode="numeric" />
          </Field>
          <Field
            label="Mensaje al pie del ticket"
            htmlFor="footer"
            hint="Este ticket es de control interno; no reemplaza una boleta o factura electrónica."
          >
            <Input id="footer" value={footer} onChange={(e) => setFooter(e.target.value)} maxLength={160} />
          </Field>
        </CardContent>
      </Card>

      <ErrorNote message={error} />
      {saved && (
        <p role="status" className="flex items-center gap-2 rounded-xl bg-fresco/10 px-3 py-2 text-sm font-semibold text-fresco">
          <Check className="h-4 w-4" /> Cambios guardados
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        <Save className="h-5 w-5" /> {busy ? 'Guardando…' : 'Guardar cambios'}
      </Button>
    </form>
  );
}

function AccountCard() {
  const { user, mode, signOut } = useAuth();
  const role = useAppStore((s) => s.role);
  const [busy, setBusy] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cuenta</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {mode === 'supabase' ? (user?.email ?? 'Cuenta en la nube') : 'Acceso local en este dispositivo'}
          {role === 'cajero' ? ' · Rol: Cajero' : ' · Rol: Dueño'}
        </p>
        <Button
          variant="outline"
          className="w-full text-alerta"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await signOut();
            } finally {
              setBusy(false);
            }
          }}
        >
          <LogOut className="h-5 w-5" /> Cerrar sesión
        </Button>
        <p className="text-xs text-muted-foreground">
          Tus datos se quedan guardados en este dispositivo y no se borran al cerrar sesión.
        </p>
      </CardContent>
    </Card>
  );
}
