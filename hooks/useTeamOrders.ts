'use client';

import useSWR from 'swr';
import { createClient } from '@/lib/supabase-client';

export interface TeamOrderRow {
  id: string;
  total_amount: number | null;
  original_amount: number | null;
  coupon_discount: number | null;
  payment_status: string | null;
  order_status: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  shipping_method: string | null;
  attributed_salesman_id: string | null;
  applied_coupon_id: string | null;
  notes: string | null;
  created_at: string;
}

// 단체에 묶인 주문 이력 (RLS: 본인 mall 의 orders 조회 가능)
export function useTeamOrders(teamId: string | null | undefined) {
  const { data, error, isLoading, mutate } = useSWR<TeamOrderRow[]>(
    teamId ? `team_orders/${teamId}` : null,
    async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('orders')
        .select(
          'id, total_amount, original_amount, coupon_discount, payment_status, order_status, customer_name, customer_phone, shipping_method, attributed_salesman_id, applied_coupon_id, notes, created_at'
        )
        .eq('partner_mall_id', teamId!)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as TeamOrderRow[];
    }
  );

  const orders = data ?? [];
  const totalRevenue = orders.reduce((s, o) => s + (Number(o.total_amount) || 0), 0);
  const lastOrder = orders[0] ?? null;

  return {
    orders,
    totalRevenue,
    totalCount: orders.length,
    lastOrder,
    isLoading,
    error: (error as Error) ?? null,
    mutate,
  };
}
