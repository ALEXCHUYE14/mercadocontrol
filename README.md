# 🧺 MercadoControl

**PWA offline-first para comerciantes de mercados de abastos.** Inventario
inteligente, semáforo de frescura y registro de mermas a un tap — pensada para
manos ocupadas, luz solar directa y conexión inestable.

> Stack: **Next.js 16 (App Router, TypeScript)** · **Tailwind CSS** · **shadcn/ui** ·
> **Lucide** · **Supabase** (Postgres + Auth + RLS) · **Dexie/IndexedDB** ·
> **React Query** · **Zustand** · **Web Speech API**.

---

## 🚀 Puesta en marcha

```bash
npm install
cp .env.example .env.local     # opcional: rellena tus claves de Supabase
npm run dev                    # http://localhost:3000
```

> **Sin backend también funciona.** Si no configuras Supabase, la app corre en
> **modo demo 100% local** con datos de ejemplo guardados en IndexedDB. Ideal
> para probarla de inmediato.

### Producción

```bash
npm run build
npm run start
```

---

## 🗄️ Base de datos (Supabase)

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. Abre **SQL Editor** y ejecuta el script `supabase/migrations/0001_init.sql`.
   Crea las 6 tablas, enums, índices, **RLS** (aislamiento total por comerciante)
   y los **triggers** de stock, PPC, merma y timestamps.
3. Copia la URL y la `anon key` (Project Settings → API) a `.env.local`.

El semáforo de frescura se recalcula tanto en el cliente (offline) como en el
servidor vía la función `fn_recalc_freshness(owner)`.

---

## 📦 Estructura

```
mercadocontrol/
├─ supabase/migrations/0001_init.sql   # Esquema + RLS + triggers
├─ public/
│  ├─ manifest.json                    # PWA
│  └─ sw.js                            # Service Worker (offline + background sync)
├─ src/
│  ├─ app/                             # Rutas (App Router)
│  │  ├─ layout.tsx  page.tsx          # Dashboard
│  │  ├─ inventario/  mermas/  cierre/  remates/
│  │  └─ providers.tsx                 # React Query + bootstrap offline
│  ├─ components/
│  │  ├─ ui/                           # Primitivas (button, card, sheet, stepper…)
│  │  ├─ layout/                       # TopBar, BottomNav, FAB
│  │  ├─ dashboard/  inventory/  mermas/  cierre/
│  ├─ lib/
│  │  ├─ supabase/client.ts            # Cliente Supabase
│  │  ├─ db/                           # Dexie, repositorio, motor de sync, seed
│  │  └─ logic/                        # Frescura, PPC, WhatsApp, parser de voz
│  ├─ hooks/                           # React Query + Web Speech API
│  ├─ stores/                          # Zustand (estado de UI)
│  └─ types/                           # Tipos de dominio
```

---

## 🧠 Cómo funciona el modo offline

1. **Toda escritura** entra primero a **Dexie/IndexedDB** (respuesta instantánea).
2. Se **encola** en `syncQueue` como mutación pendiente.
3. El **motor de sync** (`lib/db/sync.ts`) vacía la cola hacia Supabase con
   `upsert` idempotente cuando hay conexión, disparado por el evento `online` o
   por **Background Sync** del Service Worker.
4. La lógica de negocio (stock, PPC, pérdida, frescura) está **replicada en el
   cliente**, así los números cuadran aunque nunca haya red.

---

## ✨ Módulos

- **Inventario inteligente** — alta por voz (*"30 kilos de tomate a 2.50"*),
  mosaico de categorías, PPC automático.
- **Semáforo de frescura** — 🟢 fresco / 🟡 prioritario / 🔴 urgente, con
  sugerencia de acción.
- **Merma a un tap** — motivo (malogrado, corte, ñapa, consumo, remate) +
  cantidad + pérdida en soles en vivo.
- **Remate** — catálogo automático con descuento, listo para WhatsApp.
- **Cierre nocturno** — asistente de 3 pasos + pedido al mayorista por WhatsApp.

---

## ♿ Accesibilidad y ergonomía

- Áreas táctiles **≥ 56px**, tipografía grande, alto contraste para luz solar.
- Navegación inferior al alcance del pulgar + botón flotante de acción.
- Paleta "Naturaleza & Abasto" (verde fresco, verde bosque, ámbar, rojo coral).

---

Hecho para el mercado. 🇵🇪
