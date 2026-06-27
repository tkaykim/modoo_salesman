/**
 * Customer pricing matcher.
 *
 * Keep this logic in parity with modoo_app/lib/customerPricingMatcher.ts.
 * The canonical customer unit price comes from customer_print_method_pricing.
 */

export type CustomerPricingModel = 'flat' | 'bulk';

export interface CustomerPricingRow {
  id: string;
  print_method_id: string;
  size: string;
  max_width_cm: number | null;
  max_height_cm: number | null;
  pricing_model: CustomerPricingModel;
  unit_price: number | null;
  base_price: number | null;
  base_quantity: number | null;
  additional_price_per_piece: number | null;
  is_active: boolean;
}

export function matchCustomerPricingByDimensions<T extends Pick<
  CustomerPricingRow,
  'max_width_cm' | 'max_height_cm' | 'is_active'
>>(
  rows: T[],
  artworkWidthCm: number,
  artworkHeightCm: number,
): T | null {
  if (!Number.isFinite(artworkWidthCm) || artworkWidthCm <= 0) return null;
  if (!Number.isFinite(artworkHeightCm) || artworkHeightCm <= 0) return null;

  const artShort = Math.min(artworkWidthCm, artworkHeightCm);
  const artLong = Math.max(artworkWidthCm, artworkHeightCm);

  const candidates = rows
    .filter((r) => r.is_active !== false)
    .filter((r) => r.max_width_cm !== null && r.max_height_cm !== null)
    .filter((r) => {
      const w = r.max_width_cm as number;
      const h = r.max_height_cm as number;
      const rowShort = Math.min(w, h);
      const rowLong = Math.max(w, h);
      return artShort <= rowShort && artLong <= rowLong;
    });

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const areaA = (a.max_width_cm ?? 0) * (a.max_height_cm ?? 0);
    const areaB = (b.max_width_cm ?? 0) * (b.max_height_cm ?? 0);
    if (areaA !== areaB) return areaA - areaB;
    const longA = Math.max(a.max_width_cm ?? 0, a.max_height_cm ?? 0);
    const longB = Math.max(b.max_width_cm ?? 0, b.max_height_cm ?? 0);
    return longA - longB;
  });

  return candidates[0];
}

export function calculatePricingAmount(
  row: Pick<
    CustomerPricingRow,
    'pricing_model' | 'unit_price' | 'base_price' | 'base_quantity' | 'additional_price_per_piece'
  >,
  quantity: number,
): number | null {
  if (!Number.isFinite(quantity) || quantity <= 0) return null;

  if (row.pricing_model === 'flat') {
    if (row.unit_price === null || row.unit_price === undefined) return null;
    return Math.round(row.unit_price * quantity);
  }

  if (row.pricing_model === 'bulk') {
    if (
      row.base_price === null || row.base_price === undefined ||
      row.base_quantity === null || row.base_quantity === undefined ||
      row.additional_price_per_piece === null || row.additional_price_per_piece === undefined
    ) {
      return null;
    }
    const extra = Math.max(0, quantity - row.base_quantity);
    return Math.round(row.base_price + extra * row.additional_price_per_piece);
  }

  return null;
}

export function pickUnitPriceForArtwork(
  rows: CustomerPricingRow[],
  artworkWidthCm: number,
  artworkHeightCm: number,
): { unitPrice: number; matchedRowId: string; matchType: 'exact' | 'a3_fallback' } | null {
  const matched = matchCustomerPricingByDimensions(rows, artworkWidthCm, artworkHeightCm);
  if (matched && matched.pricing_model === 'flat' && matched.unit_price !== null) {
    return {
      unitPrice: Math.round(matched.unit_price),
      matchedRowId: matched.id,
      matchType: 'exact',
    };
  }

  const a3ByLabel = rows.find(
    (r) => r.is_active !== false && r.size === 'A3' && r.pricing_model === 'flat' && r.unit_price !== null,
  );
  if (a3ByLabel && a3ByLabel.unit_price !== null) {
    return {
      unitPrice: Math.round(a3ByLabel.unit_price),
      matchedRowId: a3ByLabel.id,
      matchType: 'a3_fallback',
    };
  }

  const biggestFlat = rows
    .filter((r) => r.is_active !== false && r.pricing_model === 'flat' && r.unit_price !== null)
    .filter((r) => r.max_width_cm !== null && r.max_height_cm !== null)
    .sort((a, b) => (b.max_width_cm! * b.max_height_cm!) - (a.max_width_cm! * a.max_height_cm!))[0];

  if (biggestFlat && biggestFlat.unit_price !== null) {
    return {
      unitPrice: Math.round(biggestFlat.unit_price),
      matchedRowId: biggestFlat.id,
      matchType: 'a3_fallback',
    };
  }

  return null;
}
