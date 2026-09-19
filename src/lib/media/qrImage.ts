// =============================================================================
// Preparación de la imagen del QR de cobro (Yape / Plin) antes de guardarla.
// Se reduce a un tamaño razonable y se guarda como data URL: no depende de la nube y
// funciona sin internet. Todo error se devuelve como mensaje claro para la persona.
// =============================================================================

export const QR_MAX_SIDE = 720;
export const QR_MIN_SIDE = 64;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
/** Tope de la imagen ya procesada (data URL). Debe coincidir con la validación de Ajustes. */
export const MAX_QR_DATA_URL = 450_000;

const ALLOWED = /^image\/(png|jpe?g|webp)$/i;
export const QR_DATA_URL_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;

/** ¿Es un data URL de imagen permitido y de tamaño razonable? (validación de lo guardado) */
export function isValidQrDataUrl(value: unknown): value is string {
  return typeof value === 'string' && value.length <= MAX_QR_DATA_URL && QR_DATA_URL_RE.test(value);
}

/** Reduce (nunca agranda) manteniendo la proporción, con lado máximo `max`. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  if (!(width > 0) || !(height > 0)) throw new Error('La imagen no tiene tamaño válido');
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

interface Loaded {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
}

async function loadImage(file: File): Promise<Loaded> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file);
      return { source: bmp, width: bmp.width, height: bmp.height, release: () => bmp.close() };
    } catch { /* se intenta con <img> */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('No se pudo leer la imagen'));
      el.src = url;
    });
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

function render(loaded: Loaded, maxSide: number, mime: 'image/png' | 'image/jpeg', quality?: number): string {
  const { width, height } = fitWithin(loaded.width, loaded.height, maxSide);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Tu navegador no puede procesar imágenes');
  // Fondo blanco: un PNG con transparencia se vería negro en modo oscuro y no se escanearía
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(loaded.source, 0, 0, width, height);
  return canvas.toDataURL(mime, quality);
}

/** Valida y reduce el archivo elegido; devuelve un data URL listo para guardar. */
export async function processQrFile(file: File): Promise<string> {
  if (!ALLOWED.test(file.type)) throw new Error('Sube una imagen PNG, JPG o WebP');
  if (file.size > MAX_FILE_BYTES) throw new Error('La imagen es muy pesada (máximo 10 MB)');

  const loaded = await loadImage(file).catch(() => {
    throw new Error('No se pudo leer la imagen. Prueba con otra captura');
  });
  try {
    if (Math.min(loaded.width, loaded.height) < QR_MIN_SIDE) {
      throw new Error('La imagen es demasiado pequeña para escanearse');
    }
    // PNG conserva nítidos los módulos del QR; si pesa demasiado se comprime en JPG
    const attempts: Array<() => string> = [
      () => render(loaded, QR_MAX_SIDE, 'image/png'),
      () => render(loaded, QR_MAX_SIDE, 'image/jpeg', 0.92),
      () => render(loaded, 560, 'image/jpeg', 0.85),
    ];
    for (const attempt of attempts) {
      const dataUrl = attempt();
      if (isValidQrDataUrl(dataUrl)) return dataUrl;
    }
    throw new Error('La imagen sigue muy pesada. Recórtala solo al QR e inténtalo de nuevo');
  } finally {
    loaded.release();
  }
}
