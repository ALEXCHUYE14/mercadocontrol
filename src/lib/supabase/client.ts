'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Cliente de navegador (singleton). Usa la clave anónima pública; la seguridad
// real la garantizan las políticas RLS del lado de Postgres.
let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Si no hay credenciales, la app sigue funcionando en modo 100% local (demo).
  if (!url || !key) return null;

  if (!_client) {
    _client = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      global: {
        headers: { 'x-application-name': 'mercadocontrol' },
      },
    });
  }
  return _client;
}

/** true cuando hay backend configurado (si no, corre en modo demo local). */
export function hasBackend(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
