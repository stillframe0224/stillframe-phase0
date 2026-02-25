/** SHINEN v17 type definitions */

export interface ShinenCard {
  id: number;
  type: number;
  text: string;
  px: number;
  py: number;
  z: number;
  /** Custom card width (overrides default). Set by resize grip. */
  w?: number;
  /** Custom card height (overrides auto). Set by resize grip. */
  h?: number;
  source?: {
    url: string;
    site: string;
    favicon?: string;
  };
  media?: {
    type: "image" | "video" | "audio" | "youtube" | "pdf" | "embed";
    kind?: "image" | "embed";
    url: string;
    thumbnail?: string;
    posterUrl?: string;
    embedUrl?: string;
    provider?: "youtube" | "x" | "instagram";
    duration?: number;
    youtubeId?: string;
  };
  file?: {
    name: string;
    size: number;
    mimeType: string;
  };
  createdAt?: number;
}

export interface Projection {
  sx: number;
  sy: number;
  s: number;
  z2: number;
}

export interface DragState {
  id: number;
  startMX: number;
  startMY: number;
  origPX: number;
  origPY: number;
}

export interface GroupDragState {
  startMX: number;
  startMY: number;
  origins: Map<number, { px: number; py: number }>;
}

export interface CamDragState {
  startMX: number;
  startMY: number;
  origRx: number;
  origRy: number;
}

export interface SelectionRect {
  startX: number;
  startY: number;
  curX: number;
  curY: number;
}

export interface CameraState {
  rx: number;
  ry: number;
}

// DB上のカード型（Supabase返却値）
export interface DbCard {
  id: string;
  user_id: string;
  type: string;
  text: string;
  px: number;
  py: number;
  z: number;
  source: { url: string; site: string; favicon?: string } | null;
  media: {
    type: string;
    kind?: string;
    url: string;
    thumbnail?: string;
    posterUrl?: string;
    embedUrl?: string;
    provider?: string;
    duration?: number;
    youtubeId?: string;
  } | null;
  file: { name: string; size: number; mimeType: string } | null;
  created_at: string;
  updated_at: string;
}
