
'use client'
import React, {useEffect, useRef, useState} from 'react';
import * as fabric from "fabric";
import { ProductSide, ProductLayer } from '@/types/types';
import { useCanvasStore } from '@/store/useCanvasStore';
import ScaleBox from './ScaleBox';
import { formatMm, calculateObjectDimensionsMm, updateObjectDimensionsData } from '@/lib/canvasUtils';
import { fetchProductCalibrations, calibrationToCanvasMmPerPx } from '@/lib/calibrationFetch';
// Import CurvedText to register the class with fabric.js for deserialization
import '@/lib/curvedText';


interface SingleSideCanvasProps {
  side: ProductSide;
  /** Operational product id. When given, calibration mmPerPx is fetched and used for px↔mm. */
  productId?: string;
  width?: number;
  height?: number;
  isEdit?: boolean;
  onCanvasReady?: (canvas: fabric.Canvas, sideId: string, canvasScale: number) => void;
  productColor?: string;
  showScaleBox?: boolean;
}

const SingleSideCanvas: React.FC<SingleSideCanvasProps> = ({
  side,
  productId,
  width = 500,
  height = 500,
  isEdit = false,
  onCanvasReady,
  productColor: productColorProp,
  showScaleBox = true,
}) => {
  const canvasEl = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<fabric.Canvas | null>(null);
  const isEditRef = useRef(isEdit);
  const productImageRef = useRef<fabric.FabricImage | null>(null);
  const layerImagesRef = useRef<Map<string, fabric.FabricImage>>(new Map());
  const loadSessionRef = useRef(0);
  const calibrationNativeMmPerPxRef = useRef<number>(0);

  const { registerCanvas, unregisterCanvas, productColor: productColorFromStore, markImageLoaded, incrementCanvasVersion, initializeLayerColors, initializeSideColor, layerColors, resetZoom, zoomLevels, setZoom } = useCanvasStore();
  const productColor = productColorProp ?? productColorFromStore;
  const zoomLevel = zoomLevels[side.id] || 1.0;

  const isSpacePressedRef = useRef(false);
  const isPointerOverCanvasRef = useRef(false);
  const isMousePanningRef = useRef(false);
  const isTouchPanningRef = useRef(false);
  const lastPanPointRef = useRef<{ x: number; y: number } | null>(null);
  const lastTouchMidpointRef = useRef<{ x: number; y: number } | null>(null);
  const lastPinchDistanceRef = useRef<number>(0);
  const panRestoreStateRef = useRef<{
    selection: boolean;
    skipTargetFind: boolean;
    defaultCursor: string;
  } | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [layersReady, setLayersReady] = useState(false);

  const [scaleBoxVisible, setScaleBoxVisible] = useState(false);
  const [scaleBoxDimensions, setScaleBoxDimensions] = useState({
    x: '0mm',
    y: '0mm',
    width: '0mm',
    height: '0mm',
  });
  const [scaleBoxPosition, setScaleBoxPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    isEditRef.current = isEdit;
  }, [isEdit]);

  useEffect(() => {
    let cancelled = false;
    if (!productId) {
      calibrationNativeMmPerPxRef.current = 0;
      return;
    }
    fetchProductCalibrations(productId).then((map) => {
      if (cancelled) return;
      const cal = map.get(side.id);
      calibrationNativeMmPerPxRef.current = cal?.nativeMmPerPx ?? 0;
      const canvas = canvasRef.current;
      if (canvas) {
        // @ts-expect-error - Custom property
        canvas.calibrationNativeMmPerPx = calibrationNativeMmPerPxRef.current;
        canvas.requestRenderAll();
      }
    }).catch(() => {
      if (!cancelled) calibrationNativeMmPerPxRef.current = 0;
    });
    return () => { cancelled = true; };
  }, [productId, side.id]);

  useEffect(() => {
    setLayersReady(false);
  }, [side.id]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const vpt = canvas.viewportTransform;
    if (!vpt) return;

    const zoom = canvas.getZoom();
    const w = canvas.getWidth();
    const h = canvas.getHeight();

    if (zoom <= 1) {
      vpt[4] = (w - w * zoom) / 2;
      vpt[5] = (h - h * zoom) / 2;
    } else {
      const minX = w - w * zoom;
      const minY = h - h * zoom;
      vpt[4] = Math.min(0, Math.max(minX, vpt[4]));
      vpt[5] = Math.min(0, Math.max(minY, vpt[5]));
    }

    canvas.setViewportTransform(vpt);
    canvas.requestRenderAll();
  }, [zoomLevel]);

  useEffect(() => {
    const sessionId = ++loadSessionRef.current;
    let isDisposed = false;
    const isSessionActive = () => !isDisposed && loadSessionRef.current === sessionId;

    setIsLoading(true);
    setLayersReady(false);
    layerImagesRef.current.clear();
    productImageRef.current = null;

    if (!canvasEl.current) {
      return;
    }

    const canvas = new fabric.Canvas(canvasEl.current, {
      width,
      height,
      backgroundColor: '#EBEBEB',
      preserveObjectStacking: true,
      selection: false,
    })

    canvasRef.current = canvas;

    const clampViewportToCanvasBounds = () => {
      const vpt = canvas.viewportTransform;
      if (!vpt) return;

      const zoom = canvas.getZoom();
      const w = canvas.getWidth();
      const h = canvas.getHeight();

      if (zoom <= 1) {
        vpt[4] = (w - w * zoom) / 2;
        vpt[5] = (h - h * zoom) / 2;
      } else {
        const minX = w - w * zoom;
        const minY = h - h * zoom;
        vpt[4] = Math.min(0, Math.max(minX, vpt[4]));
        vpt[5] = Math.min(0, Math.max(minY, vpt[5]));
      }

      canvas.setViewportTransform(vpt);
    };

    const startPan = (clientX: number, clientY: number) => {
      if (isMousePanningRef.current || isTouchPanningRef.current) return;
      if (canvas.getZoom() <= 1) return;

      panRestoreStateRef.current = {
        selection: canvas.selection,
        skipTargetFind: canvas.skipTargetFind || false,
        defaultCursor: canvas.defaultCursor || 'default',
      };

      canvas.discardActiveObject();
      canvas.selection = false;
      canvas.skipTargetFind = true;
      canvas.setCursor('grabbing');

      isMousePanningRef.current = true;
      lastPanPointRef.current = { x: clientX, y: clientY };
    };

    const continuePan = (clientX: number, clientY: number) => {
      const last = lastPanPointRef.current;
      if (!last) return;

      const dx = clientX - last.x;
      const dy = clientY - last.y;
      lastPanPointRef.current = { x: clientX, y: clientY };

      const vpt = canvas.viewportTransform;
      if (!vpt) return;

      vpt[4] += dx;
      vpt[5] += dy;
      clampViewportToCanvasBounds();
      canvas.requestRenderAll();
    };

    const endPan = () => {
      if (!isMousePanningRef.current && !isTouchPanningRef.current) return;

      isMousePanningRef.current = false;
      isTouchPanningRef.current = false;
      lastPanPointRef.current = null;
      lastTouchMidpointRef.current = null;
      lastPinchDistanceRef.current = 0;

      const restore = panRestoreStateRef.current;
      if (restore) {
        canvas.selection = restore.selection;
        canvas.skipTargetFind = restore.skipTargetFind;
      }

      if (isPointerOverCanvasRef.current && isSpacePressedRef.current && canvas.getZoom() > 1) {
        canvas.setCursor('grab');
      } else {
        canvas.setCursor(restore?.defaultCursor || canvas.defaultCursor || 'default');
      }

      clampViewportToCanvasBounds();
      canvas.requestRenderAll();
    };

    type CanvasPointerEvent = fabric.TPointerEventInfo<fabric.TPointerEvent> & {
      alreadySelected?: boolean;
    };

    const handleMouseDown = (opt: CanvasPointerEvent) => {
      const evt = opt.e;
      if (typeof TouchEvent !== 'undefined' && evt instanceof TouchEvent) return;
      if ((evt as MouseEvent).button !== 0) return;
      if (!isSpacePressedRef.current) return;
      if (canvas.getZoom() <= 1) return;

      evt.preventDefault();
      (evt as MouseEvent).preventDefault();
      startPan((evt as MouseEvent).clientX, (evt as MouseEvent).clientY);
    };

    const handleMouseMove = (opt: CanvasPointerEvent) => {
      if (!isMousePanningRef.current) return;
      const evt = opt.e;
      if (typeof TouchEvent !== 'undefined' && evt instanceof TouchEvent) return;
      (evt as MouseEvent).preventDefault();
      continuePan((evt as MouseEvent).clientX, (evt as MouseEvent).clientY);
    };

    const handleMouseUp = () => {
      if (!isMousePanningRef.current) return;
      endPan();
    };

    canvas.on('mouse:down', handleMouseDown);
    canvas.on('mouse:move', handleMouseMove);
    canvas.on('mouse:up', handleMouseUp);

    const upperEl = canvas.upperCanvasEl;
    const handleUpperMouseEnter = () => {
      isPointerOverCanvasRef.current = true;
      if (isSpacePressedRef.current && canvas.getZoom() > 1) {
        canvas.setCursor('grab');
      }
    };
    const handleUpperMouseLeave = () => {
      isPointerOverCanvasRef.current = false;
      if (isMousePanningRef.current) endPan();
      if (!isMousePanningRef.current && !isTouchPanningRef.current) {
        const restore = panRestoreStateRef.current;
        canvas.setCursor(restore?.defaultCursor || canvas.defaultCursor || 'default');
      }
    };
    upperEl.addEventListener('mouseenter', handleUpperMouseEnter);
    upperEl.addEventListener('mouseleave', handleUpperMouseLeave);

    const getTouchDistance = (t0: Touch, t1: Touch) => {
      const dx = t0.clientX - t1.clientX;
      const dy = t0.clientY - t1.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;

      e.preventDefault();
      const midX = (e.touches[0]!.clientX + e.touches[1]!.clientX) / 2;
      const midY = (e.touches[0]!.clientY + e.touches[1]!.clientY) / 2;
      const dist = getTouchDistance(e.touches[0]!, e.touches[1]!);

      if (isMousePanningRef.current) endPan();
      if (!isTouchPanningRef.current) {
        panRestoreStateRef.current = {
          selection: canvas.selection,
          skipTargetFind: canvas.skipTargetFind || false,
          defaultCursor: canvas.defaultCursor || 'default',
        };
        canvas.discardActiveObject();
        canvas.selection = false;
        canvas.skipTargetFind = true;
        canvas.setCursor('grabbing');
      }

      isTouchPanningRef.current = true;
      lastTouchMidpointRef.current = { x: midX, y: midY };
      lastPinchDistanceRef.current = dist;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isTouchPanningRef.current) return;
      if (e.touches.length !== 2) {
        endPan();
        return;
      }

      e.preventDefault();
      const midX = (e.touches[0]!.clientX + e.touches[1]!.clientX) / 2;
      const midY = (e.touches[0]!.clientY + e.touches[1]!.clientY) / 2;
      const newDist = getTouchDistance(e.touches[0]!, e.touches[1]!);

      const oldDist = lastPinchDistanceRef.current;
      if (oldDist > 0 && Math.abs(newDist - oldDist) > 1) {
        const scale = newDist / oldDist;
        const currentZoom = canvas.getZoom();
        const newZoom = currentZoom * scale;
        useCanvasStore.getState().setZoom(newZoom, side.id);
      }
      lastPinchDistanceRef.current = newDist;

      const last = lastTouchMidpointRef.current;
      if (!last) {
        lastTouchMidpointRef.current = { x: midX, y: midY };
        return;
      }

      const dx = midX - last.x;
      const dy = midY - last.y;
      lastTouchMidpointRef.current = { x: midX, y: midY };

      const vpt = canvas.viewportTransform;
      if (!vpt) return;

      vpt[4] += dx;
      vpt[5] += dy;
      clampViewportToCanvasBounds();
      canvas.requestRenderAll();
    };

    const handleTouchEnd = () => {
      lastPinchDistanceRef.current = 0;
      if (!isTouchPanningRef.current) return;
      endPan();
    };

    upperEl.addEventListener('touchstart', handleTouchStart, { passive: false });
    upperEl.addEventListener('touchmove', handleTouchMove, { passive: false });
    upperEl.addEventListener('touchend', handleTouchEnd, { passive: false });
    upperEl.addEventListener('touchcancel', handleTouchEnd, { passive: false });

    const handleWindowKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;

      const target = e.target as HTMLElement | null;
      const isTypingTarget = !!target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      );
      isSpacePressedRef.current = true;

      if (!isTypingTarget && (isPointerOverCanvasRef.current || isMousePanningRef.current || isTouchPanningRef.current)) {
        e.preventDefault();
      }

      if (isPointerOverCanvasRef.current && canvas.getZoom() > 1 && !isMousePanningRef.current && !isTouchPanningRef.current) {
        canvas.setCursor('grab');
      }
    };

    const handleWindowKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      isSpacePressedRef.current = false;

      if (isMousePanningRef.current || isTouchPanningRef.current) return;
      const restore = panRestoreStateRef.current;
      canvas.setCursor(restore?.defaultCursor || canvas.defaultCursor || 'default');
    };

    const handleWindowMouseUp = () => {
      if (isMousePanningRef.current) endPan();
    };

    const handleWindowBlur = () => {
      isSpacePressedRef.current = false;
      if (isMousePanningRef.current || isTouchPanningRef.current) endPan();
    };

    const handleWheel = (opt: fabric.TPointerEventInfo<WheelEvent>) => {
      const e = opt.e;
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaY;
      const currentZoom = canvas.getZoom();
      const zoomFactor = delta > 0 ? 0.95 : 1.05;
      useCanvasStore.getState().setZoom(currentZoom * zoomFactor, side.id);
    };
    canvas.on('mouse:wheel', handleWheel);

    window.addEventListener('keydown', handleWindowKeyDown, { passive: false });
    window.addEventListener('keyup', handleWindowKeyUp);
    window.addEventListener('mouseup', handleWindowMouseUp);
    window.addEventListener('blur', handleWindowBlur);

    fabric.InteractiveFabricObject.ownDefaults = {
    ...fabric.InteractiveFabricObject.ownDefaults,
    cornerStyle: 'circle',
    cornerColor: 'lightblue',
    transparentCorners: false,
    borderColor: 'blue',
    borderScaleFactor: 1,
    _controlsVisibility: {
      mt: false,
      mb: false,
      ml: false,
      mr: false,
    }
}

    registerCanvas(side.id, canvas)

    const printW = side.printArea.width;
    const printH = side.printArea.height;

    const tempCenteredLeft = (width - printW) / 2;
    const tempCenteredTop = (height - printH) / 2;
    const tempPrintCenterX = tempCenteredLeft + (printW / 2);
    const tempPrintCenterY = tempCenteredTop + (printH / 2);

    const hasLayers = side.layers && side.layers.length > 0;

    const snapLineCenterX = hasLayers ? width / 2 : tempPrintCenterX;
    const snapLineTop = hasLayers ? 0 : tempCenteredTop;
    const snapLineBottom = hasLayers ? height : tempCenteredTop + printH;

    const snapLineCenterY = hasLayers ? height / 2 : tempPrintCenterY;
    const snapLineLeft = hasLayers ? 0 : tempCenteredLeft;
    const snapLineRight = hasLayers ? width : tempCenteredLeft + printW;

    const verticalSnapLine = new fabric.Line(
      [snapLineCenterX, snapLineTop, snapLineCenterX, snapLineBottom],
      {
        stroke: '#FF0072',
        strokeWidth: 1,
        selectable: false,
        evented: false,
        visible: false,
        excludeFromExport: true,
        data: {id: 'center-line'}
      }
    )
    canvas.add(verticalSnapLine)

    const horizontalSnapLine = new fabric.Line(
      [snapLineLeft, snapLineCenterY, snapLineRight, snapLineCenterY],
      {
        stroke: '#FF0072',
        strokeWidth: 1,
        selectable: false,
        evented: false,
        visible: false,
        excludeFromExport: true,
        data: {id: 'center-line-horizontal'}
      }
    )
    canvas.add(horizontalSnapLine)


    if (hasLayers) {
      initializeLayerColors(side.id, side.layers!);

      const sortedLayers = [...side.layers!].sort((a, b) => a.zIndex - b.zIndex);

      const ensureImageFullyLoaded = async (imageUrl: string, maxRetries = 3): Promise<fabric.FabricImage | null> => {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          if (!isSessionActive()) return null;

          try {
            const nativeImg = new Image();
            nativeImg.crossOrigin = 'anonymous';

            const imageLoadPromise = new Promise<HTMLImageElement>((resolve, reject) => {
              let timeoutId: ReturnType<typeof setTimeout> | null = null;
              nativeImg.onload = () => {
                if (timeoutId) clearTimeout(timeoutId);
                resolve(nativeImg);
              };
              nativeImg.onerror = () => {
                if (timeoutId) clearTimeout(timeoutId);
                reject(new Error(`Failed to load image: ${imageUrl}`));
              };
              timeoutId = setTimeout(() => reject(new Error('Image load timeout')), 30000);
            });

            nativeImg.src = imageUrl;

            const loadedImg = await imageLoadPromise;
            if (!isSessionActive()) return null;

            if (loadedImg.decode) {
              await loadedImg.decode();
            }
            if (!isSessionActive()) return null;

            const imgWidth = loadedImg.naturalWidth;
            const imgHeight = loadedImg.naturalHeight;

            if (imgWidth === 0 || imgHeight === 0) {
              throw new Error(`Invalid dimensions: ${imgWidth}x${imgHeight}`);
            }

            const fabricImg = new fabric.FabricImage(loadedImg, {
              crossOrigin: 'anonymous'
            });
            if (!isSessionActive()) return null;

            if (!fabricImg || fabricImg.width === 0 || fabricImg.height === 0) {
              throw new Error(`Fabric image creation failed or has invalid dimensions`);
            }

            return fabricImg;

          } catch {
            if (attempt === maxRetries) {
              return null;
            }

            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }

        return null;
      };

      const loadLayersSequentially = async () => {
        const validResults: Array<{ img: fabric.FabricImage; scale: number; imgWidth: number; imgHeight: number; layer: ProductLayer }> = [];

        for (const layer of sortedLayers) {
          if (!isSessionActive()) break;

          try {
            const img = await ensureImageFullyLoaded(layer.imageUrl);
            if (!isSessionActive()) break;

            if (!img) {
              continue;
            }

            const imgWidth = img.width || 0;
            const imgHeight = img.height || 0;

            const zoomScale = side.zoomScale || 1.0;
            const baseScale = Math.min(width / imgWidth, height / imgHeight);
            const scale = baseScale * zoomScale;

            img.set({
              scaleX: scale,
              scaleY: scale,
              originX: 'center',
              originY: 'center',
              left: width / 2,
              top: height / 2,
              selectable: false,
              evented: false,
              lockMovementX: true,
              lockMovementY: true,
              lockRotation: true,
              lockScalingX: true,
              lockScalingY: true,
              hasControls: false,
              hasBorders: false,
              ...(layer === sortedLayers[0] && {
                shadow: new fabric.Shadow({
                  color: 'rgba(0,0,0,0.25)',
                  blur: 15,
                  offsetX: 0,
                  offsetY: 4,
                }),
              }),
              data: {
                id: 'background-product-image',
                layerId: layer.id
              },
            });

            layerImagesRef.current.set(layer.id, img);

            validResults.push({ img, scale, imgWidth, imgHeight, layer });
          } catch {
            // continue to next layer
          }
        }

        return validResults;
      };

      loadLayersSequentially().then((validResults) => {
        if (!isSessionActive()) return;

        if (validResults.length === 0) {
          setIsLoading(false);
          return;
        }

        const firstResult = validResults[0]!;
        const { scale, imgWidth, imgHeight } = firstResult;

        sortedLayers.forEach((layer) => {
          const layerImg = layerImagesRef.current.get(layer.id);
          if (layerImg) {
            canvas.add(layerImg);
          }
        });

        for (let i = sortedLayers.length - 1; i >= 0; i--) {
          const layer = sortedLayers[i];
          const layerImg = layerImagesRef.current.get(layer.id);
          if (layerImg) {
            canvas.sendObjectToBack(layerImg);
          }
        }

        const scaledPrintW = side.printArea.width * scale;
        const scaledPrintH = side.printArea.height * scale;
        const scaledPrintX = side.printArea.x * scale;
        const scaledPrintY = side.printArea.y * scale;

        const imageLeft = (width / 2) - (imgWidth * scale / 2);
        const imageTop = (height / 2) - (imgHeight * scale / 2);

        const printAreaLeft = imageLeft + scaledPrintX;
        const printAreaTop = imageTop + scaledPrintY;
        const printCenterX = printAreaLeft + (scaledPrintW / 2);

        verticalSnapLine.set({
          x1: width / 2,
          y1: 0,
          x2: width / 2,
          y2: height,
        });
        horizontalSnapLine.set({
          x1: 0,
          y1: height / 2,
          x2: width,
          y2: height / 2,
        });

        // @ts-expect-error - Custom property
        canvas.printAreaLeft = printAreaLeft;
        // @ts-expect-error - Custom property
        canvas.printAreaTop = printAreaTop;
        // @ts-expect-error - Custom property
        canvas.printAreaWidth = scaledPrintW;
        // @ts-expect-error - Custom property
        canvas.printAreaHeight = scaledPrintH;
        // @ts-expect-error - Custom property
        canvas.printCenterX = printCenterX;
        // @ts-expect-error - Custom property
        canvas.originalImageWidth = imgWidth;
        // @ts-expect-error - Custom property
        canvas.originalImageHeight = imgHeight;
        // @ts-expect-error - Custom property
        canvas.scaledImageWidth = imgWidth * scale;
        // @ts-expect-error - Custom property
        canvas.scaledImageHeight = imgHeight * scale;
        // @ts-expect-error - Custom property
        canvas.realWorldProductWidth = side.realLifeDimensions?.productWidthMm || 500;
        // @ts-expect-error - Custom property
        canvas.mockupCanvasLeft = imageLeft;
        // @ts-expect-error - Custom property
        canvas.mockupCanvasTop = imageTop;
        if (calibrationNativeMmPerPxRef.current > 0) {
          // @ts-expect-error - Custom property
          canvas.calibrationNativeMmPerPx = calibrationNativeMmPerPxRef.current;
        }

        // @ts-expect-error - Custom property
        canvas.printCenterX = width / 2;
        // @ts-expect-error - Custom property
        canvas.printCenterY = height / 2;

        canvas.requestRenderAll();

        requestAnimationFrame(() => {
          if (!isSessionActive()) return;

          markImageLoaded(side.id);
          setLayersReady(true);
          setIsLoading(false);

          if (onCanvasReady) {
            onCanvasReady(canvas, side.id, scale);
          }
        });
      }).catch(() => {
        if (!isSessionActive()) return;
        setIsLoading(false);
      });
    } else {
      const imageUrl = side.imageUrl;
      if (!imageUrl) {
        setIsLoading(false);
        return;
      }

      const loadSingleImage = async () => {
        try {
          const img = await fabric.FabricImage.fromURL(imageUrl, { crossOrigin: 'anonymous' });

          if (!img) {
            return null;
          }

          const imgElement = img.getElement() as HTMLImageElement;

          if (!imgElement.complete) {
            await new Promise<void>((resolve, reject) => {
              imgElement.onload = () => resolve();
              imgElement.onerror = () => reject(new Error('Image failed to load'));
              setTimeout(() => reject(new Error('Image load timeout')), 30000);
            });
          }

          if (imgElement.decode) {
            await imgElement.decode();
          }

          const imgWidth = img.width || 0;
          const imgHeight = img.height || 0;

          if (imgWidth === 0 || imgHeight === 0) {
            return null;
          }

          return img;
        } catch {
          return null;
        }
      };

      loadSingleImage().then((img) => {
        if (!isSessionActive()) return;

        if (!img) {
          setIsLoading(false);
          return;
        }

        const imgWidth = img.width || 0;
        const imgHeight = img.height || 0;

        const zoomScale = side.zoomScale || 1.0;

        const baseScale = Math.min(width / imgWidth, height / imgHeight);
        const scale = baseScale * zoomScale;

        img.set({
          scaleX: scale,
          scaleY: scale,
          originX: 'center',
          originY: 'center',
          left: width / 2,
          top: height / 2,
          selectable: false,
          evented: false,
          lockMovementX: true,
          lockMovementY: true,
          lockRotation: true,
          lockScalingX: true,
          lockScalingY: true,
          hasControls: false,
          hasBorders: false,
          shadow: new fabric.Shadow({
            color: 'rgba(0,0,0,0.25)',
            blur: 15,
            offsetX: 0,
            offsetY: 4,
          }),
          data: { id: 'background-product-image' },
        });

        productImageRef.current = img;

        canvas.add(img);
        canvas.sendObjectToBack(img);

        if (side.colorOptions && side.colorOptions.length > 0) {
          initializeSideColor(side.id, side.colorOptions);
        }

        const currentColor = side.colorOptions && side.colorOptions.length > 0
          ? useCanvasStore.getState().layerColors[side.id]?.[side.id] || side.colorOptions[0]?.hex || '#FFFFFF'
          : (productColorProp ?? useCanvasStore.getState().productColor);
        img.filters = [];
        const initialColorFilter = new fabric.filters.BlendColor({
          color: currentColor,
          mode: 'multiply',
          alpha: 1,
        });
        img.filters.push(initialColorFilter);
        img.applyFilters();

        const scaledPrintW = side.printArea.width * scale;
        const scaledPrintH = side.printArea.height * scale;
        const scaledPrintX = side.printArea.x * scale;
        const scaledPrintY = side.printArea.y * scale;

        const imageLeft = (width / 2) - (imgWidth * scale / 2);
        const imageTop = (height / 2) - (imgHeight * scale / 2);

        const printAreaLeft = imageLeft + scaledPrintX;
        const printAreaTop = imageTop + scaledPrintY;
        const printCenterX = printAreaLeft + (scaledPrintW / 2);
        const printCenterY = printAreaTop + (scaledPrintH / 2);

        verticalSnapLine.set({
          x1: printCenterX,
          y1: printAreaTop,
          x2: printCenterX,
          y2: printAreaTop + scaledPrintH,
        });
        horizontalSnapLine.set({
          x1: printAreaLeft,
          y1: printCenterY,
          x2: printAreaLeft + scaledPrintW,
          y2: printCenterY,
        });

        // @ts-expect-error - Custom property
        canvas.printAreaLeft = printAreaLeft;
        // @ts-expect-error - Custom property
        canvas.printAreaTop = printAreaTop;
        // @ts-expect-error - Custom property
        canvas.printAreaWidth = scaledPrintW;
        // @ts-expect-error - Custom property
        canvas.printAreaHeight = scaledPrintH;
        // @ts-expect-error - Custom property
        canvas.printCenterX = printCenterX;
        // @ts-expect-error - Custom property
        canvas.printCenterY = printCenterY;
        // @ts-expect-error - Custom property
        canvas.originalImageWidth = imgWidth;
        // @ts-expect-error - Custom property
        canvas.originalImageHeight = imgHeight;
        // @ts-expect-error - Custom property
        canvas.scaledImageWidth = imgWidth * scale;
        // @ts-expect-error - Custom property
        canvas.scaledImageHeight = imgHeight * scale;
        // @ts-expect-error - Custom property
        canvas.realWorldProductWidth = side.realLifeDimensions?.productWidthMm || 500;
        // @ts-expect-error - Custom property
        canvas.mockupCanvasLeft = imageLeft;
        // @ts-expect-error - Custom property
        canvas.mockupCanvasTop = imageTop;
        if (calibrationNativeMmPerPxRef.current > 0) {
          // @ts-expect-error - Custom property
          canvas.calibrationNativeMmPerPx = calibrationNativeMmPerPxRef.current;
        }

        canvas.requestRenderAll();

        requestAnimationFrame(() => {
          if (!isSessionActive()) return;

          markImageLoaded(side.id);
          setIsLoading(false);

          if (onCanvasReady) {
            onCanvasReady(canvas, side.id, scale);
          }
        });
      })
      .catch(() => {
        if (!isSessionActive()) return;
        setIsLoading(false);
      });
    }

    const getCanvasMmPerPxOverride = (): number | null => {
      // @ts-expect-error - Custom property
      const sw = canvas.scaledImageWidth as number | undefined;
      // @ts-expect-error - Custom property
      const ow = canvas.originalImageWidth as number | undefined;
      const native = calibrationNativeMmPerPxRef.current;
      if (!native || !sw || !ow) return null;
      return calibrationToCanvasMmPerPx({
        nativeMmPerPx: native,
        scaledImageWidth: sw,
        originalImageWidth: ow,
      });
    };

    const updateScaleBox = (obj: fabric.FabricObject | fabric.ActiveSelection) => {
        // @ts-expect-error - Custom property
        const scaledImageWidth = canvas.scaledImageWidth;
        // @ts-expect-error - Custom property
        const scaledPrintLeft = canvas.printAreaLeft || 0;
        // @ts-expect-error - Custom property
        const scaledPrintTop = canvas.printAreaTop || 0;

        const realWorldProductWidth = side.realLifeDimensions?.productWidthMm || 500;
        const mmPerPxOverride = getCanvasMmPerPxOverride();

        const dimensions = calculateObjectDimensionsMm(obj, {
          scaledImageWidth,
          scaledPrintLeft,
          scaledPrintTop,
          realWorldProductWidth,
          mmPerPxOverride,
        });

        const boundingRect = obj.getBoundingRect();

        setScaleBoxDimensions({
          x: formatMm(dimensions.x),
          y: formatMm(dimensions.y),
          width: formatMm(dimensions.width),
          height: formatMm(dimensions.height),
        });

        setScaleBoxPosition({
          x: boundingRect.left + boundingRect.width / 2,
          y: boundingRect.top + boundingRect.height + 14,
        });

        setScaleBoxVisible(true);
    };

    canvas.on('selection:created', () => {
        const activeObject = canvas.getActiveObject();
        if (activeObject) {
          updateScaleBox(activeObject);
        }
    });

    canvas.on('selection:updated', () => {
        const activeObject = canvas.getActiveObject();
        if (activeObject) {
          updateScaleBox(activeObject);
        }
    });

    canvas.on('selection:cleared', () => {
        setScaleBoxVisible(false);
    });

    const deleteControl = new fabric.Control({
      x: 0.5,
      y: -0.5,
      offsetX: 4,
      offsetY: -4,
      cursorStyle: 'pointer',
      mouseUpHandler: (_eventData, transform) => {
        const target = transform.target;
        const c = target.canvas;
        if (c) {
          c.remove(target);
          c.discardActiveObject();
          c.requestRenderAll();
        }
        return true;
      },
      render: (ctx, left, top) => {
        const size = 20;
        ctx.save();
        ctx.translate(left, top);
        ctx.beginPath();
        ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        const d = 4;
        ctx.beginPath();
        ctx.moveTo(-d, -d);
        ctx.lineTo(d, d);
        ctx.moveTo(d, -d);
        ctx.lineTo(-d, d);
        ctx.stroke();
        ctx.restore();
      },
    });

    canvas.on('object:added', (e) => {
        const obj = e.target;
        // @ts-expect-error - Checking custom data property
        if (!obj || obj.excludeFromExport || (obj.data?.id === 'background-product-image')) return;

        // @ts-expect-error - Setting custom data property
        if (!obj.data) obj.data = {};
        // @ts-expect-error - Setting custom data property
        if (!obj.data.objectId) {
          // @ts-expect-error - Setting custom data property
          obj.data.objectId = `${side.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        }

        // @ts-expect-error - Checking custom data property
        const currentPrintMethod = obj.data.printMethod;

        if (currentPrintMethod === 'printing') {
          // @ts-expect-error - Setting custom data property
          obj.data.printMethod = 'dtf';
        }
        else if (!currentPrintMethod && obj.type !== 'image') {
          // @ts-expect-error - Setting custom data property
          obj.data.printMethod = 'dtf';
        }

        // @ts-expect-error - Custom property
        const scaledImageWidth = canvas.scaledImageWidth;
        const realWorldProductWidth = side.realLifeDimensions?.productWidthMm || 500;
        if (scaledImageWidth) {
          updateObjectDimensionsData(obj, scaledImageWidth, realWorldProductWidth, getCanvasMmPerPxOverride());
        }

        obj.selectable = isEditRef.current;
        obj.evented = isEditRef.current;

        if (isEditRef.current) {
          obj.controls = { ...obj.controls, deleteControl };
        }

        incrementCanvasVersion();
    })

    const snapThreshold = 10;

    canvas.on('object:scaling', (e) => {
        if (e.target) {
          updateScaleBox(e.target);
          // @ts-expect-error - Custom property
          const scaledImageWidth = canvas.scaledImageWidth;
          const realWorldProductWidth = side.realLifeDimensions?.productWidthMm || 500;
          if (scaledImageWidth) {
            updateObjectDimensionsData(e.target, scaledImageWidth, realWorldProductWidth, getCanvasMmPerPxOverride());
          }
        }
    });

    canvas.on('object:rotating', (e) => {
        if (e.target) {
          updateScaleBox(e.target);
          // @ts-expect-error - Custom property
          const scaledImageWidth = canvas.scaledImageWidth;
          const realWorldProductWidth = side.realLifeDimensions?.productWidthMm || 500;
          if (scaledImageWidth) {
            updateObjectDimensionsData(e.target, scaledImageWidth, realWorldProductWidth, getCanvasMmPerPxOverride());
          }
        }
    });

    canvas.on('object:modified', (e) => {
        if (e.target) {
          updateScaleBox(e.target);
          // @ts-expect-error - Custom property
          const scaledImageWidth = canvas.scaledImageWidth;
          const realWorldProductWidth = side.realLifeDimensions?.productWidthMm || 500;
          if (scaledImageWidth) {
            updateObjectDimensionsData(e.target, scaledImageWidth, realWorldProductWidth, getCanvasMmPerPxOverride());
          }
        }
        incrementCanvasVersion();
    });

    canvas.on('object:removed', (e) => {
        const obj = e.target;
        // @ts-expect-error - Checking custom data property
        if (!obj || obj.excludeFromExport || (obj.data?.id === 'background-product-image')) return;

        incrementCanvasVersion();
    });

    canvas.on('object:moving', (e) => {
        const obj = e.target;
        if (!obj) return;

        updateScaleBox(obj);

        const objCenter = obj.getCenterPoint();

        // @ts-expect-error - Custom property
        const currentPrintCenterX = canvas.printCenterX || tempPrintCenterX;
        // @ts-expect-error - Custom property
        const currentPrintCenterY = canvas.printCenterY || tempPrintCenterY;

        let deltaX = 0;
        let deltaY = 0;

        if (Math.abs(objCenter.x - currentPrintCenterX) < snapThreshold) {
          deltaX = currentPrintCenterX - objCenter.x;
          verticalSnapLine.set('visible', true);
        } else {
          verticalSnapLine.set('visible', false);
        }

        if (Math.abs(objCenter.y - currentPrintCenterY) < snapThreshold) {
          deltaY = currentPrintCenterY - objCenter.y;
          horizontalSnapLine.set('visible', true);
        } else {
          horizontalSnapLine.set('visible', false);
        }

        if (deltaX !== 0 || deltaY !== 0) {
          obj.set({
            left: (obj.left || 0) + deltaX,
            top: (obj.top || 0) + deltaY,
          });
          obj.setCoords();
        }

        canvas.requestRenderAll();
    });

    canvas.on('mouse:up', () => {
        verticalSnapLine.set('visible', false);
        horizontalSnapLine.set('visible', false);
        canvas.requestRenderAll();
    });

    return () => {
      isDisposed = true;
      loadSessionRef.current++;
      unregisterCanvas(side.id);
      canvas.off('mouse:down', handleMouseDown);
      canvas.off('mouse:move', handleMouseMove);
      canvas.off('mouse:up', handleMouseUp);
      canvas.off('mouse:wheel', handleWheel);
      upperEl.removeEventListener('mouseenter', handleUpperMouseEnter);
      upperEl.removeEventListener('mouseleave', handleUpperMouseLeave);
      upperEl.removeEventListener('touchstart', handleTouchStart);
      upperEl.removeEventListener('touchmove', handleTouchMove);
      upperEl.removeEventListener('touchend', handleTouchEnd);
      upperEl.removeEventListener('touchcancel', handleTouchEnd);
      window.removeEventListener('keydown', handleWindowKeyDown);
      window.removeEventListener('keyup', handleWindowKeyUp);
      window.removeEventListener('mouseup', handleWindowMouseUp);
      window.removeEventListener('blur', handleWindowBlur);
      canvas.dispose();
      canvasRef.current = null;
    };
  }, [side, height, width, registerCanvas, unregisterCanvas, markImageLoaded, incrementCanvasVersion, initializeLayerColors, initializeSideColor]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    resetZoom(side.id);

    canvas.selection = isEdit;
    canvas.forEachObject((obj) => {
      if (obj.excludeFromExport) return;

      // @ts-expect-error - Checking custom data property
      if (obj.data?.id === 'background-product-image') {
        obj.selectable = false;
        obj.evented = false;
        return;
      }

      obj.selectable = isEdit;
      obj.evented = isEdit;
    });
    canvas.requestRenderAll();
  }, [isEdit, side.id, resetZoom]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (side.layers && side.layers.length > 0) return;

    const selectedColor = side.colorOptions && side.colorOptions.length > 0
      ? layerColors[side.id]?.[side.id] || side.colorOptions[0]?.hex || '#FFFFFF'
      : productColor;

    canvas.forEachObject((obj) => {
      // @ts-expect-error - Checking custom data property
      if (obj.data?.id === 'background-product-image' && obj.type === 'image') {
        const imgObj = obj as fabric.FabricImage;

        imgObj.filters = [];

        const colorFilter = new fabric.filters.BlendColor({
          color: selectedColor,
          mode: 'multiply',
          alpha: 1,
        });

        imgObj.filters.push(colorFilter);
        imgObj.applyFilters();
      }
    });

    canvas.requestRenderAll();
  }, [productColor, side.layers, side.colorOptions, side.id, layerColors]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!side.layers || side.layers.length === 0) return;

    if (!layersReady) {
      return;
    }

    const layerImagesById = new Map<string, fabric.FabricImage[]>();
    canvas.getObjects().forEach((obj) => {
      if (obj.type !== 'image') return;
      // @ts-expect-error - Checking custom data property
      const dataId = obj.data?.id;
      // @ts-expect-error - Checking custom data property
      const dataLayerId = obj.data?.layerId as string | undefined;
      if (dataId !== 'background-product-image' || !dataLayerId) return;
      const list = layerImagesById.get(dataLayerId) || [];
      list.push(obj as fabric.FabricImage);
      layerImagesById.set(dataLayerId, list);
    });

    side.layers.forEach((layer) => {
      const canvasLayerImages = layerImagesById.get(layer.id) || [];
      const refLayerImage = layerImagesRef.current.get(layer.id);
      const layerImages = canvasLayerImages.length > 0
        ? canvasLayerImages
        : (refLayerImage ? [refLayerImage] : []);

      if (layerImages.length === 0) {
        return;
      }

      const selectedColor = layerColors[side.id]?.[layer.id] || layer.colorOptions[0]?.hex || '#FFFFFF';

      layerImages.forEach((layerImg) => {
        layerImg.filters = [];

        const colorFilter = new fabric.filters.BlendColor({
          color: selectedColor,
          mode: 'multiply',
          alpha: 1,
        });

        layerImg.filters.push(colorFilter);
        layerImg.applyFilters();
      });
    });

    canvas.requestRenderAll();
  }, [layerColors, side.id, side.layers, layersReady]);

  return (
    <div className="relative" style={{ width, height }}>
      <div
        className="absolute inset-0 flex items-center justify-center bg-[#EBEBEB] transition-opacity duration-300"
        style={{ width, height, opacity: isLoading ? 1 : 0, pointerEvents: isLoading ? 'auto' : 'none' }}
      >
        <div className="flex flex-col items-center gap-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          <p className="text-sm text-gray-600">불러오는중...</p>
        </div>
      </div>
      <canvas
        ref={canvasEl}
        style={{ opacity: isLoading ? 0 : 1, transition: 'opacity 0.3s', touchAction: 'none' }}
      />
      {showScaleBox && (
        <ScaleBox
          x={scaleBoxDimensions.x}
          y={scaleBoxDimensions.y}
          width={scaleBoxDimensions.width}
          height={scaleBoxDimensions.height}
          position={scaleBoxPosition}
          visible={scaleBoxVisible}
        />
      )}
    </div>
  )
}

export default SingleSideCanvas;
