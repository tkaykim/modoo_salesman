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
  keywords: string[] | null;
  product_code: string | null;
  manufacturer_id: string | null;
  manufacturer_name: string | null; // joined from manufacturers
}

interface ProductRowRaw {
  id: string;
  title: string;
  base_price: number;
  category: string | null;
  thumbnail_image_link: string[] | null;
  size_options: ProductSizeOption[] | null;
  is_active: boolean | null;
  keywords: string[] | null;
  product_code: string | null;
  manufacturer_id: string | null;
  manufacturer: { name: string | null } | null;
}

export function useProducts() {
  const { data, error, isLoading } = useSWR<ProductRow[]>(
    'products/active',
    async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('products')
        .select(
          'id, title, base_price, category, thumbnail_image_link, size_options, is_active, keywords, product_code, manufacturer_id, manufacturer:manufacturers(name)'
        )
        .eq('is_active', true)
        .order('title');
      if (error) throw error;
      return ((data ?? []) as unknown as ProductRowRaw[]).map((p) => ({
        id: p.id,
        title: p.title,
        base_price: p.base_price,
        category: p.category,
        thumbnail_image_link: p.thumbnail_image_link,
        size_options: p.size_options,
        is_active: p.is_active,
        keywords: p.keywords,
        product_code: p.product_code,
        manufacturer_id: p.manufacturer_id,
        manufacturer_name: p.manufacturer?.name ?? null,
      }));
    }
  );

  return {
    products: data ?? [],
    isLoading,
    error: (error as Error) ?? null,
  };
}

/**
 * 다중 필드 검색 — 제품명 + 제조사명 + 제품코드 + keywords 배열
 */
export function matchProduct(product: ProductRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (product.title?.toLowerCase().includes(q)) return true;
  if (product.product_code?.toLowerCase().includes(q)) return true;
  if (product.manufacturer_name?.toLowerCase().includes(q)) return true;
  if (product.category?.toLowerCase().includes(q)) return true;
  if (Array.isArray(product.keywords) && product.keywords.some((k) => k?.toLowerCase().includes(q))) return true;
  return false;
}
