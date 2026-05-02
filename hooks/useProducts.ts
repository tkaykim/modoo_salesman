'use client';

import useSWR from 'swr';
import { createClient } from '@/lib/supabase-client';

export interface ProductSizeOption {
  label: string;
  size_code: string;
}

export interface ProductRow {
  id: string;
  title: string;
  base_price: number;
  category: string | null;
  thumbnail_image_link: string[] | null;
  size_options: ProductSizeOption[] | null;
  is_active: boolean | null;
}

export function useProducts() {
  const { data, error, isLoading } = useSWR<ProductRow[]>(
    'products/active',
    async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('products')
        .select('id, title, base_price, category, thumbnail_image_link, size_options, is_active')
        .eq('is_active', true)
        .order('title');
      if (error) throw error;
      return (data ?? []) as ProductRow[];
    }
  );

  return {
    products: data ?? [],
    isLoading,
    error: (error as Error) ?? null,
  };
}
