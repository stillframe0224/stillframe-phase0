import { createClient } from "@/utils/supabase/client";
import type { DbCard } from "./types";

const supabase = createClient();

type NewDbCard = Omit<DbCard, "id" | "user_id" | "created_at" | "updated_at">;
type DbCardUpdates = Partial<NewDbCard>;

export async function fetchCards(): Promise<DbCard[]> {
  const { data, error } = await supabase
    .from("cards")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[Card Error] fetchCards failed:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    throw error;
  }
  return (data ?? []) as DbCard[];
}

export async function insertCard(card: NewDbCard): Promise<DbCard> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error("[Card Error] Auth check failed:", {
      code: authError.code,
      message: authError.message,
    });
    throw authError;
  }

  if (!user) {
    console.error("[Card Error] No authenticated user");
    throw new Error("Not authenticated");
  }

  const { data, error } = await supabase
    .from("cards")
    .insert({ ...card, user_id: user.id })
    .select()
    .single();

  if (error) {
    console.error("[Card Error] Insert failed:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      cardType: card.type,
      hasMedia: !!card.media,
      hasSource: !!card.source,
    });
    throw error;
  }
  return data as DbCard;
}

export async function updateCard(id: string, updates: DbCardUpdates): Promise<void> {
  const { error } = await supabase.from("cards").update(updates).eq("id", id);
  if (error) {
    console.error("[Card Error] Update failed:", {
      cardId: id,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      updateKeys: Object.keys(updates),
    });
    throw error;
  }
}

export async function deleteCards(ids: string[]): Promise<void> {
  const { error } = await supabase.from("cards").delete().in("id", ids);
  if (error) {
    console.error("[Card Error] Delete failed:", {
      cardIds: ids,
      count: ids.length,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    throw error;
  }
}

export async function uploadFile(cardId: string, file: File): Promise<string> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error("[Card Error] Auth check failed (upload):", {
      code: authError.code,
      message: authError.message,
    });
    throw authError;
  }

  if (!user) {
    console.error("[Card Error] No authenticated user (upload)");
    throw new Error("Not authenticated");
  }

  const path = `${user.id}/${cardId}/${file.name}`;
  const { error } = await supabase.storage.from("shinen-files").upload(path, file, { upsert: true });

  if (error) {
    console.error("[Card Error] File upload failed:", {
      cardId,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      code: error.message,
    });
    throw error;
  }

  const { data } = supabase.storage.from("shinen-files").getPublicUrl(path);
  return data.publicUrl;
}

export function subscribeToCards(
  onInsert: (card: DbCard) => void,
  onUpdate: (card: DbCard) => void,
  onDelete: (id: string) => void,
) {
  return supabase
    .channel("cards-realtime")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "cards" }, (payload) =>
      onInsert(payload.new as DbCard),
    )
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "cards" }, (payload) =>
      onUpdate(payload.new as DbCard),
    )
    .on("postgres_changes", { event: "DELETE", schema: "public", table: "cards" }, (payload) =>
      onDelete((payload.old as { id: string }).id),
    )
    .subscribe();
}
