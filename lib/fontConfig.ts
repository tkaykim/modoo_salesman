/**
 * Shared font configuration — single source of truth for system fonts.
 */

export interface SystemFontConfig {
  fontFamily: string;
  localFontPath: string | null;
}

export const SYSTEM_FONTS: SystemFontConfig[] = [
  { fontFamily: 'Freshman', localFontPath: '/fonts/Freshman.ttf' },
  { fontFamily: 'Arial', localFontPath: null },
  { fontFamily: 'Times New Roman', localFontPath: null },
  { fontFamily: 'Courier New', localFontPath: null },
  { fontFamily: 'Georgia', localFontPath: null },
  { fontFamily: 'Verdana', localFontPath: null },
  { fontFamily: 'Helvetica', localFontPath: null },
  { fontFamily: 'Comic Sans MS', localFontPath: null },
  { fontFamily: 'Impact', localFontPath: null },
  { fontFamily: 'Trebuchet MS', localFontPath: null },
  { fontFamily: 'Palatino', localFontPath: null },
];

/** Font family names for UI dropdowns */
export const SYSTEM_FONT_NAMES: string[] = SYSTEM_FONTS.map((f) => f.fontFamily);

/** fontFamily → local TTF path (or null). */
export const SYSTEM_FONT_PATH_MAP: Record<string, string | null> =
  Object.fromEntries(SYSTEM_FONTS.map((f) => [f.fontFamily, f.localFontPath]));
