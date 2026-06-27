import * as fabric from 'fabric';
import type { ProductSide } from '@/types/types';
import { DEFAULT_PRINT_PRICING, type PrintSize } from '@/lib/pricing';
import { getCustomerPricingForPrintMethodKey } from '@/lib/customerPricingFetch';
import { pickUnitPriceForArtwork } from '@/lib/customerPricingMatcher';

const SIZE_THRESHOLDS = {
  '10x10': { maxWidth: 100, maxHeight: 100 },
  A4: { maxWidth: 210, maxHeight: 297 },
  A3: { maxWidth: 297, maxHeight: 420 },
} as const;

export interface ObjectPricing {
  objectId: string;
  objectType: string;
  printSize: PrintSize;
  dimensionsMm: {
    width: number;
    height: number;
  };
  price: number;
}

export interface SidePricing {
  sideId: string;
  sideName: string;
  objects: ObjectPricing[];
  totalPrice: number;
  hasObjects: boolean;
}

export interface PricingSummary {
  sidePricing: SidePricing[];
  totalAdditionalPrice: number;
  totalObjectCount: number;
}

function determinePrintSize(widthMm: number, heightMm: number): PrintSize {
  if (
    widthMm <= SIZE_THRESHOLDS['10x10'].maxWidth &&
    heightMm <= SIZE_THRESHOLDS['10x10'].maxHeight
  ) {
    return '10x10';
  }
  if (
    widthMm <= SIZE_THRESHOLDS.A4.maxWidth &&
    heightMm <= SIZE_THRESHOLDS.A4.maxHeight
  ) {
    return 'A4';
  }
  return 'A3';
}

function calculateTransferFallback(printSize: PrintSize): number {
  const dtfPricing = DEFAULT_PRINT_PRICING.dtf;
  if (dtfPricing.method !== 'dtf') return 0;
  return dtfPricing.sizes[printSize] ?? 0;
}

function calculateObjectDimensionsMm(
  obj: fabric.FabricObject,
  pixelToMmRatio: number,
): { width: number; height: number } {
  const bound = obj.getBoundingRect();
  return {
    width: bound.width * pixelToMmRatio,
    height: bound.height * pixelToMmRatio,
  };
}

function calculateCombinedBoundingBox(
  objects: fabric.FabricObject[],
  pixelToMmRatio: number,
): { width: number; height: number } {
  if (objects.length === 0) return { width: 0, height: 0 };

  const bounds = objects.map((obj) => obj.getBoundingRect());
  const minLeft = Math.min(...bounds.map((b) => b.left));
  const minTop = Math.min(...bounds.map((b) => b.top));
  const maxRight = Math.max(...bounds.map((b) => b.left + b.width));
  const maxBottom = Math.max(...bounds.map((b) => b.top + b.height));

  return {
    width: (maxRight - minLeft) * pixelToMmRatio,
    height: (maxBottom - minTop) * pixelToMmRatio,
  };
}

const getUserObjects = (canvas: fabric.Canvas) =>
  canvas.getObjects().filter((obj) => {
    if (obj.excludeFromExport) return false;
    const data = (obj as { data?: { id?: string } }).data;
    if (data?.id === 'background-product-image') return false;
    return true;
  });

export async function calculateSidePricing(
  canvas: fabric.Canvas,
  side: ProductSide,
): Promise<SidePricing> {
  const userObjects = getUserObjects(canvas);
  if (userObjects.length === 0) {
    return {
      sideId: side.id,
      sideName: side.name,
      objects: [],
      totalPrice: 0,
      hasObjects: false,
    };
  }

  const canvasAny = canvas as fabric.Canvas & {
    scaledImageWidth?: number;
    originalImageWidth?: number;
    calibrationNativeMmPerPx?: number;
  };
  const scaledImageWidth = canvasAny.scaledImageWidth || 500;
  const originalImageWidth = canvasAny.originalImageWidth;
  const calibrationNativeMmPerPx = canvasAny.calibrationNativeMmPerPx ?? 0;
  const calibratedRatio =
    calibrationNativeMmPerPx > 0 && originalImageWidth && scaledImageWidth
      ? calibrationNativeMmPerPx / (scaledImageWidth / originalImageWidth)
      : 0;
  const realWorldProductWidth = side.realLifeDimensions?.productWidthMm || 500;
  const pixelToMmRatio = calibratedRatio > 0 ? calibratedRatio : realWorldProductWidth / scaledImageWidth;

  const combinedDimensions = calculateCombinedBoundingBox(userObjects, pixelToMmRatio);
  const combinedPrintSize = determinePrintSize(combinedDimensions.width, combinedDimensions.height);

  let groupPrice = 0;
  try {
    const rows = await getCustomerPricingForPrintMethodKey('dtf');
    if (rows.length > 0) {
      const picked = pickUnitPriceForArtwork(
        rows,
        combinedDimensions.width / 10,
        combinedDimensions.height / 10,
      );
      if (picked) groupPrice = picked.unitPrice;
    }
  } catch (error) {
    console.warn('[canvasPricing] customer pricing lookup failed, falling back to legacy', error);
  }
  if (groupPrice <= 0) groupPrice = calculateTransferFallback(combinedPrintSize);

  const objectPricings: ObjectPricing[] = [];
  const perObjectFloor = Math.floor(groupPrice / Math.max(1, userObjects.length));
  let allocated = 0;

  for (let i = 0; i < userObjects.length; i++) {
    const obj = userObjects[i];
    const data = (obj as { data?: { objectId?: string } }).data;
    const objectId = data?.objectId || `obj-${Math.random().toString(36).slice(2, 11)}`;
    const dimensions = calculateObjectDimensionsMm(obj, pixelToMmRatio);
    const isLast = i === userObjects.length - 1;
    const price = isLast ? groupPrice - allocated : perObjectFloor;
    allocated += price;

    objectPricings.push({
      objectId,
      objectType: obj.type || 'unknown',
      printSize: determinePrintSize(dimensions.width, dimensions.height),
      dimensionsMm: dimensions,
      price,
    });
  }

  return {
    sideId: side.id,
    sideName: side.name,
    objects: objectPricings,
    totalPrice: objectPricings.reduce((sum, item) => sum + item.price, 0),
    hasObjects: true,
  };
}

export async function calculateAllSidesPricing(
  canvasMap: Record<string, fabric.Canvas>,
  sides: ProductSide[],
): Promise<PricingSummary> {
  const sidePricing: SidePricing[] = [];
  let totalAdditionalPrice = 0;
  let totalObjectCount = 0;

  for (const side of sides) {
    const canvas = canvasMap[side.id];
    if (!canvas) continue;
    const pricing = await calculateSidePricing(canvas, side);
    sidePricing.push(pricing);
    totalAdditionalPrice += pricing.totalPrice;
    totalObjectCount += pricing.objects.length;
  }

  return {
    sidePricing,
    totalAdditionalPrice,
    totalObjectCount,
  };
}
