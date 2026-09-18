'use client';

// =============================================================================
// Tema claro / oscuro. Por defecto la app se ve en CLARO (color natural); la persona
// cambia a oscuro con el botón. «Automático» (sigue al teléfono) es opcional en Ajustes.
// La preferencia vive en localStorage (es del dispositivo). El script inline de
// layout.tsx aplica la clase antes del primer pintado para evitar el parpadeo.
// =============================================================================

import { useSyncExternalStore } from 'react';

export type ThemePref = 'light' | 'dark' | 'system';

export const THEME_KEY = 'mc_theme';
const EVENT = 'mc-theme-change';

/** Script mínimo que se ejecuta ANTES de pintar (debe coincidir con la lógica de applyTheme). */
export const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem('${THEME_KEY}');var d=p==='dark'||(p==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;if(d)r.classList.add('dark');r.style.colorScheme=d?'dark':'light';}catch(e){}})();`;

function isPref(v: unknown): v is ThemePref {
  return v === 'light' || v === 'dark' || v === 'system';
}

/** Preferencia guardada; sin nada guardado (o dato corrupto) es CLARO. */
export function getThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return isPref(v) ? v : 'light';
  } catch {
    return 'light';
  }
}

function prefersDark(): boolean {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

/** ¿Este valor produce el modo oscuro ahora mismo? */
export function resolvesToDark(pref: ThemePref): boolean {
  return pref === 'dark' || (pref === 'system' && prefersDark());
}

export function applyTheme(pref: ThemePref): void {
  const dark = resolvesToDark(pref);
  const root = document.documentElement;
  root.classList.toggle('dark', dark);
  root.style.colorScheme = dark ? 'dark' : 'light';
}

export function setThemePref(pref: ThemePref): void {
  try {
    localStorage.setItem(THEME_KEY, pref);
  } catch { /* almacenamiento bloqueado: el tema aplica solo en esta sesión */ }
  applyTheme(pref);
  window.dispatchEvent(new Event(EVENT));
}

/** Cambia entre claro y oscuro según lo que se ve AHORA (si estaba en automático, pasa al contrario). */
export function toggleTheme(): void {
  const isDark = document.documentElement.classList.contains('dark');
  setThemePref(isDark ? 'light' : 'dark');
}

function subscribe(cb: () => void): () => void {
  let media: MediaQueryList | null = null;
  try {
    media = window.matchMedia('(prefers-color-scheme: dark)');
  } catch { /* navegador sin matchMedia */ }
  const onMedia = () => {
    if (getThemePref() === 'system') applyTheme('system'); // sigue al sistema
    cb();
  };
  window.addEventListener(EVENT, cb);
  window.addEventListener('storage', cb);
  media?.addEventListener('change', onMedia);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener('storage', cb);
    media?.removeEventListener('change', onMedia);
  };
}

/** Preferencia guardada (en el servidor siempre 'light'). */
export function useThemePref(): ThemePref {
  return useSyncExternalStore(subscribe, getThemePref, () => 'light');
}

/** true si el modo oscuro está activo en pantalla (en el servidor siempre false). */
export function useIsDark(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => document.documentElement.classList.contains('dark'),
    () => false
  );
}
