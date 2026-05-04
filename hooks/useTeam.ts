'use client';

import useSWR, { type KeyedMutator } from 'swr';
import { createClient } from '@/lib/supabase-client';
import { mapPartnerMallToTeam, type PartnerMallRow, type Team } from '@/lib/teams';

// 단일 단체 (실시간 fetch)
export function useTeam(teamId: string | null | undefined): {
  team: Team | null;
  isLoading: boolean;
  error: Error | null;
  mutate: KeyedMutator<PartnerMallRow | null>;
} {
  const { data, error, isLoading, mutate } = useSWR<PartnerMallRow | null>(
    teamId ? `partner_malls/${teamId}` : null,
    async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('partner_malls')
        .select('id, name, slug, share_token, logo_url, is_active, created_at, salesman_id, team_meta')
        .eq('id', teamId!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as PartnerMallRow | null;
    }
  );

  return {
    team: data ? mapPartnerMallToTeam(data) : null,
    isLoading,
    error: (error as Error) ?? null,
    mutate,
  };
}
