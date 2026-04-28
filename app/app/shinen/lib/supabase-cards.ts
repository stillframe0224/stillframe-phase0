import { createClient } from "@/utils/supabase/client";
import { logSupabaseError } from "@/lib/supabase/logger";
import type { DbCard } from "./types";

const supabase = createClient();

type NewDbCard = Omit<DbCard, "id" | "user_id" | "created_at" | "updated_at">;
type DbCardUpdates = Partial<NewDbCard>;

export async function fetchCards(): Promise<DbCard[]> {
  try {
    const { data, error } = await supabase
      .from("cards")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      const { data: { user } } = await supabase.auth.getUser();
      logSupabaseError("fetchCards", error, user?.id);
      throw error;
    }
    return (data ?? []) as DbCard[];
  } catch (error) {
    const { data: { user } } = await supabase.auth.getUser();
    logSupabaseError("fetchCards:exception", error, user?.id);
    throw error;
  }
}

export async function insertCard(card: NewDbCard): Promise<DbCard> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      const authError = new Error("Not authenticated");
      logSupabaseError("insertCard:auth", authError, null);
      throw authError;
    }

    const { data, error } = await supabase
      .from("cards")
      .insert({ ...card, user_id: user.id })
      .select()
      .single();

    if (error) {
      // Log with card details for debugging
      const errorWithContext = {
        ...error,
        cardType: card.type,
        cardText: card.text?.slice(0, 50), // First 50 chars for context
        hasMedia: !!card.media,
      };
      logSupabaseError("insertCard", errorWithContext, user.id);
      throw error;
    }
    return data as DbCard;
  } catch (error) {
    const { data: { user } } = await supabase.auth.getUser();
    logSupabaseError("insertCard:exception", error, user?.id);
    throw error;
  }
}

export async function updateCard(id: string, updates: DbCardUpdates): Promise<void> {
  try {
    const { error } = await supabase.from("cards").update(updates).eq("id", id);
    if (error) {
      const { data: { user } } = await supabase.auth.getUser();
      const errorWithContext = { ...error, cardId: id };
      logSupabaseError("updateCard", errorWithContext, user?.id);
      throw error;
    }
  } catch (error) {
    const { data: { user } } = await supabase.auth.getUser();
    const errorWithContext = { error, cardId: id };
    logSupabaseError("updateCard:exception", errorWithContext, user?.id);
    throw error;
  }
}

export async function deleteCards(ids: string[]): Promise<void> {
  try {
    const { error } = await supabase.from("cards").delete().in("id", ids);
    if (error) {
      const { data: { user } } = await supabase.auth.getUser();
      const errorWithContext = { ...error, cardIds: ids };
      logSupabaseError("deleteCards", errorWithContext, user?.id);
      throw error;
    }
  } catch (error) {
    const { data: { user } } = await supabase.auth.getUser();
    const errorWithContext = { error, cardIds: ids };
    logSupabaseError("deleteCards:exception", errorWithContext, user?.id);
    throw error;
  }
}

export async function uploadFile(cardId: string, file: File): Promise<string> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      const authError = new Error("Not authenticated");
      logSupabaseError("uploadFile:auth", authError, null);
      throw authError;
    }

    const path = `${user.id}/${cardId}/${file.name}`;
    const { error } = await supabase.storage.from("shinen-files").upload(path, file, { upsert: true });

    if (error) {
      const errorWithContext = {
        ...error,
        cardId,
        fileName: file.name,
        fileSize: file.size,
        fileMimeType: file.type,
      };
      logSupabaseError("uploadFile", errorWithContext, user.id);
      throw error;
    }

    const { data } = supabase.storage.from("shinen-files").getPublicUrl(path);
    return data.publicUrl;
  } catch (error) {
    const { data: { user } } = await supabase.auth.getUser();
    const errorWithContext = { error, cardId, fileName: file.name };
    logSupabaseError("uploadFile:exception", errorWithContext, user?.id);
    throw error;
  }
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
