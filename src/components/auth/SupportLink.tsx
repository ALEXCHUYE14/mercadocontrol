import { SUPPORT_WHATSAPP, SUPPORT_WHATSAPP_DISPLAY } from '@/lib/constants';
import { waLink } from '@/lib/logic/whatsapp';
import { cn } from '@/lib/utils';

/** Aviso de soporte por WhatsApp para quien no puede ingresar (una sola línea, discreta). */
export function SupportLink({ context, className }: { context?: string; className?: string }) {
  const message = 'Hola, necesito ayuda para ingresar a MercadoControl.' + (context ? ` (${context})` : '');
  return (
    <p className={cn('text-center text-sm text-muted-foreground', className)}>
      ¿Problemas para acceder?{' '}
      <a
        href={waLink(message, SUPPORT_WHATSAPP)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Contactar al soporte por WhatsApp al ${SUPPORT_WHATSAPP_DISPLAY}`}
        title={SUPPORT_WHATSAPP_DISPLAY}
        className="font-semibold text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-400"
      >
        Contacta al soporte por WhatsApp
      </a>
    </p>
  );
}
