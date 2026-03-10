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

  if (error) throw error;
  return (data ?? []) as DbCard[];
}

export async function insertCard(card: NewDbCard): Promise<DbCard> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("cards")
    .insert({ ...card, user_id: user.id })
    .select()
    .single();

  if (error) throw error;
  return data as DbCard;
}

export async function updateCard(id: string, updates: DbCardUpdates): Promise<void> {
  const { error } = await supabase.from("cards").update(updates).eq("id", id);
  if (error) throw error;
}

export async function deleteCards(ids: string[]): Promise<void> {
  const { error } = await supabase.from("cards").delete().in("id", ids);
  if (error) throw error;
}

export async function uploadFile(cardId: string, file: File): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const path = `${user.id}/${cardId}/${file.name}`;
  const { error } = await supabase.storage.from("shinen-files").upload(path, file, { upsert: true });

  if (error) throw error;

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
