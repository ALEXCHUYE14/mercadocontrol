// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { THEME_INIT_SCRIPT, THEME_KEY, applyTheme, getThemePref, resolvesToDark, setThemePref, toggleTheme } from '@/lib/theme';

let systemPrefersDark = false;

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('dark');
  document.documentElement.style.colorScheme = '';
  systemPrefersDark = false;
  // jsdom no implementa matchMedia: se simula solo con lo que theme.ts usa (.matches).
  window.matchMedia = vi.fn().mockImplementation(() => ({
    matches: systemPrefersDark,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getThemePref', () => {
  it('sin nada guardado, CLARO (aunque el sistema esté en oscuro)', () => {
    systemPrefersDark = true;
    expect(getThemePref()).toBe('light');
  });

  it('un valor corrupto en localStorage también cae a claro', () => {
    localStorage.setItem(THEME_KEY, 'basura');
    expect(getThemePref()).toBe('light');
  });

  it('respeta lo guardado', () => {
    localStorage.setItem(THEME_KEY, 'dark');
    expect(getThemePref()).toBe('dark');
  });
});

describe('resolvesToDark / applyTheme', () => {
  it('"light" nunca es oscuro aunque el sistema sí lo sea', () => {
    systemPrefersDark = true;
    expect(resolvesToDark('light')).toBe(false);
  });

  it('"dark" siempre es oscuro', () => {
    expect(resolvesToDark('dark')).toBe(true);
  });

  it('"system" sigue al sistema operativo', () => {
    systemPrefersDark = true;
    expect(resolvesToDark('system')).toBe(true);
    systemPrefersDark = false;
    expect(resolvesToDark('system')).toBe(false);
  });

  it('applyTheme pone/quita la clase .dark y el color-scheme', () => {
    applyTheme('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe('dark');
    applyTheme('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe('light');
  });
});

describe('setThemePref / toggleTheme', () => {
  it('guarda la preferencia y la aplica de inmediato', () => {
    setThemePref('dark');
    expect(localStorage.getItem(THEME_KEY)).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('alternar pasa al contrario de lo que se ve, no de la preferencia guardada', () => {
    systemPrefersDark = true;
    setThemePref('system'); // se ve oscuro, aunque la preferencia sea "system"
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    toggleTheme();
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem(THEME_KEY)).toBe('light'); // ahora es explícito, no "system"
  });

  it('notifica a los suscriptores (para que el botón refleje el cambio)', () => {
    const spy = vi.fn();
    window.addEventListener('mc-theme-change', spy);
    setThemePref('dark');
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe('THEME_INIT_SCRIPT (se ejecuta antes de pintar, para evitar el parpadeo)', () => {
  const run = () => new Function(THEME_INIT_SCRIPT)();

  it('sin preferencia guardada no marca oscuro, aunque el sistema lo esté', () => {
    systemPrefersDark = true;
    run();
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('con "dark" guardado, marca oscuro', () => {
    localStorage.setItem(THEME_KEY, 'dark');
    run();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('con "system" guardado, sigue al sistema', () => {
    localStorage.setItem(THEME_KEY, 'system');
    systemPrefersDark = true;
    run();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
