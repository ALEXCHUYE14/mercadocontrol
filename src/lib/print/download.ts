/** Descarga un archivo de texto generado en el navegador (CSV compatible con Excel: UTF-8 con BOM). */
export function downloadTextFile(filename: string, content: string, mime = 'text/csv;charset=utf-8'): void {
  const bom = mime.startsWith('text/csv') ? '﻿' : '';
  const blob = new Blob([bom + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.replace(/[^\w.\-]+/g, '_');
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Se libera después para no cortar la descarga en navegadores lentos
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
