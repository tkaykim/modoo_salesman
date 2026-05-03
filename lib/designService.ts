/**
 * Design service for modoo_salesman.
 * Stripped version: no SVG/text export, no font cleanup on delete.
 * Saves canvas_state + preview_url + image_urls to saved_designs table.
 */
import { createClient } from './supabase-client';
import { FontMetadata } from './fontUtils';
import { formatKstDateTimeMedium } from './kst';

export interface SaveDesignData {
  productId: string;
  title?: string;
  productColor: string;
  canvasState: Record<string, string>;
  userId?: string;
  previewImage?: string; // Base64 data URL for preview image
  pricePerItem: number;
  customFonts?: FontMetadata[]; // Custom fonts used in the design
}

export interface SavedDesign {
  id: string;
  user_id: string;
  product_id: string;
  title: string | null;
  color_selections: {
    productColor: string;
  };
  canvas_state: Record<string, string>;
  preview_url: string | null;
  image_urls?: Record<string, Array<{ url: string; path?: string; uploadedAt?: string }>>;
  custom_fonts?: FontMetadata[];
  created_at: string;
  updated_at: string;
}

/**
 * Extract image URLs from canvas state for storage references
 */
function extractImageUrlsFromCanvasState(
  canvasState: Record<string, string>
): Record<string, Array<{ url: string }>> {
  const imageUrls: Record<string, Array<{ url: string }>> = {};

  for (const [sideId, stateJson] of Object.entries(canvasState)) {
    try {
      const state = JSON.parse(stateJson);
      const objects = state.objects || [];
      const sideImages: Array<{ url: string }> = [];

      for (const obj of objects) {
        if (obj.type === 'image' && obj.src) {
          sideImages.push({ url: obj.src });
        }
        // Also check data.supabaseUrl
        if (obj.data?.supabaseUrl) {
          sideImages.push({ url: obj.data.supabaseUrl });
        }
      }

      if (sideImages.length > 0) {
        imageUrls[sideId] = sideImages;
      }
    } catch {
      // ignore parse errors
    }
  }

  return imageUrls;
}

/**
 * Save a design to Supabase
 */
export async function saveDesign(data: SaveDesignData): Promise<SavedDesign | null> {
  const supabase = createClient();

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('User not authenticated:', userError);
      throw new Error('User must be authenticated to save designs');
    }

    const imageUrls = extractImageUrlsFromCanvasState(data.canvasState);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const designData: any = {
      user_id: user.id,
      product_id: data.productId,
      title: data.title || `Design ${formatKstDateTimeMedium(new Date())}`,
      color_selections: {
        productColor: data.productColor,
      },
      canvas_state: data.canvasState,
      preview_url: data.previewImage || null,
      image_urls: imageUrls,
      price_per_item: data.pricePerItem,
      custom_fonts: data.customFonts || [],
    };

    const { data: savedDesign, error: insertError } = await supabase
      .from('saved_designs')
      .insert(designData)
      .select()
      .single();

    if (insertError) {
      console.error('Error saving design:', insertError);
      throw insertError;
    }

    return savedDesign;
  } catch (error) {
    console.error('Failed to save design:', error);
    return null;
  }
}

/**
 * Load a design from Supabase by ID
 */
export async function loadDesign(designId: string): Promise<SavedDesign | null> {
  const supabase = createClient();

  try {
    const { data: design, error } = await supabase
      .from('saved_designs')
      .select('*')
      .eq('id', designId)
      .single();

    if (error) {
      console.error('Error loading design:', error);
      throw error;
    }

    return design;
  } catch (error) {
    console.error('Failed to load design:', error);
    return null;
  }
}

/**
 * Get all saved designs for the current user
 */
export async function getUserDesigns(): Promise<SavedDesign[]> {
  const supabase = createClient();

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('User not authenticated:', userError);
      return [];
    }

    const { data: designs, error } = await supabase
      .from('saved_designs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching designs:', error);
      throw error;
    }

    return designs || [];
  } catch (error) {
    console.error('Failed to fetch user designs:', error);
    return [];
  }
}

/**
 * Delete a design record (simplified — no storage cleanup)
 */
export async function deleteDesign(designId: string): Promise<boolean> {
  const supabase = createClient();

  try {
    const { error: deleteError } = await supabase
      .from('saved_designs')
      .delete()
      .eq('id', designId);

    if (deleteError) {
      console.error('Error deleting design:', deleteError);
      throw deleteError;
    }

    return true;
  } catch (error) {
    console.error('Failed to delete design:', error);
    return false;
  }
}
