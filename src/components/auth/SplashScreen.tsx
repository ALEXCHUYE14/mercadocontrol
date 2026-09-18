import { Spinner } from '@/components/ui/feedback';

export function SplashScreen({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background">
      <span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-bosque text-4xl shadow-pop">🧺</span>
      <p className="text-xl font-extrabold tracking-tight">MercadoControl</p>
      <div className="flex items-center gap-3 text-muted-foreground">
        <Spinner />
        <span className="text-sm font-medium">{label}</span>
      </div>
    </div>
  );
}
