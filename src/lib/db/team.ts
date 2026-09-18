'use client';

// =============================================================================
// Equipo del puesto (cajeros). Requiere conexión y Supabase: las altas pasan por
// funciones SQL del servidor (add_stall_member / list / remove) que validan reglas
// que el cliente no puede garantizar por sí solo.
// =============================================================================

import { getSupabase } from '@/lib/supabase/client';

export interface TeamMember {
  member_id: string;
  email: string;
  full_name: string;
  role: string;
  created_at: string;
}

function client() {
  const sb = getSupabase();
  if (!sb) throw new Error('El equipo solo está disponible con una cuenta en la nube');
  if (typeof navigator !== 'undefined' && !navigator.onLine) throw new Error('Necesitas internet para administrar el equipo');
  return sb;
}

/** Los mensajes de las funciones SQL ya vienen en español; los técnicos se ocultan. */
function friendly(err: { message?: string; code?: string }): Error {
  const known = err.code === 'P0001' && err.message; // RAISE EXCEPTION personalizado
  if (known) return new Error(err.message);
  if (err.message?.includes('Could not find the function')) {
    return new Error('Falta ejecutar la migración 0003 en Supabase');
  }
  return new Error('No se pudo completar la operación. Inténtalo de nuevo');
}

export async function listTeam(): Promise<TeamMember[]> {
  const { data, error } = await client().rpc('list_stall_members');
  if (error) throw friendly(error);
  return (data ?? []) as TeamMember[];
}

export async function addTeamMember(email: string): Promise<void> {
  const mail = email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) throw new Error('Escribe un correo válido');
  const { error } = await client().rpc('add_stall_member', { p_email: mail });
  if (error) throw friendly(error);
}

export async function removeTeamMember(memberId: string): Promise<void> {
  const { error } = await client().rpc('remove_stall_member', { p_member_id: memberId });
  if (error) throw friendly(error);
}
