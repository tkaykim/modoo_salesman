/**
 * Canvas/product type definitions for modoo_salesman editor.
 * Kept in sync with modoo_app/types/types.ts for canvas compatibility.
 */

export interface ColorOption {
  hex: string;
  colorCode: string;
}

export interface ProductLayer {
  id: string;
  name: string;
  imageUrl: string;
  zIndex: number;
  colorOptions: ColorOption[];
}

export interface ProductSide {
  id: string;
  name: string;
  imageUrl?: string;
  printArea: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  realLifeDimensions?: {
    printAreaWidthMm: number;
    printAreaHeightMm: number;
    productWidthMm: number;
  };
  zoomScale?: number;
  layers?: ProductLayer[];
  colorOptions?: ColorOption[];
}

export interface ProductConfig {
  productId: string;
  sides: ProductSide[];
}

export interface SizeOption {
  label: string;
  size_code: string;
}

export interface ProductColor {
  id: string;
  product_id: string;
  manufacturer_color_id: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  manufacturer_colors: {
    id: string;
    name: string;
    hex: string;
    color_code: string;
  };
}
