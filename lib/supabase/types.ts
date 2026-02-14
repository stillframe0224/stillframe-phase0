export interface Card {
  id: string;
  user_id: string;
  text: string;
  card_type: string;
  image_url: string | null;
  image_source: "ogp" | "upload" | "generated" | null;
  client_request_id: string | null;
  pinned: boolean | null;
  title?: string | null;
  source_url?: string | null;
  site_name?: string | null;
  preview_image_url?: string | null;
  media_kind?: string | null;
  media_path?: string | null;
  media_thumb_path?: string | null;
  media_mime?: string | null;
  media_size?: number | null;
  notes?: string | null;
  sort_key?: string | null;
  file_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface File {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}
