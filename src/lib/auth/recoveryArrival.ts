// Se evalúa al cargar la página (import estático desde RecoveryLoader), ANTES de que el
// cliente de Supabase procese y limpie la URL. Así se sabe si la persona llegó desde el
// enlace del correo de recuperación o si el enlace ya venció.

export interface RecoveryArrival {
  recovery: boolean;
  expired: boolean;
}

export const ARRIVAL: RecoveryArrival =
  typeof window === 'undefined'
    ? { recovery: false, expired: false }
    : (() => {
        const hash = window.location.hash;
        const search = window.location.search;
        const failed = /error(_code|_description)?=/i.test(hash + search);
        return {
          recovery: !failed && (/type=recovery/i.test(hash) || /[?&](code|token_hash)=/i.test(search)),
          expired: failed,
        };
      })();
