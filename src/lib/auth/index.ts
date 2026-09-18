'use client';

import { createLocalAuth } from '@/lib/auth/localAuth';
import { createSupabaseAuth } from '@/lib/auth/supabaseAuth';
import type { AuthService } from '@/lib/auth/types';
import { hasBackend } from '@/lib/supabase/client';

let service: AuthService | null = null;

/** Servicio de autenticación activo: Supabase si está configurado, si no, acceso local. */
export function getAuthService(): AuthService {
  if (!service) service = hasBackend() ? createSupabaseAuth() : createLocalAuth();
  return service;
}

export type { AuthService, AuthUser, AuthMode } from '@/lib/auth/types';
export { AuthError } from '@/lib/auth/types';
