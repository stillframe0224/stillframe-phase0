// Supabase Storage bucket names
export const STORAGE_BUCKETS = {
  CARD_IMAGES: "card-images", // Legacy: user-uploaded images (deprecated, use CARDS_MEDIA)
  CARDS_MEDIA: "cards-media", // Current: uploaded images and videos with thumbnails
} as const;
