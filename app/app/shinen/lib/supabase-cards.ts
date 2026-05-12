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
      logSupabaseError("fetchCards", error);
      throw error;
    }
    return (data ?? []) as DbCard[];
  } catch (error) {
    logSupabaseError("fetchCards", error);
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
      logSupabaseError("insertCard:auth", authError);
      throw authError;
    }

    const { data, error } = await supabase
      .from("cards")
      .insert({ ...card, user_id: user.id })
      .select()
      .single();

    if (error) {
      logSupabaseError("insertCard:insert", error, user.id);
      throw error;
    }
    return data as DbCard;
  } catch (error) {
    if (!(error instanceof Error && error.message === "Not authenticated")) {
      logSupabaseError("insertCard", error);
    }
    throw error;
  }
}

export async function updateCard(id: string, updates: DbCardUpdates): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from("cards").update(updates).eq("id", id);
    if (error) {
      logSupabaseError("updateCard", error, user?.id);
      throw error;
    }
  } catch (error) {
    logSupabaseError("updateCard", error);
    throw error;
  }
}

export async function deleteCards(ids: string[]): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from("cards").delete().in("id", ids);
    if (error) {
      logSupabaseError("deleteCards", error, user?.id);
      throw error;
    }
  } catch (error) {
    logSupabaseError("deleteCards", error);
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
      logSupabaseError("uploadFile:auth", authError);
      throw authError;
    }

    const path = `${user.id}/${cardId}/${file.name}`;
    const { error } = await supabase.storage.from("shinen-files").upload(path, file, { upsert: true });

    if (error) {
      logSupabaseError("uploadFile:storage", error, user.id);
      throw error;
    }

    const { data } = supabase.storage.from("shinen-files").getPublicUrl(path);
    return data.publicUrl;
  } catch (error) {
    if (!(error instanceof Error && error.message === "Not authenticated")) {
      logSupabaseError("uploadFile", error);
    }
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
