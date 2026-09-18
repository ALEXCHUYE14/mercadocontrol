import type { Metadata } from 'next';
import { Boxes, Receipt, WifiOff } from 'lucide-react';
import { LoginForm } from '@/components/auth/LoginForm';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

export const metadata: Metadata = { title: 'Ingresar' };

const FEATURES = [
  { icon: Boxes, text: 'Inventario con semáforo de frescura' },
  { icon: Receipt, text: 'Ventas con ticket para imprimir o WhatsApp' },
  { icon: WifiOff, text: 'Funciona aunque se caiga el internet' },
];

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      {/*
        Panel de marca. La portada ya trae el nombre y el eslogan dentro de la imagen, por eso
        no se repite el título: solo se listan las ventajas sobre la zona clara inferior.
        - Móvil: la imagen completa (object-contain) para que el logo no se recorte.
        - Escritorio: ocupa la parte superior (object-cover, centrada) y deja libres los ~260px
          inferiores para la lista, así el texto nunca tapa el eslogan de la imagen.
      */}
      <section className="relative isolate overflow-hidden bg-[#f6f7f4] lg:min-h-dvh">
        <div className="relative aspect-[1408/768] w-full lg:absolute lg:inset-x-0 lg:bottom-[260px] lg:top-0 lg:aspect-auto">
          {/* <img> a propósito: es un archivo estático de /public que el Service Worker guarda para uso sin internet */}
          <img
            src="/img/portada.jpg"
            alt="MercadoControl · Gestión inteligente de tus compras"
            width={1408}
            height={768}
            loading="eager"
            decoding="async"
            className="absolute inset-0 h-full w-full object-contain object-center lg:object-cover"
          />
        </div>

        {/* Ventajas: solo escritorio, ancladas abajo, texto oscuro sobre el fondo claro de la imagen */}
        <ul className="relative z-10 mx-auto hidden w-full max-w-md space-y-2.5 px-10 pb-12 text-slate-800 lg:absolute lg:inset-x-0 lg:bottom-0 lg:block">
          {FEATURES.map(({ icon: Icon, text }) => (
            <li
              key={text}
              className="flex items-center gap-3 rounded-2xl border border-slate-900/5 bg-white/80 px-3 py-2.5 font-semibold shadow-sm backdrop-blur"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600/10 text-emerald-700">
                <Icon className="h-5 w-5" />
              </span>
              {text}
            </li>
          ))}
        </ul>
      </section>

      {/* Formulario (el aviso de soporte va dentro de LoginForm) */}
      <section className="relative flex items-start justify-center px-4 pb-10 pt-6 lg:items-center lg:px-12 lg:py-10">
        <ThemeToggle className="absolute right-4 top-4 lg:right-8 lg:top-8" />
        <div className="mt-10 w-full max-w-md lg:mt-0">
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
