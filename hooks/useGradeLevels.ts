'use client';

import useSWR from 'swr';
import { createClient } from '@/lib/supabase-client';
import { ALL_GRADES, GRADES, type GradeLevel } from '@/lib/grades';

export interface GradeLevelRow {
  level: GradeLevel;
  label: string;
  commission_rate: number;
  monthly_revenue_threshold: number;
  display_order: number;
}

const FALLBACK: GradeLevelRow[] = ALL_GRADES.map((g) => ({
  level: g.level,
  label: g.label,
  commission_rate: g.commissionRate,
  monthly_revenue_threshold: g.monthlyThreshold,
  display_order: g.displayOrder,
}));

// salesman_grade_levels는 모든 사용자에게 동일 — 캐시 길게
export function useGradeLevels() {
  const { data, error, isLoading } = useSWR<GradeLevelRow[]>(
    'salesman_grade_levels',
    async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('salesman_grade_levels')
        .select('level, label, commission_rate, monthly_revenue_threshold, display_order')
        .order('display_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as GradeLevelRow[];
    },
    {
      revalidateOnFocus: false,
      revalidateIfStale: false,
      dedupingInterval: 60_000 * 30,
    }
  );

  const levels = (data && data.length > 0 ? data : FALLBACK).map((row) => ({
    ...row,
    commission_rate: Number(row.commission_rate),
    monthly_revenue_threshold: Number(row.monthly_revenue_threshold),
  }));

  const findByLevel = (level: string): GradeLevelRow | null => {
    return levels.find((l) => l.level === level) ?? null;
  };

  const findNext = (level: string): GradeLevelRow | null => {
    const cur = findByLevel(level);
    if (!cur) return null;
    return levels.find((l) => l.display_order === cur.display_order + 1) ?? null;
  };

  const labelFor = (level: string): string => {
    return findByLevel(level)?.label ?? GRADES[level as GradeLevel]?.label ?? level;
  };

  return {
    levels,
    isLoading,
    error: (error as Error) ?? null,
    findByLevel,
    findNext,
    labelFor,
  };
}
