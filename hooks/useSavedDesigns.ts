'use client';

import useSWR from 'swr';
import { createClient } from '@/lib/supabase-client';

export interface SavedDesignRow {
  id: string;
  product_id: string | null;
  user_id: string | null;
  title: string | null;
  preview_url: string | null;
  price_per_item: number | null;
  created_at: string;
  updated_at: string;
}

export function useSavedDesigns(opts: { search?: string; page?: number; limit?: number } = {}) {
  const { search = '', page = 1, limit = 20 } = opts;
  const key = `saved_designs/p${page}/l${limit}/q${search}`;

  const { data, error, isLoading, mutate } = useSWR<{ rows: SavedDesignRow[]; total: number }>(
    key,
    async () => {
      const supabase = createClient();
      const offset = (page - 1) * limit;
      let q = supabase
        .from('saved_designs')
        .select('id, product_id, user_id, title, preview_url, price_per_item, created_at, updated_at', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
      if (search.trim()) {
        q = q.ilike('title', `%${search.trim()}%`);
      }
      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as SavedDesignRow[], total: count ?? 0 };
    }
  );

  return {
    designs: data?.rows ?? [],
    total: data?.total ?? 0,
    totalPages: Math.max(1, Math.ceil((data?.total ?? 0) / limit)),
    isLoading,
    error: (error as Error) ?? null,
    mutate,
  };
}
