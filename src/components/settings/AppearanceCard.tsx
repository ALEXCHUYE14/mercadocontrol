'use client';

import { Palette } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Segmented } from '@/components/ui/feedback';
import { setThemePref, useThemePref, type ThemePref } from '@/lib/theme';

export function AppearanceCard() {
  const pref = useThemePref();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" /> Apariencia
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Segmented<ThemePref>
          label="Tema"
          value={pref}
          onChange={setThemePref}
          options={[
            { value: 'light', label: '☀️ Claro' },
            { value: 'dark', label: '🌙 Oscuro' },
            { value: 'system', label: 'Automático' },
          ]}
        />
        <p className="text-xs text-muted-foreground">
          «Automático» sigue el modo de tu teléfono. Es un ajuste de este dispositivo.
        </p>
      </CardContent>
    </Card>
  );
}
