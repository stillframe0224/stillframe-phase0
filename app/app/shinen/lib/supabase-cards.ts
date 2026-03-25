import { createClient } from "@/utils/supabase/client";
import type { DbCard } from "./types";

const supabase = createClient();

type NewDbCard = Omit<DbCard, "id" | "user_id" | "created_at" | "updated_at">;
type DbCardUpdates = Partial<NewDbCard>;

function logSupabaseError(operation: string, error: unknown, context?: Record<string, unknown>) {
  const errorData = {
    source: "supabase-cards",
    operation,
    error: error instanceof Error ? error.message : String(error),
    errorCode: (error as { code?: string })?.code,
    errorDetails: (error as { details?: string })?.details,
    timestamp: new Date().toISOString(),
    ...context,
  };
  console.error('[Supabase Error]', JSON.stringify(errorData));
}

export async function fetchCards(): Promise<DbCard[]> {
  const { data, error } = await supabase
    .from("cards")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    logSupabaseError("fetchCards", error);
    throw error;
  }
  return (data ?? []) as DbCard[];
}

export async function insertCard(card: NewDbCard): Promise<DbCard> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const authError = new Error("Not authenticated");
    logSupabaseError("insertCard", authError, { step: "auth_check" });
    throw authError;
  }

  const { data, error } = await supabase
    .from("cards")
    .insert({ ...card, user_id: user.id })
    .select()
    .single();

  if (error) {
    logSupabaseError("insertCard", error, {
      cardType: card.type,
      hasMedia: !!card.media,
      hasSource: !!card.source,
      userId: user.id,
    });
    throw error;
  }
  return data as DbCard;
}

export async function updateCard(id: string, updates: DbCardUpdates): Promise<void> {
  const { error } = await supabase.from("cards").update(updates).eq("id", id);
  if (error) {
    logSupabaseError("updateCard", error, {
      cardId: id,
      updateFields: Object.keys(updates),
    });
    throw error;
  }
}

export async function deleteCards(ids: string[]): Promise<void> {
  const { error } = await supabase.from("cards").delete().in("id", ids);
  if (error) {
    logSupabaseError("deleteCards", error, {
      cardCount: ids.length,
    });
    throw error;
  }
}

export async function uploadFile(cardId: string, file: File): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const authError = new Error("Not authenticated");
    logSupabaseError("uploadFile", authError, { step: "auth_check", cardId });
    throw authError;
  }

  const path = `${user.id}/${cardId}/${file.name}`;
  const { error } = await supabase.storage.from("shinen-files").upload(path, file, { upsert: true });

  if (error) {
    logSupabaseError("uploadFile", error, {
      cardId,
      fileName: file.name,
      fileSize: file.size,
      filePath: path,
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
