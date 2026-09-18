'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addProduct,
  archiveProduct,
  updateProduct,
  type ProductPatch,
  getActiveProducts,
  getCategories,
  getTodayMetrics,
  registerWaste,
  restockProduct,
  sellProduct,
  type NewProductInput,
} from '@/lib/db/repository';
import { checkoutSale, voidSale, type CheckoutInput } from '@/lib/db/sales';
import type { WasteReason } from '@/types';

import { KEYS } from '@/hooks/queryKeys';

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

export function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: KEYS.products });
    qc.invalidateQueries({ queryKey: KEYS.metrics });
    qc.invalidateQueries({ queryKey: KEYS.sales });
    qc.invalidateQueries({ queryKey: KEYS.report });
    qc.invalidateQueries({ queryKey: KEYS.credit });
    qc.invalidateQueries({ queryKey: KEYS.customers });
    qc.invalidateQueries({ queryKey: KEYS.reports });
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

export function useVoidSale() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { saleId: string; reason: string }) => voidSale(v.saleId, v.reason),
    onSuccess: invalidate,
  });
}

export function useUpdateProduct() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { productId: string; patch: ProductPatch }) => updateProduct(v.productId, v.patch),
    onSuccess: invalidate,
  });
}

export function useArchiveProduct() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (productId: string) => archiveProduct(productId),
    onSuccess: invalidate,
  });
}

export function useCheckout() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: CheckoutInput) => checkoutSale(input),
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
