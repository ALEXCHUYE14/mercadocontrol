'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KEYS } from '@/hooks/queryKeys';
import { addTeamMember, listTeam, removeTeamMember } from '@/lib/db/team';

export function useTeam(enabled: boolean) {
  return useQuery({ queryKey: KEYS.team, queryFn: listTeam, enabled, retry: false });
}

export function useAddTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: addTeamMember,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.team }),
  });
}

export function useRemoveTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: removeTeamMember,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.team }),
  });
}
