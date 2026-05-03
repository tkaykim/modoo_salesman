'use client';

import React, { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useCanvasStore } from '@/store/useCanvasStore';
import { useFontStore } from '@/store/useFontStore';
import { createClient } from '@/lib/supabase-client';
import { saveDesign } from '@/lib/designService';
import { generateProductThumbnail } from '@/lib/thumbnailGenerator';
import type { ProductConfig } from '@/types/types';
import type { SavedDesignRow } from '@/hooks/useSavedDesigns';

// Dynamically import ProductDesigner to avoid SSR issues with Fabric.js
const ProductDesigner = dynamic(
  () => import('@/app/components/canvas/ProductDesigner'),
  { ssr: false, loading: () => <div className="flex-1 bg-[#EBEBEB] animate-pulse" /> }
);

interface DesignEditorModalProps {
  /** Product ID to design for */
  productId: string;
  /** Optional initial product color hex */
  initialColor?: string;
  /** Called when design is saved successfully */
  onSaveComplete: (design: SavedDesignRow) => void;
  /** Called when the user cancels / closes without saving */
  onClose: () => void;
}

/**
 * Full-screen in-app design editor modal.
 * Phase 7: replaces the window.open() to admin.modoogoods.com/editor.
 *
 * Opens as a z-[9000] overlay, fetches product configuration,
 * mounts ProductDesigner (Fabric.js canvas), and saves the resulting
 * design to saved_designs on "저장".
 *
 * The Toolbar component renders its own fixed header (z-100) which is
 * visually hidden behind this modal's header (z-[200]), so only our
 * [닫기] / [저장] buttons are visible to the user.
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

  const {
    setEditMode,
    setActiveSide,
    productColor,
    setProductColor,
    saveAllCanvasState,
    canvasMap,
    resetCanvasState,
  } = useCanvasStore();

  // Fetch product configuration from Supabase
  useEffect(() => {
    let cancelled = false;

    const fetchConfig = async () => {
      setLoadingConfig(true);
      setConfigError(null);
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('products')
          .select('id, configuration')
          .eq('id', productId)
          .single();

        if (cancelled) return;
        if (error || !data) throw error ?? new Error('Product not found');

        const config: ProductConfig = {
          productId: data.id,
          sides: (data.configuration as any) ?? [],
        };

        setProductConfig(config);
        if (config.sides.length > 0) {
          setActiveSide(config.sides[0].id);
        }
        if (initialColor) {
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

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  // Cleanup canvas state when modal unmounts
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

      // Convert SavedDesign → SavedDesignRow for addItemFromDesign compatibility
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

  return (
    <div className="fixed inset-0 z-[9000] bg-white flex flex-col">
      {/*
        Modal header at z-[200].
        The Toolbar component renders its own "fixed top-0 left-0 z-100" header;
        that header is a child of this modal's stacking context, so z-[200] here
        visually covers it — users see only our [닫기] / [저장] buttons.
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
          />
        ) : null}
      </div>
    </div>
  );
}
