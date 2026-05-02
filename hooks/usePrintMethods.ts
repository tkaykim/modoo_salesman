'use client';

import { useMemo } from 'react';
import useSWR from 'swr';
import { createClient } from '@/lib/supabase-client';
import { buildPrintPricingFromDb, type PrintMethodRecord, type PrintPricingConfig } from '@/lib/pricing';

export function usePrintMethods() {
  const { data, error, isLoading } = useSWR<PrintMethodRecord[]>(
    'print_methods/active',
    async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('print_methods')
        .select('id, key, name, description, image_url, sort_order, is_active, pricing')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as PrintMethodRecord[];
    }
  );

  const config: PrintPricingConfig = useMemo(() => buildPrintPricingFromDb(data ?? []), [data]);

  return {
    methods: data ?? [],
    config,
    isLoading,
    error: (error as Error) ?? null,
  };
}
