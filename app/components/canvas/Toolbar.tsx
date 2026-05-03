'use client'
import React, { useState, useMemo, useEffect } from 'react';
import * as fabric from 'fabric';
import { useCanvasStore } from '@/store/useCanvasStore';
import { Plus, TextCursor, Layers, FileImage, Trash2, RefreshCcw, ZoomIn, ZoomOut, ArrowUp, ArrowDown, ChevronsUp, ChevronsDown, ChevronLeft } from 'lucide-react';
import { ProductSide } from '@/types/types';
import TextStylePanel from './TextStylePanel';
import { isCurvedText } from '@/lib/curvedText';
import { uploadFileToStorage } from '@/lib/supabase-storage';
import { STORAGE_BUCKETS, STORAGE_FOLDERS } from '@/lib/storage-config';
import { createClient } from '@/lib/supabase-client';
import { convertToPNG, isAiOrPsdFile, getConversionErrorMessage, MAX_UPLOAD_BYTES } from '@/lib/imageConvert';
import { trimFileToAlphaBounds } from '@/lib/imageAlphaTrim';
import LoadingModal from '@/app/components/LoadingModal';

// No-op for tracking (no GTM in salesman)
const trackDesignAction = (..._args: any[]) => {};

interface ToolbarProps {
  sides?: ProductSide[];
  handleExitEditMode?: () => void;
  variant?: 'mobile' | 'desktop';
  productId?: string;
  onColorPress?: () => void;
  displayColor?: string;
  hasColorOptions?: boolean;
}

const Toolbar: React.FC<ToolbarProps> = ({ sides = [], handleExitEditMode, variant = 'mobile', productId, onColorPress, displayColor, hasColorOptions }) => {
  const { getActiveCanvas, activeSideId, setActiveSide, isEditMode, canvasMap, incrementCanvasVersion, zoomIn, zoomOut, getZoomLevel } = useCanvasStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedObject, setSelectedObject] = useState<fabric.FabricObject | null>(null);
  const currentZoom = getZoomLevel();
  const isDesktop = variant === 'desktop';

  // Loading modal state
  const [isLoadingModalOpen, setIsLoadingModalOpen] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [loadingSubmessage, setLoadingSubmessage] = useState('');

  // Image upload agreement modal state
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [imageUploadAgreed, setImageUploadAgreed] = useState(false);

  const handleObjectSelection = (object: fabric.FabricObject | null) => {
    if (!object) {
      setSelectedObject(null);
      return;
    }
    setSelectedObject(object);
  };

  const clearSettings = () => {};

  useEffect(() => {
    const canvas = getActiveCanvas();
    if (!canvas) {
      setSelectedObject(null);
      return;
    }

    setSelectedObject(null);

    const handleSelectionCreated = (options: { selected: fabric.FabricObject[] }) => {
      const selected = options.selected?.[0] || canvas.getActiveObject();
      handleObjectSelection(selected || null);
    };

    const handleSelectionUpdated = (options: { selected: fabric.FabricObject[]; deselected: fabric.FabricObject[] }) => {
      const selected = options.selected?.[0] || canvas.getActiveObject();
      handleObjectSelection(selected || null);
    };

    const handleSelectionCleared = () => {
      handleObjectSelection(null);
      clearSettings();
    };

    const handleObjectModified = (options: { target?: fabric.FabricObject }) => {
      const target = options.target || canvas.getActiveObject();
      handleObjectSelection(target || null);
      incrementCanvasVersion();
    };

    const handleObjectScaling = (options: { target?: fabric.FabricObject }) => {
      const target = options.target || canvas.getActiveObject();
      handleObjectSelection(target || null);
      incrementCanvasVersion();
    };

    canvas.on('selection:created', handleSelectionCreated);
    canvas.on('selection:updated', handleSelectionUpdated);
    canvas.on('selection:cleared', handleSelectionCleared);
    canvas.on('object:modified', handleObjectModified);
    canvas.on('object:scaling', handleObjectScaling);

    return () => {
      canvas.off('selection:created', handleSelectionCreated);
      canvas.off('selection:updated', handleSelectionUpdated);
      canvas.off('selection:cleared', handleSelectionCleared);
      canvas.off('object:modified', handleObjectModified);
      canvas.off('object:scaling', handleObjectScaling);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSideId, canvasMap]);

  const addText = () => {
    const canvas = getActiveCanvas();
    if (!canvas) return;

    const objectId = `text-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

    const text = new fabric.IText('modoo', {
      left: canvas.width / 2,
      top: canvas.height / 2,
      originX: 'center',
      originY: 'center',
      fontFamily: 'Arial',
      fill: '#333',
      fontSize: 30,
    });

    // @ts-expect-error - Adding custom data property
    text.data = {
      // @ts-expect-error - Reading data property
      ...(text.data || {}),
      objectId,
      printMethod: 'dtf',
    };

    canvas.add(text);
    canvas.setActiveObject(text);
    canvas.renderAll();
    text.enterEditing();

    handleObjectSelection(text);
    incrementCanvasVersion();
    trackDesignAction({ action_type: 'text_add', product_id: productId, side_id: activeSideId });
  };

  const handleAddImageClick = () => {
    setImageUploadAgreed(false);
    setIsImageModalOpen(true);
  };

  const handleImageModalConfirm = () => {
    if (!imageUploadAgreed) return;
    setIsImageModalOpen(false);
    pickAndPlaceImage();
  };

  const SIZE_OVERFLOW_MSG = (mb: string) =>
    `파일이 너무 큽니다 (현재 ${mb}MB / 최대 50MB)\n\n` +
    `더 작은 파일(최대 50MB)로 다시 업로드해 주세요.`;

  // Simplified image upload: pick → convert if AI/PSD → upload → place on canvas
  // No background removal modal in salesman app.
  const pickAndPlaceImage = async () => {
    const canvas = getActiveCanvas();
    if (!canvas) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,.ai,.psd';

    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) return;

      if (file.size > MAX_UPLOAD_BYTES) {
        alert(SIZE_OVERFLOW_MSG((file.size / 1024 / 1024).toFixed(1)));
        return;
      }

      try {
        const supabase = createClient();
        let uploadFile: File = file;

        if (isAiOrPsdFile(file)) {
          setLoadingMessage('파일 변환 중...');
          setLoadingSubmessage('AI/PSD 파일을 PNG로 변환하고 있습니다. (최대 수 분 소요)');
          setIsLoadingModalOpen(true);

          const conversionResult = await convertToPNG(file, (msg) => setLoadingSubmessage(msg));

          if (!conversionResult.success || !conversionResult.pngBlob) {
            setIsLoadingModalOpen(false);
            alert(getConversionErrorMessage(conversionResult.error));
            return;
          }

          uploadFile = new File(
            [conversionResult.pngBlob],
            `${file.name.split('.')[0]}.png`,
            { type: 'image/png' },
          );
        }

        setLoadingMessage('이미지 업로드 중...');
        setLoadingSubmessage('이미지를 저장하고 있습니다. 잠시만 기다려주세요.');
        setIsLoadingModalOpen(true);

        // Alpha-trim transparent margins
        const trimResult = await trimFileToAlphaBounds(uploadFile);
        if (trimResult.trimmed) {
          console.log(
            `[ALPHA-TRIM] ${trimResult.originalWidth}x${trimResult.originalHeight} -> ${trimResult.width}x${trimResult.height}`,
          );
        }

        const uploadResult = await uploadFileToStorage(
          supabase,
          trimResult.file,
          STORAGE_BUCKETS.USER_DESIGNS,
          STORAGE_FOLDERS.IMAGES,
        );

        if (!uploadResult.success || !uploadResult.url) {
          setIsLoadingModalOpen(false);
          const rawErr = uploadResult.error || '';
          const friendly = rawErr.includes('exceeded the maximum')
            ? SIZE_OVERFLOW_MSG((trimResult.file.size / 1024 / 1024).toFixed(1))
            : `이미지 업로드에 실패했습니다.\n사유: ${rawErr || '알 수 없음'}`;
          alert(friendly);
          return;
        }

        setLoadingMessage('이미지 불러오는 중...');
        setLoadingSubmessage('캔버스에 이미지를 추가하고 있습니다.');

        const img = await fabric.FabricImage.fromURL(uploadResult.url, {
          crossOrigin: 'anonymous',
        });

        const maxWidth = canvas.width * 0.5;
        const maxHeight = canvas.height * 0.5;
        if (img.width > maxWidth || img.height > maxHeight) {
          const scale = Math.min(maxWidth / img.width, maxHeight / img.height);
          img.scale(scale);
        }
        img.set({
          left: canvas.width / 2,
          top: canvas.height / 2,
          originX: 'center',
          originY: 'center',
        });

        const objectId = `image-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

        // @ts-expect-error - Adding custom data property to FabricImage
        img.data = {
          // @ts-expect-error - Reading data property
          ...(img.data || {}),
          objectId,
          supabaseUrl: uploadResult.url,
          supabasePath: uploadResult.path,
          originalFileName: file.name,
          fileType: file.type || 'unknown',
          isConverted: isAiOrPsdFile(file),
          uploadedAt: new Date().toISOString(),
          printMethod: 'dtf',
        };

        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.renderAll();

        incrementCanvasVersion();
        trackDesignAction({
          action_type: 'image_upload',
          product_id: productId,
          side_id: activeSideId,
        });

        setIsLoadingModalOpen(false);
      } catch (error) {
        setIsLoadingModalOpen(false);
        console.error('Error placing image on canvas:', error);
        alert('이미지 추가 중 오류가 발생했습니다.');
      }
    };

    input.click();
  };

  const handleSideSelect = (sideId: string) => {
    setActiveSide(sideId);
    setIsModalOpen(false);
    trackDesignAction({ action_type: 'face_change', product_id: productId, side_id: sideId });
  };

  const handleDeleteObject = () => {
    const canvas = getActiveCanvas();
    const activeObj = canvas?.getActiveObject();
    const activeObjs = canvas?.getActiveObjects();

    if (activeObjs && activeObjs.length > 0) {
      activeObjs.forEach(obj => canvas?.remove(obj));
      canvas?.discardActiveObject();
      canvas?.renderAll();
      incrementCanvasVersion();
      trackDesignAction({ action_type: 'object_delete', product_id: productId, side_id: activeSideId });
    } else if (activeObj) {
      canvas?.remove(activeObj);
      canvas?.renderAll();
      incrementCanvasVersion();
      trackDesignAction({ action_type: 'object_delete', product_id: productId, side_id: activeSideId });
    }
  };

  const handleResetCanvas = () => {
    const canvas = getActiveCanvas();
    if (!canvas) return;

    canvas.getObjects().forEach((obj) => {
      const objData = obj.get('data') as { id?: string } | undefined;
      if (objData?.id !== 'background-product-image' && objData?.id !== 'center-line') {
        canvas.remove(obj);
      }
    });

    canvas.renderAll();
    incrementCanvasVersion();
    trackDesignAction({ action_type: 'reset', product_id: productId, side_id: activeSideId });
  };

  const bringToFront = () => {
    const canvas = getActiveCanvas();
    const activeObject = canvas?.getActiveObject();
    if (canvas && activeObject) {
      canvas.bringObjectToFront(activeObject);
      canvas.renderAll();
      trackDesignAction({ action_type: 'layer_move', product_id: productId, side_id: activeSideId });
    }
  };

  const sendToBack = () => {
    const canvas = getActiveCanvas();
    const activeObject = canvas?.getActiveObject();
    if (canvas && activeObject) {
      const objects = canvas.getObjects();
      const systemObjects = objects.filter(obj => {
        const objData = obj.get('data') as { id?: string } | undefined;
        return objData?.id === 'background-product-image' ||
               objData?.id === 'center-line' ||
               obj.get('excludeFromExport') === true;
      });

      const maxSystemIndex = Math.max(...systemObjects.map(obj => objects.indexOf(obj)), -1);
      const currentIndex = objects.indexOf(activeObject);
      const targetIndex = maxSystemIndex + 1;

      if (currentIndex > targetIndex) {
        canvas.remove(activeObject);
        canvas.insertAt(targetIndex, activeObject);
        canvas.setActiveObject(activeObject);
        canvas.renderAll();
        trackDesignAction({ action_type: 'layer_move', product_id: productId, side_id: activeSideId });
      }
    }
  };

  const bringForward = () => {
    const canvas = getActiveCanvas();
    const activeObject = canvas?.getActiveObject();
    if (canvas && activeObject) {
      canvas.bringObjectForward(activeObject);
      canvas.renderAll();
      trackDesignAction({ action_type: 'layer_move', product_id: productId, side_id: activeSideId });
    }
  };

  const sendBackward = () => {
    const canvas = getActiveCanvas();
    const activeObject = canvas?.getActiveObject();
    if (canvas && activeObject) {
      const objects = canvas.getObjects();
      const systemObjects = objects.filter(obj => {
        const objData = obj.get('data') as { id?: string } | undefined;
        return objData?.id === 'background-product-image' ||
               objData?.id === 'center-line' ||
               obj.get('excludeFromExport') === true;
      });

      const maxSystemIndex = Math.max(...systemObjects.map(obj => objects.indexOf(obj)), -1);
      const currentIndex = objects.indexOf(activeObject);
      if (currentIndex > maxSystemIndex + 1) {
        canvas.sendObjectBackwards(activeObject);
        canvas.renderAll();
        trackDesignAction({ action_type: 'layer_move', product_id: productId, side_id: activeSideId });
      }
    }
  };

  const canvasPreviews = useMemo(() => {
    if (!isModalOpen) return {};

    const previews: Record<string, string> = {};
    sides.forEach((side) => {
      const canvas = canvasMap[side.id];
      if (canvas) {
        previews[side.id] = canvas.toDataURL({
          format: 'png',
          quality: 0.8,
          multiplier: 0.3,
        });
      }
    });
    return previews;
  }, [isModalOpen, sides, canvasMap]);

  if (!isEditMode) return null;

  const currentSide = sides.find(side => side.id === activeSideId);

  if (isDesktop) {
    return (
      <>
        <div className="flex flex-col items-center gap-3">
          <div className="flex flex-col items-center gap-3">
            <button
              onClick={handleResetCanvas}
              className="flex flex-col items-center gap-1.5 group"
              title="초기화"
            >
              <div className="w-12 h-12 rounded-full border border-gray-200 bg-blue-500 flex items-center justify-center hover:bg-blue-600 transition shadow-sm">
                <RefreshCcw className="size-5 text-white" />
              </div>
              <span className="text-xs text-gray-600 font-medium">초기화</span>
            </button>
            <button
              onClick={addText}
              className="flex flex-col items-center gap-1.5 group"
              title="텍스트 추가"
            >
              <div className="w-12 h-12 rounded-full border border-gray-200 bg-white flex items-center justify-center hover:bg-gray-50 transition shadow-sm">
                <TextCursor className="size-5 text-gray-700" />
              </div>
              <span className="text-xs text-gray-600 font-medium">텍스트</span>
            </button>
            <button
              onClick={handleAddImageClick}
              className="flex flex-col items-center gap-1.5 group"
              title="이미지 추가"
            >
              <div className="w-12 h-12 rounded-full border border-gray-200 bg-white flex items-center justify-center hover:bg-gray-50 transition shadow-sm">
                <FileImage className="size-5 text-gray-700" />
              </div>
              <span className="text-xs text-gray-600 font-medium">이미지</span>
            </button>
          </div>
        </div>

        <LoadingModal
          isOpen={isLoadingModalOpen}
          message={loadingMessage}
          submessage={loadingSubmessage}
        />

        {isImageModalOpen && (
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-200"
            onClick={() => setIsImageModalOpen(false)}
          >
            <div
              className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-lg font-bold mb-4">이미지 파일 안내</h2>
              <div className="space-y-3 text-sm text-gray-700">
                <p>
                  <strong className="text-black">AI/PSD 파일</strong>을 권장드립니다.
                </p>
                <p>
                  다른 파일 형식(PNG, JPG 등)도 사용 가능하지만, 인쇄 품질 확인을 위해 연락드릴 수 있습니다.
                </p>
              </div>
              <label className="flex items-start gap-3 mt-5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={imageUploadAgreed}
                  onChange={(e) => setImageUploadAgreed(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 text-black focus:ring-black"
                />
                <span className="text-sm text-gray-700">위 내용을 확인했습니다.</span>
              </label>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setIsImageModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                >
                  취소
                </button>
                <button
                  onClick={handleImageModalConfirm}
                  disabled={!imageUploadAgreed}
                  className="flex-1 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  확인
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      {/* Exit Edit Mode Button */}
      {isEditMode && (
        <div className="w-full bg-white shadow-md z-100 fixed top-0 left-0 flex items-center justify-between px-4">
          <button
            onClick={handleExitEditMode}
            className="py-3 bg-white hover:bg-gray-100 text-gray-900 transition flex items-center"
          >
            <ChevronLeft className="size-5" />
          </button>

          <div className="flex items-center gap-3">
            {selectedObject ? (
              <>
                <button onClick={bringToFront} title="맨 앞으로" className="p-1.5 hover:bg-gray-100 rounded transition">
                  <ChevronsUp className="text-black/80 size-5" />
                </button>
                <button onClick={bringForward} title="앞으로" className="p-1.5 hover:bg-gray-100 rounded transition">
                  <ArrowUp className="text-black/80 size-5" />
                </button>
                <button onClick={sendBackward} title="뒤로" className="p-1.5 hover:bg-gray-100 rounded transition">
                  <ArrowDown className="text-black/80 size-5" />
                </button>
                <button onClick={sendToBack} title="맨 뒤로" className="p-1.5 hover:bg-gray-100 rounded transition">
                  <ChevronsDown className="text-black/80 size-5" />
                </button>
                <div className="h-6 w-px bg-gray-300" />
                <button onClick={handleDeleteObject} title="삭제" className="p-1.5 hover:bg-gray-100 rounded transition">
                  <Trash2 className="text-red-400 size-5" />
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1 border-r border-gray-300 pr-3">
                  <button
                    onClick={() => zoomOut()}
                    className="p-1.5 hover:bg-gray-100 rounded transition"
                    title="축소"
                  >
                    <ZoomOut className="text-black/80 size-5" />
                  </button>
                  <span className="text-xs text-gray-600 min-w-12 text-center">
                    {Math.round(currentZoom * 100)}%
                  </span>
                  <button
                    onClick={() => zoomIn()}
                    className="p-1.5 hover:bg-gray-100 rounded transition"
                    title="확대"
                  >
                    <ZoomIn className="text-black/80 size-5" />
                  </button>
                </div>
                <button onClick={handleResetCanvas} title="초기화" className="p-1.5 hover:bg-gray-100 rounded transition">
                  <RefreshCcw className="text-black/80" />
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Side selection modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 bg-white/20 backdrop-blur-sm bg-opacity-50 flex items-center justify-center z-50 shadow-lg shadow-black"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="bg-white rounded-lg p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold mb-4">편집할 면 선택</h2>
            <div className="space-y-3">
              {sides.map((side) => (
                <button
                  key={side.id}
                  onClick={() => handleSideSelect(side.id)}
                  className={`w-full p-2 rounded-lg border-2 transition-all text-left flex items-center gap-4 ${
                    side.id === activeSideId
                      ? 'border-blue-600 bg-gray-100'
                      : 'border-gray-200 hover:border-gray-400'
                  }`}
                >
                  <div className="flex-shrink-0 w-20 h-24 bg-gray-100 rounded border border-gray-200 overflow-hidden">
                    {canvasPreviews[side.id] ? (
                      <img
                        src={canvasPreviews[side.id]}
                        alt={`${side.name} preview`}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                        미리보기
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold">{side.name}</div>
                    {side.id === activeSideId && (
                      <div className="text-sm text-gray-600 mt-1">현재 편집 중</div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* FAB — add objects (shown when no object selected) */}
      {!selectedObject && (
        <>
          {sides.length > 0 && (
            <div className="fixed top-16 left-1/2 transform -translate-x-1/2 z-20">
              <button
                onClick={() => setIsModalOpen(true)}
                className="bg-white shadow-xl rounded-full px-6 py-3 flex items-center gap-2 hover:bg-gray-50 transition border border-gray-200"
              >
                <Layers className="size-5" />
                <span className="font-medium">{currentSide?.name || '면 선택'}</span>
              </button>
            </div>
          )}

          {isExpanded && (
            <div className="fixed inset-0 z-40" onClick={() => setIsExpanded(false)} />
          )}

          <div className="fixed bottom-36 right-6 flex flex-col items-end gap-3 z-50">
            <div className={`flex flex-col gap-2 transition-all duration-700 overflow-hidden ${
              isExpanded ? 'opacity-100 max-h-96' : 'opacity-0 max-h-0'
            }`}>
              <button onClick={() => { addText(); setIsExpanded(false); }}>
                <div className="bg-white rounded-full p-3 text-sm font-medium transition hover:bg-gray-50 border border-gray-200 whitespace-nowrap">
                  <TextCursor />
                </div>
                <p className="text-xs">텍스트</p>
              </button>
              <button onClick={() => { handleAddImageClick(); setIsExpanded(false); }}>
                <div className="bg-white rounded-full p-3 text-sm font-medium transition hover:bg-gray-50 border border-gray-200 whitespace-nowrap">
                  <FileImage />
                </div>
                <p className="text-xs">이미지</p>
              </button>
            </div>

            {/* Color button */}
            {hasColorOptions && onColorPress && (
              <button
                onClick={onColorPress}
                className="flex flex-col items-center gap-1"
              >
                <div
                  className="size-12 rounded-full border-2 border-gray-300 shadow-xl transition hover:border-gray-500"
                  style={{ backgroundColor: displayColor || '#FFFFFF' }}
                />
                <p className="text-[10px] font-medium">색상 선택</p>
              </button>
            )}

            {/* Plus FAB */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex flex-col items-center gap-1"
            >
              <div className={`size-12 ${isExpanded ? 'bg-black text-white' : 'bg-white text-black'} shadow-xl rounded-full flex items-center justify-center hover:bg-gray-200 transition-all duration-300`}>
                <Plus className={`${isExpanded ? 'rotate-45' : ''} size-8 transition-all duration-300`} />
              </div>
              <p className="text-[10px] font-medium">디자인하기</p>
            </button>
          </div>
        </>
      )}

      {/* Text style panel when text object is selected */}
      {selectedObject && (selectedObject.type === 'i-text' || selectedObject.type === 'text' || isCurvedText(selectedObject)) && (
        <TextStylePanel
          selectedObject={selectedObject as fabric.IText}
          onClose={() => setSelectedObject(null)}
        />
      )}

      {/* Loading Modal */}
      <LoadingModal
        isOpen={isLoadingModalOpen}
        message={loadingMessage}
        submessage={loadingSubmessage}
      />

      {/* Image Upload Agreement Modal */}
      {isImageModalOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-200"
          onClick={() => setIsImageModalOpen(false)}
        >
          <div
            className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold mb-4">이미지 파일 안내</h2>
            <div className="space-y-3 text-sm text-gray-700">
              <p>
                <strong className="text-black">AI/PSD 파일</strong>을 권장드립니다.
              </p>
              <p>
                다른 파일 형식(PNG, JPG 등)도 사용 가능하지만, 인쇄 품질 확인을 위해 연락드릴 수 있습니다.
              </p>
            </div>
            <label className="flex items-start gap-3 mt-5 cursor-pointer">
              <input
                type="checkbox"
                checked={imageUploadAgreed}
                onChange={(e) => setImageUploadAgreed(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-gray-300 text-black focus:ring-black"
              />
              <span className="text-sm text-gray-700">위 내용을 확인했습니다.</span>
            </label>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setIsImageModalOpen(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
              >
                취소
              </button>
              <button
                onClick={handleImageModalConfirm}
                disabled={!imageUploadAgreed}
                className="flex-1 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Toolbar;
