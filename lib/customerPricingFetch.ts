import { createClient } from '@/lib/supabase-client';
import type { CustomerPricingRow } from '@/lib/customerPricingMatcher';

const TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  fetchedAt: number;
  byPrintMethodId: Map<string, CustomerPricingRow[]>;
  byPrintMethodKey: Map<string, CustomerPricingRow[]>;
}

let cache: CacheEntry | null = null;
let inflight: Promise<CacheEntry> | null = null;

function emptyEntry(): CacheEntry {
  return {
    fetchedAt: Date.now(),
    byPrintMethodId: new Map(),
    byPrintMethodKey: new Map(),
  };
}

async function fetchAll(): Promise<CacheEntry> {
  try {
    const supabase = createClient();
    const [pricingRes, methodsRes] = await Promise.all([
      supabase
        .from('customer_print_method_pricing')
        .select('id, print_method_id, size, max_width_cm, max_height_cm, pricing_model, unit_price, base_price, base_quantity, additional_price_per_piece, is_active')
        .eq('is_active', true),
      supabase
        .from('print_methods')
        .select('id, key'),
    ]);

    if (pricingRes.error) {
      console.warn('[customerPricing] pricing fetch failed, falling back to legacy', pricingRes.error);
      return emptyEntry();
    }

    const keyById = new Map<string, string>();
    if (!methodsRes.error) {
      for (const method of methodsRes.data ?? []) {
        if (method.id && method.key) keyById.set(method.id as string, method.key as string);
      }
    } else {
      console.warn('[customerPricing] print_methods fetch failed; byKey unavailable', methodsRes.error);
    }

    const byPrintMethodId = new Map<string, CustomerPricingRow[]>();
    const byPrintMethodKey = new Map<string, CustomerPricingRow[]>();
    for (const row of pricingRes.data ?? []) {
      const typed: CustomerPricingRow = {
        id: row.id as string,
        print_method_id: row.print_method_id as string,
        size: row.size as string,
        max_width_cm: row.max_width_cm !== null ? Number(row.max_width_cm) : null,
        max_height_cm: row.max_height_cm !== null ? Number(row.max_height_cm) : null,
        pricing_model: row.pricing_model as 'flat' | 'bulk',
        unit_price: row.unit_price !== null ? Number(row.unit_price) : null,
        base_price: row.base_price !== null ? Number(row.base_price) : null,
        base_quantity: row.base_quantity !== null ? Number(row.base_quantity) : null,
        additional_price_per_piece: row.additional_price_per_piece !== null ? Number(row.additional_price_per_piece) : null,
        is_active: row.is_active as boolean,
      };

      const byId = byPrintMethodId.get(typed.print_method_id) ?? [];
      byId.push(typed);
      byPrintMethodId.set(typed.print_method_id, byId);

      const key = keyById.get(typed.print_method_id);
      if (key) {
        const byKey = byPrintMethodKey.get(key) ?? [];
        byKey.push(typed);
        byPrintMethodKey.set(key, byKey);
      }
    }

    return { fetchedAt: Date.now(), byPrintMethodId, byPrintMethodKey };
  } catch (error) {
    console.warn('[customerPricing] fetch threw, falling back to legacy', error);
    return emptyEntry();
  }
}

async function getEntry(): Promise<CacheEntry> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < TTL_MS) return cache;
  if (inflight) return inflight;

  inflight = fetchAll();
  try {
    cache = await inflight;
    return cache;
  } finally {
    inflight = null;
  }
}

export async function getCustomerPricingForPrintMethodId(
  printMethodId: string,
): Promise<CustomerPricingRow[]> {
  if (!printMethodId) return [];
  const entry = await getEntry();
  return entry.byPrintMethodId.get(printMethodId) ?? [];
}

export async function getCustomerPricingForPrintMethodKey(
  key: string,
): Promise<CustomerPricingRow[]> {
  if (!key) return [];
  const entry = await getEntry();
  return entry.byPrintMethodKey.get(key) ?? [];
}

export function invalidateCustomerPricingCache(): void {
  cache = null;
}
