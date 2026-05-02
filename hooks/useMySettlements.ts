'use client';

import useSWR from 'swr';
import { createClient } from '@/lib/supabase-client';
import { useSalesmanStore } from '@/store/useSalesmanStore';

export interface SettlementRow {
  id: string;
  salesman_id: string;
  settlement_period: string; // 'YYYY-MM'
  gross_revenue: number;
  commission_rate_applied: number;
  commission_amount: number;
  status: 'pending' | 'calculated' | 'paid';
  paid_at: string | null;
  paid_amount: number | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export function useMySettlements() {
  const { user } = useSalesmanStore();
  const salesmanId = user?.salesman_profile_id;

  const { data, error, isLoading, mutate } = useSWR<SettlementRow[]>(
    salesmanId ? `settlements/${salesmanId}` : null,
    async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('salesman_monthly_settlements')
        .select('*')
        .eq('salesman_id', salesmanId!)
        .order('settlement_period', { ascending: false });
      if (error) throw error;
      return (data ?? []) as SettlementRow[];
    }
  );

  return {
    settlements: data ?? [],
    isLoading,
    error: (error as Error) ?? null,
    mutate,
  };
}
