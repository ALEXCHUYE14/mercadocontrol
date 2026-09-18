// =============================================================================
// Impresión de un documento HTML autónomo mediante un iframe oculto.
// Aísla el ticket de los estilos de la app y funciona con cualquier impresora que
// el sistema exponga (térmica USB/Bluetooth con driver, Android Print Service,
// "Guardar como PDF"…). El @page del propio HTML fija el ancho del papel.
// =============================================================================

const CLEANUP_FALLBACK_MS = 60_000;

export function printHtml(html: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('La impresión solo está disponible en el navegador'));
      return;
    }

    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.tabIndex = -1;
    Object.assign(iframe.style, {
      position: 'fixed',
      right: '0',
      bottom: '0',
      width: '0',
      height: '0',
      border: '0',
      visibility: 'hidden',
    } satisfies Partial<CSSStyleDeclaration>);

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      iframe.remove();
    };

    iframe.onload = () => {
      const win = iframe.contentWindow;
      if (!win) {
        cleanup();
        reject(new Error('No se pudo preparar la impresión'));
        return;
      }
      try {
        win.addEventListener('afterprint', cleanup);
        win.focus();
        win.print();
        resolve();
        // Algunos navegadores móviles no disparan afterprint
        setTimeout(cleanup, CLEANUP_FALLBACK_MS);
      } catch (err) {
        cleanup();
        reject(err instanceof Error ? err : new Error('No se pudo imprimir'));
      }
    };

    iframe.srcdoc = html;
    document.body.appendChild(iframe);
  });
}
