import { createHash, randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { hashSecret, sha256, verifySecret } from '@/lib/auth/password';

describe('sha256 (respaldo en JS puro)', () => {
  // Longitudes elegidas para cruzar los límites de relleno de bloques de 64 bytes
  // (0, 55/56 = borde del último bloque, 63/64/65 = borde exacto, 119/120 = dos bloques).
  it.each([0, 1, 55, 56, 63, 64, 65, 119, 120, 1000])('coincide con node:crypto para %i bytes', (n) => {
    const data = randomBytes(n);
    const expected = createHash('sha256').update(data).digest('hex');
    expect(Buffer.from(sha256(new Uint8Array(data))).toString('hex')).toBe(expected);
  });
});

describe('hashSecret / verifySecret', () => {
  it('verifica la clave correcta y rechaza una incorrecta', async () => {
    const record = await hashSecret('clave123');
    expect(await verifySecret('clave123', record)).toBe(true);
    expect(await verifySecret('clave124', record)).toBe(false);
  });

  it('nunca guarda la clave en texto plano', async () => {
    const record = await hashSecret('clave-super-secreta');
    expect(JSON.stringify(record)).not.toContain('clave-super-secreta');
  });

  it('dos hashes de la misma clave usan sales distintas (no son iguales)', async () => {
    const a = await hashSecret('igual');
    const b = await hashSecret('igual');
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
  });
});
