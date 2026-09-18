// =============================================================================
// Tipos de dominio de MercadoControl (espejo del esquema Postgres/Supabase)
// =============================================================================

export type UnitMeasure =
  | 'kg'
  | 'unidad'
  | 'atado'
  | 'saco'
  | 'caja'
  | 'docena'
  | 'litro'
  | 'bandeja';

export type FreshnessState = 'verde' | 'amarillo' | 'rojo';

export type MovementType = 'entrada' | 'salida' | 'ajuste';

export type WasteReason =
  | 'malogrado'
  | 'corte_limpieza'
  | 'napa'
  | 'consumo_personal'
  | 'remate'
  | 'otro';

export interface Profile {
  id: string;
  full_name: string | null;
  stall_name: string | null;
  stall_type: string | null;
  phone: string | null;
  money_saved: number;
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  owner_id: string | null;
  name: string;
  icon: string | null;
  color: string | null;
  avg_shelf_life_days: number;
  yellow_threshold: number;
  red_threshold: number;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  owner_id: string;
  category_id: string | null;
  name: string;
  batch_code: string | null;
  unit: UnitMeasure;
  current_stock: number;
  initial_stock: number;
  avg_cost: number;
  sale_price: number;
  /** Umbral de alerta de stock bajo; 0 = usar el valor por defecto de Ajustes */
  min_stock: number;
  freshness: FreshnessState;
  entry_date: string;
  expires_at: string | null;
  photo_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InventoryLog {
  id: string;
  owner_id: string;
  product_id: string;
  movement: MovementType;
  quantity: number;
  unit_cost: number | null;
  unit_price: number | null;
  note: string | null;
  source: string;
  created_at: string;
}

export interface WasteLog {
  id: string;
  owner_id: string;
  product_id: string;
  reason: WasteReason;
  quantity: number;
  monetary_loss: number;
  note: string | null;
  created_at: string;
}

export type PaymentMethod = 'efectivo' | 'yape' | 'plin' | 'tarjeta' | 'otro' | 'fiado';

/** Métodos con los que se puede COBRAR dinero (el fiado es venta a crédito, no un cobro). */
export type CashMethod = Exclude<PaymentMethod, 'fiado'>;

export type Role = 'owner' | 'cajero';

/** Cabecera de una venta (un ticket). El detalle vive en SaleItem. */
export interface Sale {
  id: string;
  owner_id: string;
  /** Correlativo legible del ticket (ej. "000042"), único por dispositivo */
  ticket_number: string;
  customer_name: string | null;
  customer_phone: string | null;
  payment_method: PaymentMethod;
  subtotal: number;
  discount: number;
  total: number;
  /** Solo en efectivo: lo que entregó el cliente (para calcular el vuelto) */
  amount_paid: number | null;
  note: string | null;
  /** Cliente de la venta (obligatorio en fiado) */
  customer_id: string | null;
  /** Quién cobró (nombre), para el equipo */
  seller_name: string | null;
  voided_at: string | null;
  void_reason: string | null;
  created_at: string;
}

export interface Customer {
  id: string;
  owner_id: string;
  name: string;
  phone: string | null;
  created_at: string;
}

export interface CreditPayment {
  id: string;
  owner_id: string;
  customer_id: string;
  amount: number;
  payment_method: CashMethod;
  note: string | null;
  received_by: string | null;
  created_at: string;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  owner_id: string;
  /** null si el producto se eliminó después; el nombre queda como respaldo del ticket */
  product_id: string | null;
  product_name: string;
  unit: UnitMeasure;
  quantity: number;
  unit_price: number;
  /** Costo promedio al momento de la venta (para la ganancia real); null en ventas antiguas */
  unit_cost: number | null;
  subtotal: number;
  created_at: string;
}

export interface SaleWithItems {
  sale: Sale;
  items: SaleItem[];
}

export interface DailyClosure {
  id: string;
  owner_id: string;
  closure_date: string;
  total_sales: number;
  total_waste_loss: number;
  inventory_capital: number;
  items_adjusted: number;
  note: string | null;
  created_at: string;
}

// --- Metadatos de motivos de merma (para la UI a un tap) ---
export interface WasteReasonMeta {
  reason: WasteReason;
  label: string;
  emoji: string;
  /** true = pérdida real (basura); false = salida útil (recupera valor) */
  isLoss: boolean;
  colorClass: string;
}

export const WASTE_REASONS: WasteReasonMeta[] = [
  { reason: 'malogrado', label: 'Malogrado', emoji: '🗑️', isLoss: true, colorClass: 'bg-alerta' },
  { reason: 'corte_limpieza', label: 'Corte / Limpieza', emoji: '✂️', isLoss: true, colorClass: 'bg-atencion' },
  { reason: 'napa', label: 'Ñapa / Regalo', emoji: '🎁', isLoss: false, colorClass: 'bg-fresco' },
  { reason: 'consumo_personal', label: 'Almuerzo / Consumo', emoji: '🍲', isLoss: true, colorClass: 'bg-bosque' },
  { reason: 'remate', label: 'Vendí en remate', emoji: '🔖', isLoss: false, colorClass: 'bg-fresco' },
];

// --- Cola de sincronización offline ---
export type SyncEntity =
  | 'products'
  | 'inventory_logs'
  | 'waste_logs'
  | 'daily_closures'
  | 'profiles'
  | 'sales'
  | 'sale_items'
  | 'customers'
  | 'credit_payments';
export type SyncOp = 'insert' | 'update' | 'delete';

export interface SyncMutation {
  id?: number;               // autoincrement local
  entity: SyncEntity;
  op: SyncOp;
  payload: Record<string, unknown>;
  createdAt: number;
  tries: number;
  lastError?: string;
}
