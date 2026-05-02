'use client';

import useSWR from 'swr';
import { createClient } from '@/lib/supabase-client';
import { useSalesmanStore } from '@/store/useSalesmanStore';

export interface GradeChangeRow {
  id: string;
  salesman_id: string;
  prev_level: string | null;
  new_level: string;
  changed_at: string;
  reason: string | null;
}

export function useMyGradeHistory() {
  const { user } = useSalesmanStore();
  const salesmanId = user?.salesman_profile_id;

  const { data, error, isLoading } = useSWR<GradeChangeRow[]>(
    salesmanId ? `grade_changes/${salesmanId}` : null,
    async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('salesman_grade_changes')
        .select('*')
        .eq('salesman_id', salesmanId!)
        .order('changed_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as GradeChangeRow[];
    }
  );

  return {
    history: data ?? [],
    isLoading,
    error: (error as Error) ?? null,
  };
}
