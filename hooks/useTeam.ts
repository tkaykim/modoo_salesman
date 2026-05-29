'use client';

import useSWR, { type KeyedMutator } from 'swr';
import { createClient } from '@/lib/supabase-client';
import { mapPartnerMallToTeam, type OrderAggregate, type PartnerMallRow, type Team } from '@/lib/teams';

const PAID_STATUSES = ['completed', 'paid'];

async function fetchTeamWithAgg(teamId: string): Promise<{
  mall: PartnerMallRow;
  agg: OrderAggregate;
} | null> {
  const supabase = createClient();
  const [{ data: mall, error: mallErr }, { data: orders, error: ordErr }] = await Promise.all([
    supabase
      .from('partner_malls')
      .select('id, name, slug, share_token, logo_url, is_active, created_at, salesman_id, team_meta')
      .eq('id', teamId)
      .maybeSingle(),
    supabase
      .from('orders')
      .select('id, total_amount, created_at, payment_status, order_status')
      .eq('partner_mall_id', teamId)
      .in('payment_status', PAID_STATUSES)
      .neq('order_status', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(200),
  ]);

  if (mallErr) throw mallErr;
  if (ordErr) throw ordErr;
  if (!mall) return null;

  const rows = (orders ?? []) as Array<{
    id: string;
    total_amount: number | null;
    created_at: string;
    payment_status: string;
    order_status: string;
  }>;

  const agg: OrderAggregate = {
    totalOrders: rows.length,
    totalRevenue: rows.reduce((s, o) => s + (Number(o.total_amount) || 0), 0),
    lastOrderAt: rows[0]?.created_at ?? null,
    lastOrderAmount: Number(rows[0]?.total_amount) || 0,
    history: rows.map((o) => ({
      date: o.created_at,
      amount: Number(o.total_amount) || 0,
      item: '',
    })),
  };

  return { mall: mall as PartnerMallRow, agg };
}

export function useTeam(teamId: string | null | undefined): {
  team: Team | null;
  isLoading: boolean;
  error: Error | null;
  mutate: KeyedMutator<{ mall: PartnerMallRow; agg: OrderAggregate } | null>;
} {
  const { data, error, isLoading, mutate } = useSWR<{
    mall: PartnerMallRow;
    agg: OrderAggregate;
  } | null>(
    teamId ? `partner_malls/${teamId}/detail` : null,
    () => fetchTeamWithAgg(teamId!),
  );

  return {
    team: data ? mapPartnerMallToTeam(data.mall, data.agg) : null,
    isLoading,
    error: (error as Error) ?? null,
    mutate,
  };
}
