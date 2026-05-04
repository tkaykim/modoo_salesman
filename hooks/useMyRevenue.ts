'use client';

import useSWR from 'swr';
import { createClient } from '@/lib/supabase-client';
import { useSalesmanStore } from '@/store/useSalesmanStore';
import { getCurrentPeriod, getPreviousPeriod } from '@/lib/settlement';

export interface MonthlyRevenuePoint {
  /** 'YYYY-MM' */
  period: string;
  revenue: number;
  orderCount: number;
}

export interface MyRevenueResult {
  thisMonthRevenue: number;
  thisMonthOrderCount: number;
  prevMonthRevenue: number;
  prevMonthOrderCount: number;
  totalRevenue: number;
  totalOrderCount: number;
  monthly: MonthlyRevenuePoint[]; // descending by period
  isLoading: boolean;
  error: Error | null;
  mutate: () => void;
}

interface OrderRow {
  id: string;
  total_amount: number | null;
  created_at: string;
}

export function useMyRevenue(): MyRevenueResult {
  const { user } = useSalesmanStore();
  const salesmanId = user?.salesman_profile_id;

  const { data, error, isLoading, mutate } = useSWR<OrderRow[]>(
    salesmanId ? `orders/attributed/${salesmanId}` : null,
    async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('orders')
        .select('id, total_amount, created_at')
        .eq('salesman_id', salesmanId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as OrderRow[];
    }
  );

  const orders = data ?? [];
  const cur = getCurrentPeriod();
  const prev = getPreviousPeriod();

  let thisMonthRevenue = 0;
  let thisMonthOrderCount = 0;
  let prevMonthRevenue = 0;
  let prevMonthOrderCount = 0;
  let totalRevenue = 0;

  const monthlyMap = new Map<string, { revenue: number; count: number }>();

  for (const o of orders) {
    const amt = Number(o.total_amount) || 0;
    totalRevenue += amt;
    const d = new Date(o.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const cur1 = monthlyMap.get(key) ?? { revenue: 0, count: 0 };
    cur1.revenue += amt;
    cur1.count += 1;
    monthlyMap.set(key, cur1);

    if (key === cur.key) {
      thisMonthRevenue += amt;
      thisMonthOrderCount += 1;
    } else if (key === prev.key) {
      prevMonthRevenue += amt;
      prevMonthOrderCount += 1;
    }
  }

  const monthly: MonthlyRevenuePoint[] = Array.from(monthlyMap.entries())
    .map(([period, v]) => ({ period, revenue: v.revenue, orderCount: v.count }))
    .sort((a, b) => b.period.localeCompare(a.period));

  return {
    thisMonthRevenue,
    thisMonthOrderCount,
    prevMonthRevenue,
    prevMonthOrderCount,
    totalRevenue,
    totalOrderCount: orders.length,
    monthly,
    isLoading,
    error: (error as Error) ?? null,
    mutate,
  };
}
