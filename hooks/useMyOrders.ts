'use client';

import useSWR from 'swr';
import { createClient } from '@/lib/supabase-client';
import { useSalesmanStore } from '@/store/useSalesmanStore';

export interface MyOrderRow {
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
  partner_mall_id: string | null;
  applied_coupon_id: string | null;
  notes: string | null;
  created_at: string;
  partner_mall?: { name: string | null } | null;
}

// 본인 attributed orders + 본인 owner mall 의 orders 합집합 (RLS 통과)
export function useMyOrders() {
  const { user } = useSalesmanStore();
  const salesmanId = user?.salesman_profile_id;

  const { data, error, isLoading, mutate } = useSWR<MyOrderRow[]>(
    salesmanId ? `my_orders/${salesmanId}` : null,
    async () => {
      const supabase = createClient();
      // RLS 자동 필터: attributed_salesman_id 매칭 + owner mall 매칭 모두 SELECT 가능
      // 단, OR 조건 명시적으로 — Supabase는 RLS는 union 으로 동작하므로 그냥 fetch all 한 뒤 클라 필터
      // 더 좋은 방법: 두 쿼리 합치기
      const [r1, r2] = await Promise.all([
        supabase
          .from('orders')
          .select(
            'id, total_amount, original_amount, coupon_discount, payment_status, order_status, customer_name, customer_phone, shipping_method, attributed_salesman_id, partner_mall_id, applied_coupon_id, notes, created_at, partner_mall:partner_malls(name)'
          )
          .eq('attributed_salesman_id', salesmanId!)
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('orders')
          .select(
            'id, total_amount, original_amount, coupon_discount, payment_status, order_status, customer_name, customer_phone, shipping_method, attributed_salesman_id, partner_mall_id, applied_coupon_id, notes, created_at, partner_mall:partner_malls!inner(name, owner_salesman_id)'
          )
          .eq('partner_mall.owner_salesman_id', salesmanId!)
          .order('created_at', { ascending: false })
          .limit(100),
      ]);
      if (r1.error) throw r1.error;
      if (r2.error) throw r2.error;
      const merged = new Map<string, MyOrderRow>();
      for (const o of (r1.data ?? []) as unknown as MyOrderRow[]) merged.set(o.id, o);
      for (const o of (r2.data ?? []) as unknown as MyOrderRow[]) {
        if (!merged.has(o.id)) merged.set(o.id, o);
      }
      return Array.from(merged.values()).sort((a, b) => b.created_at.localeCompare(a.created_at));
    }
  );

  return {
    orders: data ?? [],
    isLoading,
    error: (error as Error) ?? null,
    mutate,
  };
}
