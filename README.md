# 🧺 MercadoControl

**PWA offline-first para comerciantes de mercados de abastos.** Inventario
inteligente, **ventas con ticket (imprimir / WhatsApp)**, semáforo de frescura y
registro de mermas a un tap — pensada para manos ocupadas, luz solar directa y
conexión inestable.

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
> **modo local**: la primera vez crea un acceso protegido con clave en el
> dispositivo y guarda todo en IndexedDB (puedes cargar productos de ejemplo
> desde el inventario vacío). Con Supabase configurado, el login es con correo y
> contraseña y los datos se respaldan en la nube.

### 🔐 Acceso (login)

| Modo | Cuándo | Cómo ingresa |
|---|---|---|
| **Supabase** | `.env.local` con URL y anon key | Correo + contraseña (registro incluido). La sesión persiste y funciona sin internet. |
| **Local** | Sin `.env.local` | Una cuenta por dispositivo con clave (PBKDF2, con bloqueo tras 5 intentos). Protege el acceso a la app; los datos de IndexedDB **no** están cifrados. |

En Supabase, si activas *Confirm email*, el usuario debe confirmar su correo antes
de ingresar.

### 🧾 Tickets de venta

Cada venta (rápida o desde **Ventas → Nueva venta**) genera un ticket numerado con
detalle, descuento, método de pago (efectivo/Yape/Plin/tarjeta) y vuelto. Desde el
ticket puedes **imprimir** (58 mm u 80 mm, o "Guardar como PDF"), **enviar por
WhatsApp** (al celular del cliente si lo registraste), copiar o compartir.
Ajusta papel, dirección, RUC/DNI y mensaje en **Ajustes**; ahí mismo hay un
*ticket de prueba*. El ticket es de **control interno**, no reemplaza una boleta o
factura electrónica SUNAT.

**Formas de imprimir**

| Opción | Cuándo usarla |
|---|---|
| **Bluetooth directo (ESC/POS)** | Impresora térmica **BLE** con Chrome/Edge (Android o PC, HTTPS o `localhost`). Empareja una vez en *Ajustes → Impresora*; después imprime con un toque. No funciona en iPhone/iPad. |
| **RawBT** (solo Android) | Impresoras Bluetooth *clásicas* (SPP), que Web Bluetooth no ve. Instala la app RawBT y usa el botón del ticket. |
| **Diálogo del sistema / PDF** | Cualquier impresora instalada en el dispositivo (USB, Wi‑Fi, servicio de impresión de Android) o «Guardar como PDF». |

El ticket ESC/POS usa la página de códigos PC858 (acentos, ñ, ¿, ¡). Activa
*Cortar el papel* solo si tu impresora tiene cortador.

### 👥 Roles (dueño y cajero)

Con Supabase, el dueño agrega cajeros por correo en *Ajustes → Equipo* (la persona
debe haberse registrado antes). El **cajero** puede vender, ver el inventario y cobrar
fiados; **no** puede anular ventas, ver reportes, editar/reabastecer productos,
registrar mermas, cerrar caja ni cambiar el negocio. Se aplica en la interfaz, en los
repositorios y en la base de datos (RLS).

### 🤝 Fiado, 📊 Reportes, ⚠️ Stock mínimo, 🌙 Modo oscuro

- **Fiado:** elige *Fiado* al cobrar y selecciona/crea el cliente. En **Fiados** ves
  cuánto te debe cada uno, registras abonos y mandas recordatorios por WhatsApp.
  Anular una venta fiada baja la deuda.
- **Anular ventas:** solo el dueño; devuelve el stock y excluye la venta de todos los
  totales. El ticket queda marcado como ANULADO.
- **Reportes:** por hoy/ayer/7/30 días/mes/rango, con filtro de método de pago, ganancia
  bruta (usa el costo guardado en cada venta), por vendedor y por producto. Exporta a
  **Excel (CSV)** y **PDF**.
- **Stock mínimo:** umbral por producto (o uno por defecto en Ajustes); alertas en
  inventario, inicio y en el pedido al mayorista.
- **Tema:** claro, oscuro o automático (*Ajustes → Apariencia*).
- **Contraseña:** recuperación por correo (`/recuperar`) y cambio desde *Ajustes → Seguridad*.

### Producción

```bash
npm run build
npm run start
```

---

## 🗄️ Base de datos (Supabase)

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. Abre **SQL Editor** y ejecuta, **en orden**:
   - `supabase/migrations/0001_init.sql` — 6 tablas, enums, índices, **RLS**
     (aislamiento total por comerciante) y **triggers** de stock, PPC, merma y timestamps.
   - `supabase/migrations/0002_sales.sql` — tablas `sales` y `sale_items` (tickets).
     Sin este script las ventas no se sincronizan.
   - `supabase/migrations/0003_team_credit_reports.sql` — stock mínimo, costo por
     línea de venta, anulaciones, fiado (clientes y abonos), equipo con roles y las
     políticas RLS actualizadas. **Ejecútalo antes de usar la app con Supabase**: el
     cliente ya envía estos campos y, sin el script, la sincronización se detiene.
3. Para la recuperación de contraseña, en Supabase → *Authentication → URL
   Configuration* agrega tu dominio (y `http://localhost:3000`) a *Redirect URLs*.
4. Copia la URL y la `anon key` (Project Settings → API) a `.env.local`.

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
│  │  ├─ layout.tsx  providers.tsx     # Raíz: fuente, React Query, AuthProvider
│  │  ├─ (auth)/login/                 # Pantalla pública de acceso
│  │  └─ (app)/                        # Pantallas privadas (protegidas por SessionGate)
│  │     ├─ page.tsx                   # Dashboard
│  │     └─ inventario/ ventas/ mermas/ cierre/ remates/ ajustes/
│  ├─ components/
│  │  ├─ ui/                           # Primitivas (button, card, sheet, stepper, feedback…)
│  │  ├─ layout/                       # AppShell, Sidebar, TopBar, BottomNav, FAB
│  │  ├─ auth/  ticket/  sales/  settings/
│  │  ├─ dashboard/  inventory/  mermas/  cierre/
│  ├─ lib/
│  │  ├─ auth/                         # Contrato AuthService + Supabase / Local
│  │  ├─ supabase/client.ts            # Cliente Supabase
│  │  ├─ db/                           # Dexie, repositorios (productos, ventas, ajustes), sync, sesión
│  │  ├─ print/                        # Impresión por iframe aislado
│  │  └─ logic/                        # Lógica PURA y testeable: frescura, PPC, ticket, carrito,
│  │                                   # reportes, WhatsApp, parser de voz
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
