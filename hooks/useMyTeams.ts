'use client';

import useSWR, { type KeyedMutator } from 'swr';
import { createClient } from '@/lib/supabase-client';
import { mapPartnerMallToTeam, type PartnerMallRow, type Team } from '@/lib/teams';

interface UseMyTeamsResult {
  teams: Team[];
  isLoading: boolean;
  error: Error | null;
  mutate: KeyedMutator<PartnerMallRow[]>;
}

// RLS가 owner_salesman_id 기반으로 자동 필터 → 본인 mall만 옴
export function useMyTeams(): UseMyTeamsResult {
  const { data, error, isLoading, mutate } = useSWR<PartnerMallRow[]>(
    'partner_malls/mine',
    async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('partner_malls')
        .select('id, name, slug, share_token, logo_url, is_active, created_at, owner_salesman_id, team_meta')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as PartnerMallRow[];
    },
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    }
  );

  const teams: Team[] = (data ?? []).map((row) => mapPartnerMallToTeam(row));

  return {
    teams,
    isLoading,
    error: (error as Error) ?? null,
    mutate,
  };
}
