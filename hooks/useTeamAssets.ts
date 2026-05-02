'use client';

import useSWR from 'swr';
import { createClient } from '@/lib/supabase-client';

export type AssetType = 'logo' | 'image' | 'document' | 'reference';

export interface TeamAssetRow {
  id: string;
  partner_mall_id: string;
  asset_type: AssetType;
  url: string;
  name: string | null;
  description: string | null;
  file_size: number | null;
  mime_type: string | null;
  uploaded_by: string | null;
  is_primary: boolean | null;
  sort_order: number | null;
  created_at: string;
}

export function useTeamAssets(teamId: string | null | undefined) {
  const { data, error, isLoading, mutate } = useSWR<TeamAssetRow[]>(
    teamId ? `team_assets/${teamId}` : null,
    async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('partner_mall_assets')
        .select('*')
        .eq('partner_mall_id', teamId!)
        .order('asset_type', { ascending: true })
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as TeamAssetRow[];
    }
  );

  const assets = data ?? [];
  return {
    assets,
    logos: assets.filter((a) => a.asset_type === 'logo'),
    images: assets.filter((a) => a.asset_type === 'image'),
    documents: assets.filter((a) => a.asset_type === 'document'),
    references: assets.filter((a) => a.asset_type === 'reference'),
    isLoading,
    error: (error as Error) ?? null,
    mutate,
  };
}
