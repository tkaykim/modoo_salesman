'use client';

import useSWR from 'swr';
import { createClient } from '@/lib/supabase-client';

export interface TeamProductRow {
  id: string;
  partner_mall_id: string;
  product_id: string;
  display_name: string | null;
  color_hex: string | null;
  color_name: string | null;
  preview_url: string | null;
  price: number | null;
  created_at: string | null;
  product?: {
    id: string;
    title: string;
    base_price: number | null;
    thumbnail_image_link: string[] | null;
  } | null;
}

export function useTeamProducts(teamId: string | null | undefined) {
  const { data, error, isLoading, mutate } = useSWR<TeamProductRow[]>(
    teamId ? `team_products/${teamId}` : null,
    async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('partner_mall_products')
        .select(`
          id, partner_mall_id, product_id,
          display_name, color_hex, color_name,
          preview_url, price, created_at,
          product:products ( id, title, base_price, thumbnail_image_link )
        `)
        .eq('partner_mall_id', teamId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as TeamProductRow[];
    },
  );

  return {
    products: data ?? [],
    isLoading,
    error: (error as Error) ?? null,
    mutate,
  };
}
