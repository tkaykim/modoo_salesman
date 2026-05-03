/**
 * Storage bucket configuration for Supabase
 *
 * Buckets needed:
 * - user-designs: For storing user-uploaded images and design assets
 * - text-exports: For storing exported SVG files from text objects
 */

export const STORAGE_BUCKETS = {
  USER_DESIGNS: 'user-designs',
  TEXT_EXPORTS: 'text-exports',
  FONTS: 'user-fonts',
} as const;

export const STORAGE_FOLDERS = {
  IMAGES: 'images',
  TEXTS: 'texts',
  SVG: 'svg',
  FONTS: 'fonts',
} as const;

/**
 * Get the full path for an upload
 * @param bucket - Bucket name
 * @param folder - Folder name
 * @returns Full bucket/folder path
 */
export function getStoragePath(bucket: string, folder?: string): { bucket: string; folder?: string } {
  return { bucket, folder };
}
