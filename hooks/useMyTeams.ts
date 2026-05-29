'use client';

import useSWR, { type KeyedMutator } from 'swr';
import { createClient } from '@/lib/supabase-client';
import { mapPartnerMallToTeam, type OrderAggregate, type PartnerMallRow, type Team } from '@/lib/teams';

interface UseMyTeamsResult {
  teams: Team[];
  isLoading: boolean;
  error: Error | null;
  mutate: KeyedMutator<{ malls: PartnerMallRow[]; aggregates: Record<string, OrderAggregate> }>;
}

interface OrderRow {
  id: string;
  partner_mall_id: string | null;
  total_amount: number | null;
  created_at: string;
  payment_status: string | null;
  order_status: string | null;
}

const PAID_STATUSES = new Set(['completed', 'paid']);

// 결제 완료分만 집계해 단체별 OrderAggregate(주문수·매출·최근주문·이력)를 만든다.
// 이력 날짜로 평균 발주주기를 산출하므로 재주문 타이밍/상태가 살아난다.
function buildAggregates(orders: OrderRow[]): Record<string, OrderAggregate> {
  const byMall = new Map<string, OrderRow[]>();
  for (const o of orders) {
    if (!o.partner_mall_id) continue;
    if (!PAID_STATUSES.has(o.payment_status ?? '')) continue;
    if (o.order_status === 'cancelled') continue;
    const arr = byMall.get(o.partner_mall_id) ?? [];
    arr.push(o);
    byMall.set(o.partner_mall_id, arr);
  }

  const result: Record<string, OrderAggregate> = {};
  for (const [mallId, rows] of byMall) {
    const sorted = [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));
    const totalRevenue = sorted.reduce((s, o) => s + (Number(o.total_amount) || 0), 0);
    const last = sorted[0];
    result[mallId] = {
      totalOrders: sorted.length,
      totalRevenue,
      lastOrderAt: last?.created_at ?? null,
      lastOrderAmount: Number(last?.total_amount) || 0,
      history: sorted.map((o) => ({
        date: o.created_at,
        amount: Number(o.total_amount) || 0,
        item: '',
      })),
    };
  }
  return result;
}

export function useMyTeams(): UseMyTeamsResult {
  const { data, error, isLoading, mutate } = useSWR<{
    malls: PartnerMallRow[];
    aggregates: Record<string, OrderAggregate>;
  }>(
    'partner_malls/mine',
    async () => {
      const supabase = createClient();
      // 세션 사용자 → salesman_profile_id 해석 (RLS와 동일 범위)
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) return { malls: [], aggregates: {} };
      const { data: profile } = await supabase
        .from('salesman_profiles')
        .select('id')
        .eq('user_id', auth.user.id)
        .maybeSingle();
      const salesmanId = profile?.id as string | undefined;
      if (!salesmanId) return { malls: [], aggregates: {} };

      const { data: malls, error: mallErr } = await supabase
        .from('partner_malls')
        .select('id, name, slug, share_token, logo_url, is_active, created_at, salesman_id, team_meta')
        .eq('salesman_id', salesmanId)
        .order('created_at', { ascending: false });
      if (mallErr) throw mallErr;

      const mallRows = (malls ?? []) as PartnerMallRow[];
      const mallIds = mallRows.map((m) => m.id);

      let aggregates: Record<string, OrderAggregate> = {};
      if (mallIds.length > 0) {
        const { data: orders, error: ordErr } = await supabase
          .from('orders')
          .select('id, partner_mall_id, total_amount, created_at, payment_status, order_status')
          .in('partner_mall_id', mallIds)
          .order('created_at', { ascending: false })
          .limit(1000);
        if (ordErr) throw ordErr;
        aggregates = buildAggregates((orders ?? []) as OrderRow[]);
      }

      return { malls: mallRows, aggregates };
    },
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    }
  );

  const teams: Team[] = (data?.malls ?? []).map((row) =>
    mapPartnerMallToTeam(row, data?.aggregates[row.id]),
  );

  return {
    teams,
    isLoading,
    error: (error as Error) ?? null,
    mutate,
  };
}
