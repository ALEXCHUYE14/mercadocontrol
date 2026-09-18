/** Claves de React Query centralizadas (evita typos al invalidar). */
export const KEYS = {
  products: ['products'] as const,
  categories: ['categories'] as const,
  metrics: ['metrics', 'today'] as const,
  sales: ['sales'] as const,
  report: ['report', 'dashboard'] as const,
  settings: ['settings'] as const,
  profile: ['profile'] as const,
  ticketBusiness: ['ticket-business'] as const,
  credit: ['credit'] as const,
  customers: ['customers'] as const,
  team: ['team'] as const,
  reports: ['reports'] as const,
};
