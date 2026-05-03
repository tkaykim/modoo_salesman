import { SupabaseClient } from '@supabase/supabase-js';
import { uploadFileToStorage, deleteFileFromStorage, UploadResult } from './supabase-storage';
import { STORAGE_BUCKETS, STORAGE_FOLDERS } from './storage-config';

export interface FontMetadata {
  fontFamily: string; // Display name/family name
  fileName: string; // Original file name
  url: string; // Public URL from Supabase
  path: string; // Storage path for deletion
  uploadedAt: string; // ISO timestamp
  format: 'ttf' | 'otf' | 'woff' | 'woff2'; // Font format
}

/**
 * Supported font file extensions
 */
const SUPPORTED_FONT_EXTENSIONS = ['ttf', 'otf', 'woff', 'woff2'] as const;

/**
 * Check if a file is a valid font file
 */
export function isValidFontFile(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase();
  return SUPPORTED_FONT_EXTENSIONS.includes(ext as 'ttf' | 'otf' | 'woff' | 'woff2');
}

/**
 * Upload a font file to Supabase Storage
 */
export async function uploadFont(
  supabase: SupabaseClient,
  fontFile: File,
  designId?: string
): Promise<{ success: boolean; fontMetadata?: FontMetadata; error?: string }> {
  try {
    if (!isValidFontFile(fontFile)) {
      return {
        success: false,
        error: 'Invalid font file. Supported formats: .ttf, .otf, .woff, .woff2',
      };
    }

    const fontFamily = fontFile.name.replace(/\.(ttf|otf|woff|woff2)$/i, '');
    const format = fontFile.name.split('.').pop()?.toLowerCase() as FontMetadata['format'];

    const timestamp = Date.now();
    const uniqueId = Math.random().toString(36).substring(7);
    const designPrefix = designId ? `${designId}-` : '';
    const fileName = `${designPrefix}${timestamp}-${uniqueId}.${format}`;

    // uploadFileToStorage auto-generates a unique filename internally;
    // our computed fileName is kept in fontMetadata for reference only.
    void fileName;
    const uploadResult: UploadResult = await uploadFileToStorage(
      supabase,
      fontFile,
      STORAGE_BUCKETS.FONTS,
      STORAGE_FOLDERS.FONTS
    );

    if (!uploadResult.success || !uploadResult.url || !uploadResult.path) {
      return {
        success: false,
        error: uploadResult.error || 'Failed to upload font',
      };
    }

    const fontMetadata: FontMetadata = {
      fontFamily,
      fileName: fontFile.name,
      url: uploadResult.url,
      path: uploadResult.path,
      uploadedAt: new Date().toISOString(),
      format,
    };

    return {
      success: true,
      fontMetadata,
    };
  } catch (error) {
    console.error('Error uploading font:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Load a custom font dynamically using FontFace API
 */
export async function loadCustomFont(fontMetadata: FontMetadata): Promise<void> {
  try {
    const existingFonts = document.fonts;
    const alreadyLoaded = Array.from(existingFonts).some(
      (font) => font.family === fontMetadata.fontFamily
    );

    if (alreadyLoaded) {
      return;
    }

    const fontFace = new FontFace(fontMetadata.fontFamily, `url(${fontMetadata.url})`);
    const loadedFont = await fontFace.load();
    document.fonts.add(loadedFont);
  } catch (error) {
    console.error(`Failed to load font "${fontMetadata.fontFamily}":`, error);
    throw error;
  }
}

/**
 * Load multiple custom fonts
 */
export async function loadCustomFonts(fonts: FontMetadata[]): Promise<void> {
  const loadPromises = fonts.map((font) => loadCustomFont(font));
  await Promise.all(loadPromises);
}

/**
 * Delete a font file from storage
 */
export async function deleteFont(
  supabase: SupabaseClient,
  fontPath: string
): Promise<{ success: boolean; error?: string }> {
  return await deleteFileFromStorage(supabase, STORAGE_BUCKETS.FONTS, fontPath);
}

/**
 * Delete multiple font files from storage
 */
export async function deleteFonts(
  supabase: SupabaseClient,
  fontPaths: string[]
): Promise<{ success: boolean; errors: string[] }> {
  const results = await Promise.all(
    fontPaths.map((path) => deleteFont(supabase, path))
  );

  const errors = results
    .filter((result) => !result.success)
    .map((result) => result.error || 'Unknown error');

  return {
    success: errors.length === 0,
    errors,
  };
}
