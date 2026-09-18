import {
  Boxes,
  Home,
  LineChart,
  Moon,
  Receipt,
  Settings,
  Trash2,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { can, type Action } from '@/lib/auth/permissions';
import type { Role } from '@/types';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Acción que exige el rol para ver la opción (sin acción = todos) */
  action?: Action;
  /** Va directo en la barra inferior del móvil; el resto queda en "Más" */
  primary: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Inicio', icon: Home, action: 'reports', primary: true },
  { href: '/inventario', label: 'Inventario', icon: Boxes, action: 'viewInventory', primary: true },
  { href: '/ventas', label: 'Ventas', icon: Receipt, action: 'sell', primary: true },
  { href: '/fiados', label: 'Fiados', icon: Wallet, action: 'credit', primary: true },
  { href: '/mermas', label: 'Mermas', icon: Trash2, action: 'waste', primary: false },
  { href: '/cierre', label: 'Cierre', icon: Moon, action: 'closure', primary: false },
  { href: '/reportes', label: 'Reportes', icon: LineChart, action: 'reports', primary: false },
  { href: '/ajustes', label: 'Ajustes', icon: Settings, primary: false },
];

/** Opciones visibles para un rol. */
export function navFor(role: Role): NavItem[] {
  return NAV_ITEMS.filter((i) => !i.action || can(role, i.action));
}

export function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/');
}
