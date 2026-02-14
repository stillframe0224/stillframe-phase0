export interface Card {
  id: string;
  user_id: string;
  text: string;
  card_type: string;
  image_url: string | null;
  image_source: "ogp" | "upload" | "generated" | null;
  client_request_id: string | null;
  created_at: string;
  updated_at: string;
}
