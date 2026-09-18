'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KEYS } from '@/hooks/queryKeys';
import { getDashboardReport, getRecentSales, getSalesBetween } from '@/lib/db/sales';
import {
  getProfile,
  getSettings,
  getTicketBusiness,
  saveSettings,
  updateProfile,
  type AppSettings,
  type ProfilePatch,
} from '@/lib/db/settings';

export function useRecentSales(limit = 50) {
  return useQuery({ queryKey: [...KEYS.sales, limit], queryFn: () => getRecentSales(limit) });
}

export function useDashboardReport() {
  return useQuery({
    queryKey: KEYS.report,
    queryFn: getDashboardReport,
    refetchInterval: 1000 * 60,
  });
}

export function useSettings() {
  return useQuery({ queryKey: KEYS.settings, queryFn: getSettings });
}

export function useProfile() {
  return useQuery({ queryKey: KEYS.profile, queryFn: getProfile });
}

/** Datos del negocio + ajustes de impresión (encabezado del ticket). */
export function useTicketBusiness() {
  return useQuery({ queryKey: KEYS.ticketBusiness, queryFn: getTicketBusiness });
}

function useInvalidateSettings() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: KEYS.settings });
    qc.invalidateQueries({ queryKey: KEYS.profile });
    qc.invalidateQueries({ queryKey: KEYS.ticketBusiness });
  };
}

export function useSaveSettings() {
  const invalidate = useInvalidateSettings();
  return useMutation({
    mutationFn: (patch: Partial<AppSettings>) => saveSettings(patch),
    onSuccess: invalidate,
  });
}

export function useUpdateProfile() {
  const invalidate = useInvalidateSettings();
  return useMutation({
    mutationFn: (patch: ProfilePatch) => updateProfile(patch),
    onSuccess: invalidate,
  });
}

/** Ventas (con detalle) de un rango [from, to) para la pantalla de reportes. */
export function useSalesRange(from: number | null, to: number | null) {
  return useQuery({
    queryKey: [...KEYS.reports, from, to],
    queryFn: () => getSalesBetween(from as number, to as number),
    enabled: from !== null && to !== null,
  });
}
