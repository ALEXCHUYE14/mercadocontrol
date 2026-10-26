import { describe, expect, it } from 'vitest';
import { buildRemateCatalog, buildWholesalerOrder, normalizePhone, waLink } from '@/lib/logic/whatsapp';
import { formatPEN } from '@/lib/utils';
import type { Product } from '@/types';

const now = Date.now();
const iso = (daysAgo: number) => new Date(now - daysAgo * 86_400_000).toISOString();

function product(overrides: Partial<Product>): Product {
  return {
    id: 'p1',
    owner_id: 'o',
    category_id: null,
    name: 'Tomate',
    batch_code: null,
    unit: 'kg',
    current_stock: 5,
    initial_stock: 5,
    avg_cost: 2,
    sale_price: 3,
    min_stock: 5,
    freshness: 'verde',
    entry_date: iso(10),
    expires_at: null,
    photo_url: null,
    is_active: true,
    created_at: iso(10),
    updated_at: iso(0),
    ...overrides,
  };
}

describe('normalizePhone', () => {
  it('celular peruano de 9 dígitos recibe el prefijo 51', () => {
    expect(normalizePhone('987 654 321')).toBe('51987654321');
  });

  it('ya trae código de país', () => {
    expect(normalizePhone('+51 987654321')).toBe('51987654321');
  });

  it('demasiado corto se descarta', () => {
    expect(normalizePhone('12345')).toBeNull();
  });

  it('vacío o nulo se descarta', () => {
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
  });
});

describe('waLink', () => {
  it('sin teléfono apunta al wa.me genérico', () => {
    expect(waLink('hola')).toMatch(/^https:\/\/wa\.me\/\?text=/);
  });

  it('con teléfono válido apunta al contacto', () => {
    expect(waLink('hola', '987654321')).toMatch(/^https:\/\/wa\.me\/51987654321\?text=/);
  });
});

describe('buildRemateCatalog', () => {
  it('incluye solo productos amarillo/rojo con stock, con el descuento aplicado', () => {
    const fresh = product({ id: 'fresh', entry_date: iso(0) });
    const urgent = product({ id: 'urgent', entry_date: iso(10), sale_price: 10 });
    const soldOut = product({ id: 'soldout', entry_date: iso(10), current_stock: 0 });
    const inactive = product({ id: 'inactivo', entry_date: iso(10), is_active: false });
    const { text, count } = buildRemateCatalog([fresh, urgent, soldOut, inactive], new Map(), { discount: 0.3 });
    expect(count).toBe(1);
    expect(text).toContain(formatPEN(7)); // 10 * (1 - 0.3)
    expect(text.match(/Tomate/g)).toHaveLength(1); // solo "urgent" entra, no fresh/soldOut/inactive
  });

  it('sin productos en remate muestra el mensaje "todo fresco"', () => {
    const { text, count } = buildRemateCatalog([product({ entry_date: iso(0) })], new Map());
    expect(count).toBe(0);
    expect(text).toMatch(/todo fresco/i);
  });
});

describe('buildWholesalerOrder', () => {
  it('lista productos en o por debajo de su stock mínimo (propio o el valor por defecto)', () => {
    const low = product({ id: 'low', current_stock: 3, min_stock: 5 });
    const ok = product({ id: 'ok', current_stock: 20, min_stock: 5 });
    const { text, count } = buildWholesalerOrder([low, ok], { lowStockThreshold: 5 });
    expect(count).toBe(1);
    expect(text).toContain('Tomate');
  });

  it('sin nada por reponer avisa que el stock está saludable', () => {
    const { text, count } = buildWholesalerOrder([product({ current_stock: 20, min_stock: 5 })], {
      lowStockThreshold: 5,
    });
    expect(count).toBe(0);
    expect(text).toMatch(/saludable/i);
  });
});
