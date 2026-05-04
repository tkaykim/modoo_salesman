'use client';

import useSWR, { type KeyedMutator } from 'swr';
import { createClient } from '@/lib/supabase-client';
import { useSalesmanStore } from '@/store/useSalesmanStore';
import { mapPartnerMallToTeam, type PartnerMallRow, type Team } from '@/lib/teams';

interface UseMyTeamsResult {
  teams: Team[];
  isLoading: boolean;
  error: Error | null;
  mutate: KeyedMutator<PartnerMallRow[]>;
}

// 명시적으로 salesman_id == 본인 salesman_profile_id 인 단체만 가져온다.
// RLS만 의존하면 super_admin 겸직 사용자가 모든 mall을 받거나(원치 않음),
// 세션이 미복원 상태에서 anon 권한으로 떨어져 의도와 다른 결과가 나올 수 있어
// 클라이언트 측에서 한 번 더 필터링한다.
export function useMyTeams(): UseMyTeamsResult {
  const { user } = useSalesmanStore();
  const salesmanId = user?.salesman_profile_id ?? null;

  const { data, error, isLoading, mutate } = useSWR<PartnerMallRow[]>(
    salesmanId ? `partner_malls/mine/${salesmanId}` : null,
    async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('partner_malls')
        .select('id, name, slug, share_token, logo_url, is_active, created_at, salesman_id, team_meta')
        .eq('salesman_id', salesmanId!)
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
