'use client';

import React, { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useCanvasStore } from '@/store/useCanvasStore';
import { useFontStore } from '@/store/useFontStore';
import { createClient } from '@/lib/supabase-client';
import { saveDesign } from '@/lib/designService';
import { generateProductThumbnail } from '@/lib/thumbnailGenerator';
import type { ProductConfig, ProductColor } from '@/types/types';
import type { SavedDesignRow } from '@/hooks/useSavedDesigns';

// Dynamically import ProductDesigner to avoid SSR issues with Fabric.js
const ProductDesigner = dynamic(
  () => import('@/app/components/canvas/ProductDesigner'),
  { ssr: false, loading: () => <div className="flex-1 bg-[#EBEBEB] animate-pulse" /> }
);

interface DesignEditorModalProps {
  productId: string;
  initialColor?: string;
  onSaveComplete: (design: SavedDesignRow) => void;
  onClose: () => void;
}

/**
 * Full-screen in-app design editor modal (Phase 7).
 * Replaces window.open() to admin.modoogoods.com/editor.
 *
 * Features: Fabric.js canvas, background removal, anchor presets,
 * product color selection. The Toolbar's fixed z-100 header is
 * visually covered by this modal's header at z-[200] (same stacking context).
 */
export default function DesignEditorModal({
  productId,
  initialColor,
  onSaveComplete,
  onClose,
}: DesignEditorModalProps) {
  const [productConfig, setProductConfig] = useState<ProductConfig | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Product colors
  const [productColors, setProductColors] = useState<ProductColor[]>([]);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);

  const {
    setEditMode,
    setActiveSide,
    productColor,
    setProductColor,
    saveAllCanvasState,
    canvasMap,
    resetCanvasState,
  } = useCanvasStore();

  // Fetch product configuration and available colors
  useEffect(() => {
    let cancelled = false;

    const fetchConfig = async () => {
      setLoadingConfig(true);
      setConfigError(null);
      try {
        const supabase = createClient();

        const [productResult, colorsResult] = await Promise.all([
          supabase
            .from('products')
            .select('id, configuration')
            .eq('id', productId)
            .single(),
          supabase
            .from('product_colors')
            .select('*, manufacturer_colors (id, name, hex, color_code)')
            .eq('product_id', productId)
            .eq('is_active', true)
            .order('sort_order'),
        ]);

        if (cancelled) return;
        if (productResult.error || !productResult.data) {
          throw productResult.error ?? new Error('Product not found');
        }

        const config: ProductConfig = {
          productId: productResult.data.id,
          sides: (productResult.data.configuration as any) ?? [],
        };

        setProductConfig(config);

        if (config.sides.length > 0) {
          setActiveSide(config.sides[0].id);
        }

        // Colors
        if (!colorsResult.error && colorsResult.data) {
          const colors = colorsResult.data.map((item) => ({
            ...item,
            manufacturer_colors: item.manufacturer_colors as unknown as ProductColor['manufacturer_colors'],
          })) as ProductColor[];
          colors.sort((a, b) =>
            (a.manufacturer_colors?.color_code || '').localeCompare(b.manufacturer_colors?.color_code || ''),
          );
          setProductColors(colors);

          // Set initial color: prop > first available color > white
          if (initialColor) {
            setProductColor(initialColor);
          } else if (colors.length > 0) {
            setProductColor(colors[0].manufacturer_colors.hex);
          }
        } else if (initialColor) {
          setProductColor(initialColor);
        }

        setEditMode(true);
      } catch (e) {
        if (!cancelled) {
          console.error('[DesignEditorModal] fetchConfig error:', e);
          setConfigError('제품 정보를 불러오지 못했습니다.');
        }
      } finally {
        if (!cancelled) setLoadingConfig(false);
      }
    };

    fetchConfig();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      resetCanvasState();
      setEditMode(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    if (!productConfig || saving) return;
    setSaving(true);
    try {
      const canvasState = saveAllCanvasState();
      const primarySideId = productConfig.sides[0]?.id ?? 'front';
      const thumbnail = generateProductThumbnail(canvasMap, primarySideId, 400, 400);
      const customFonts = useFontStore.getState().customFonts;

      const result = await saveDesign({
        productId: productConfig.productId,
        productColor: productColor ?? '#FFFFFF',
        canvasState,
        previewImage: thumbnail || undefined,
        pricePerItem: 0,
        customFonts,
      });

      if (!result) {
        throw new Error('저장 실패');
      }

      const designRow: SavedDesignRow = {
        id: result.id,
        product_id: result.product_id,
        user_id: result.user_id,
        title: result.title,
        preview_url: result.preview_url,
        price_per_item: null,
        created_at: result.created_at,
        updated_at: result.updated_at,
      };

      onSaveComplete(designRow);
    } catch (e) {
      console.error('[DesignEditorModal] save error:', e);
      alert('디자인 저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const hasColorOptions = productColors.length > 0;
  const selectedColorHex = productColor ?? '#FFFFFF';
  const selectedColorName =
    productColors.find((c) => c.manufacturer_colors.hex === selectedColorHex)
      ?.manufacturer_colors.name ?? '색상';

  return (
    <div className="fixed inset-0 z-[9000] bg-white flex flex-col">
      {/*
        Modal header at z-[200] covers Toolbar's "fixed top-0 left-0 z-100" header
        (child of same stacking context) — only [닫기] and [저장] are visible.
      */}
      <div
        className="relative z-[200] flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 shrink-0"
        style={{ minHeight: 52 }}
      >
        <button
          onClick={onClose}
          className="p-2 -ml-2 hover:bg-gray-100 rounded-lg transition flex items-center gap-1 text-gray-700"
          aria-label="닫기"
        >
          <X className="size-5" />
        </button>

        <span className="text-sm font-semibold text-gray-900 absolute left-1/2 -translate-x-1/2">
          디자인 편집
        </span>

        <button
          onClick={handleSave}
          disabled={saving || loadingConfig || !productConfig}
          className="px-4 py-2 bg-black text-white text-sm font-semibold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition hover:bg-gray-800 flex items-center gap-1.5"
        >
          {saving && <Loader2 className="size-3.5 animate-spin" />}
          저장
        </button>
      </div>

      {/* Canvas content area */}
      <div className="flex-1 overflow-hidden relative">
        {loadingConfig ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="size-8 animate-spin text-gray-400" />
          </div>
        ) : configError ? (
          <div className="h-full flex flex-col items-center justify-center gap-4 p-6">
            <p className="text-sm text-red-600 text-center">{configError}</p>
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition"
            >
              닫기
            </button>
          </div>
        ) : productConfig ? (
          <ProductDesigner
            config={productConfig}
            layout="mobile"
            onExitEditMode={onClose}
            onColorPress={hasColorOptions ? () => setColorPickerOpen(true) : undefined}
            displayColor={selectedColorHex}
            hasColorOptions={hasColorOptions}
          />
        ) : null}
      </div>

      {/* Color picker bottom sheet */}
      {colorPickerOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-[9100]"
            onClick={() => setColorPickerOpen(false)}
          />
          <div className="fixed bottom-0 inset-x-0 z-[9200] bg-white rounded-t-2xl shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h3 className="font-semibold text-base">색상 선택</h3>
              <button
                onClick={() => setColorPickerOpen(false)}
                className="text-gray-500 hover:text-gray-800 text-xl leading-none px-2"
              >×</button>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-6 gap-3">
                {productColors.map((c) => {
                  const hex = c.manufacturer_colors.hex;
                  const isSelected = hex === selectedColorHex;
                  return (
                    <button
                      key={c.id}
                      onClick={() => {
                        setProductColor(hex);
                        setColorPickerOpen(false);
                      }}
                      className="flex flex-col items-center gap-1"
                      title={c.manufacturer_colors.name}
                    >
                      <div
                        className={`w-10 h-10 rounded-full border-2 transition-all ${
                          isSelected
                            ? 'border-black scale-110 shadow-md'
                            : 'border-gray-300 hover:border-gray-500'
                        }`}
                        style={{ backgroundColor: hex }}
                      />
                      <span className={`text-[10px] leading-tight text-center truncate w-12 ${
                        isSelected ? 'font-bold text-gray-900' : 'text-gray-500'
                      }`}>
                        {c.manufacturer_colors.name}
                      </span>
                    </button>
                  );
                })}
              </div>
              {selectedColorName && (
                <p className="mt-3 text-xs text-center text-gray-600">
                  선택: <span className="font-semibold text-gray-900">{selectedColorName}</span>
                </p>
              )}
            </div>
            <div className="pb-safe h-6" />
          </div>
        </>
      )}
    </div>
  );
}
