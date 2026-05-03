/**
 * Minimal AnchorPreset type stub for modoo_salesman.
 * Full anchor snap/panel functionality is not included in the salesman editor.
 * This file only provides the type definition used by calibrationFetch.ts.
 */

export interface AnchorPreset {
  id: string;
  xMm: number;
  yMm: number;
  recommendedWidthMm: number;
  recommendedHeightMm: number;
  label?: string;
}
