import { DEFAULT_PRINT_PRICING, type PrintSize } from '@/lib/pricing';
import { getCustomerPricingForPrintMethodKey } from '@/lib/customerPricingFetch';
import { pickUnitPriceForArtwork } from '@/lib/customerPricingMatcher';

type SerializedSide = {
  objects?: unknown[];
  totalBoundingBoxMm?: {
    widthMm?: number;
    heightMm?: number;
  } | null;
};

function parseSide(value: unknown): SerializedSide | null {
  if (!value) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as SerializedSide;
    } catch {
      return null;
    }
  }
  if (typeof value === 'object') return value as SerializedSide;
  return null;
}

function fallbackPrintSize(widthMm: number, heightMm: number): PrintSize {
  if (widthMm <= 100 && heightMm <= 100) return '10x10';
  if (widthMm <= 210 && heightMm <= 297) return 'A4';
  return 'A3';
}

async function priceOneBoundingBox(widthMm: number, heightMm: number): Promise<number> {
  if (!Number.isFinite(widthMm) || !Number.isFinite(heightMm) || widthMm <= 0 || heightMm <= 0) {
    return 0;
  }

  try {
    const rows = await getCustomerPricingForPrintMethodKey('dtf');
    const picked = pickUnitPriceForArtwork(rows, widthMm / 10, heightMm / 10);
    if (picked) return picked.unitPrice;
  } catch (error) {
    console.warn('[customerPriceFromCanvasState] customer pricing lookup failed, falling back to legacy', error);
  }

  const size = fallbackPrintSize(widthMm, heightMm);
  const dtfPricing = DEFAULT_PRINT_PRICING.dtf;
  if (dtfPricing.method !== 'dtf') return 0;
  return dtfPricing.sizes[size] ?? 0;
}

export async function calculatePrintAddonFromCanvasState(
  canvasState: Record<string, unknown> | null | undefined,
): Promise<number> {
  if (!canvasState || typeof canvasState !== 'object') return 0;

  let total = 0;
  for (const sideValue of Object.values(canvasState)) {
    const side = parseSide(sideValue);
    const box = side?.totalBoundingBoxMm;
    if (box?.widthMm && box?.heightMm) {
      total += await priceOneBoundingBox(Number(box.widthMm), Number(box.heightMm));
    }
  }

  return Math.round(total);
}

export async function calculatePricePerItemFromCanvasState(
  canvasState: Record<string, unknown> | null | undefined,
  basePrice: number,
): Promise<number> {
  const safeBase = Math.max(0, Math.round(Number(basePrice) || 0));
  const addon = await calculatePrintAddonFromCanvasState(canvasState);
  return safeBase + addon;
}
