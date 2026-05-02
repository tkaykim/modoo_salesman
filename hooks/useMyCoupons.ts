'use client';

import useSWR from 'swr';
import { createClient } from '@/lib/supabase-client';
import type { CouponLite } from '@/lib/pricing';

export interface SalesmanCouponRow extends CouponLite {
  display_name: string | null;
  description: string | null;
  current_uses: number | null;
  expires_at: string | null;
  salesman_profile_id: string | null;
}

// 본인 영업사원 쿠폰 (RLS로 자동 필터)
export function useMyCoupons() {
  const { data, error, isLoading, mutate } = useSWR<SalesmanCouponRow[]>(
    'coupons/mine',
    async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('coupons')
        .select('id, code, display_name, description, discount_type, discount_value, min_order_amount, max_discount_amount, current_uses, is_active, expires_at, salesman_profile_id')
        .not('salesman_profile_id', 'is', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as SalesmanCouponRow[];
    }
  );

  return {
    coupons: data ?? [],
    primary: (data ?? []).find((c) => c.is_active) ?? null,
    isLoading,
    error: (error as Error) ?? null,
    mutate,
  };
}
