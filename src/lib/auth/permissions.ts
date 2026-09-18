// =============================================================================
// Permisos por rol (PURO). Se aplica en tres capas: rutas/menú (UI), repositorios
// (defensa en profundidad) y RLS en Postgres (migración 0003).
// =============================================================================

import type { Role } from '@/types';

export type Action =
  | 'sell'            // cobrar ventas y ver el historial
  | 'viewInventory'
  | 'editInventory'   // alta/edición de productos, reabastecer
  | 'waste'           // registrar mermas
  | 'voidSale'
  | 'credit'          // ver clientes y registrar abonos
  | 'closure'
  | 'reports'
  | 'manageTeam'
  | 'editBusiness';   // datos del negocio y ticket

const CAJERO: ReadonlySet<Action> = new Set<Action>(['sell', 'viewInventory', 'credit']);

export function can(role: Role, action: Action): boolean {
  return role === 'owner' ? true : CAJERO.has(action);
}

/** Acción necesaria para abrir cada ruta privada (las no listadas son libres). */
const ROUTE_ACTION: Record<string, Action> = {
  '/': 'reports',
  '/inventario': 'viewInventory',
  '/ventas': 'sell',
  '/fiados': 'credit',
  '/mermas': 'waste',
  '/cierre': 'closure',
  '/remates': 'editInventory',
  '/reportes': 'reports',
};

export function canOpenRoute(role: Role, pathname: string): boolean {
  const key = Object.keys(ROUTE_ACTION).find((r) => (r === '/' ? pathname === '/' : pathname === r || pathname.startsWith(r + '/')));
  return key ? can(role, ROUTE_ACTION[key]) : true;
}

/** Pantalla de inicio de cada rol. */
export function homeRoute(role: Role): string {
  return role === 'owner' ? '/' : '/ventas';
}
