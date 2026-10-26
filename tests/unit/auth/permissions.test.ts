import { describe, expect, it } from 'vitest';
import { can, canOpenRoute, homeRoute, type Action } from '@/lib/auth/permissions';

const ALL_ACTIONS: Action[] = [
  'sell',
  'viewInventory',
  'editInventory',
  'waste',
  'voidSale',
  'credit',
  'closure',
  'reports',
  'manageTeam',
  'editBusiness',
];

describe('can', () => {
  it('el dueño puede todo', () => {
    expect(ALL_ACTIONS.every((a) => can('owner', a))).toBe(true);
  });

  it('el cajero solo vende, ve inventario y cobra fiados', () => {
    expect(can('cajero', 'sell')).toBe(true);
    expect(can('cajero', 'viewInventory')).toBe(true);
    expect(can('cajero', 'credit')).toBe(true);
  });

  it('el cajero no anula, no reporta, no administra equipo, no da de alta ni cierra caja', () => {
    for (const a of ['voidSale', 'reports', 'manageTeam', 'waste', 'closure', 'editInventory', 'editBusiness'] as Action[]) {
      expect(can('cajero', a)).toBe(false);
    }
  });
});

describe('canOpenRoute', () => {
  it('el cajero puede abrir ventas, inventario y fiados', () => {
    expect(canOpenRoute('cajero', '/ventas')).toBe(true);
    expect(canOpenRoute('cajero', '/inventario')).toBe(true);
    expect(canOpenRoute('cajero', '/fiados')).toBe(true);
  });

  it('el cajero no puede abrir inicio, mermas, cierre, remates ni reportes', () => {
    for (const r of ['/', '/mermas', '/cierre', '/remates', '/reportes']) {
      expect(canOpenRoute('cajero', r)).toBe(false);
    }
  });

  it('el dueño puede abrir cualquier ruta conocida', () => {
    expect(canOpenRoute('owner', '/')).toBe(true);
    expect(canOpenRoute('owner', '/reportes')).toBe(true);
  });

  it('una ruta no listada (p. ej. ajustes) queda libre para ambos roles', () => {
    expect(canOpenRoute('cajero', '/ajustes')).toBe(true);
  });

  it('coincide por prefijo, no solo exacto (subrutas)', () => {
    expect(canOpenRoute('cajero', '/ventas/historial')).toBe(true);
    expect(canOpenRoute('cajero', '/mermas/algo')).toBe(false);
  });
});

describe('homeRoute', () => {
  it('el dueño entra al dashboard; el cajero, directo a vender', () => {
    expect(homeRoute('owner')).toBe('/');
    expect(homeRoute('cajero')).toBe('/ventas');
  });
});
