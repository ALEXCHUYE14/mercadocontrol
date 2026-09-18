'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KEYS } from '@/hooks/queryKeys';
import { addCustomer, getCreditOverview, getCustomers, registerCreditPayment } from '@/lib/db/customers';

export function useCreditOverview() {
  return useQuery({ queryKey: KEYS.credit, queryFn: getCreditOverview });
}

export function useCustomers() {
  return useQuery({ queryKey: KEYS.customers, queryFn: getCustomers });
}

function useInvalidateCredit() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: KEYS.credit });
    qc.invalidateQueries({ queryKey: KEYS.customers });
  };
}

export function useAddCustomer() {
  const invalidate = useInvalidateCredit();
  return useMutation({
    mutationFn: (v: { name: string; phone?: string | null }) => addCustomer(v),
    onSuccess: invalidate,
  });
}

export function useCreditPayment() {
  const invalidate = useInvalidateCredit();
  return useMutation({
    mutationFn: registerCreditPayment,
    onSuccess: invalidate,
  });
}
