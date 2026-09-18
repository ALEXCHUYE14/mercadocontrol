'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addProduct,
  getActiveProducts,
  getCategories,
  getTodayMetrics,
  registerWaste,
  restockProduct,
  sellProduct,
  type NewProductInput,
} from '@/lib/db/repository';
import type { WasteReason } from '@/types';

const KEYS = {
  products: ['products'] as const,
  categories: ['categories'] as const,
  metrics: ['metrics', 'today'] as const,
};

export function useProducts() {
  return useQuery({
    queryKey: KEYS.products,
    queryFn: getActiveProducts,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: KEYS.categories,
    queryFn: getCategories,
    staleTime: 1000 * 60 * 60,
  });
}

export function useTodayMetrics() {
  return useQuery({
    queryKey: KEYS.metrics,
    queryFn: getTodayMetrics,
    refetchInterval: 1000 * 30,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: KEYS.products });
    qc.invalidateQueries({ queryKey: KEYS.metrics });
  };
}

export function useAddProduct() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: NewProductInput) => addProduct(input),
    onSuccess: invalidate,
  });
}

export function useRestock() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { productId: string; quantity: number; unitCost: number }) =>
      restockProduct(v.productId, v.quantity, v.unitCost),
    onSuccess: invalidate,
  });
}

export function useSell() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { productId: string; quantity: number; unitPrice?: number }) =>
      sellProduct(v.productId, v.quantity, v.unitPrice),
    onSuccess: invalidate,
  });
}

export function useRegisterWaste() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { productId: string; reason: WasteReason; quantity: number; note?: string }) =>
      registerWaste(v.productId, v.reason, v.quantity, v.note),
    onSuccess: invalidate,
  });
}
