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
  /** 결제 완료分(확정 매출) — 정산·수수료의 권위 기준 */
  thisMonthRevenue: number;
  thisMonthOrderCount: number;
  prevMonthRevenue: number;
  prevMonthOrderCount: number;
  totalRevenue: number;
  totalOrderCount: number;
  /** 미결제(pending) 대기 매출 — 결제되면 확정 매출로 전환 */
  thisMonthPendingRevenue: number;
  thisMonthPendingCount: number;
  monthly: MonthlyRevenuePoint[]; // descending by period, 확정 매출 기준
  isLoading: boolean;
  error: Error | null;
  mutate: () => void;
}

interface OrderRow {
  id: string;
  total_amount: number | null;
  created_at: string;
  payment_status: string | null;
  order_status: string | null;
}

// 결제 완료分만 확정 매출로 본다. (settlement-close 엣지 함수와 동일 기준)
const PAID_STATUSES = new Set(['completed', 'paid']);
function isPaid(o: OrderRow): boolean {
  return PAID_STATUSES.has(o.payment_status ?? '') && o.order_status !== 'cancelled';
}
function isPending(o: OrderRow): boolean {
  return o.payment_status === 'pending' && o.order_status !== 'cancelled';
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
        .select('id, total_amount, created_at, payment_status, order_status')
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
  let totalOrderCount = 0;
  let thisMonthPendingRevenue = 0;
  let thisMonthPendingCount = 0;

  const monthlyMap = new Map<string, { revenue: number; count: number }>();

  for (const o of orders) {
    const amt = Number(o.total_amount) || 0;
    const d = new Date(o.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    if (isPaid(o)) {
      totalRevenue += amt;
      totalOrderCount += 1;
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
    } else if (isPending(o) && key === cur.key) {
      thisMonthPendingRevenue += amt;
      thisMonthPendingCount += 1;
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
    totalOrderCount,
    thisMonthPendingRevenue,
    thisMonthPendingCount,
    monthly,
    isLoading,
    error: (error as Error) ?? null,
    mutate,
  };
}
