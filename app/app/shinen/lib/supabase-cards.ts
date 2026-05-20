import { createClient } from "@/utils/supabase/client";
import type { DbCard } from "./types";

const supabase = createClient();

type NewDbCard = Omit<DbCard, "id" | "user_id" | "created_at" | "updated_at">;
type DbCardUpdates = Partial<NewDbCard>;

// User-friendly error messages
class CardError extends Error {
  constructor(
    message: string,
    public code?: string,
    public originalError?: unknown,
  ) {
    super(message);
    this.name = "CardError";
  }
}

function parseSupabaseError(error: unknown): CardError {
  if (typeof error === "object" && error !== null) {
    const err = error as { code?: string; message?: string; details?: string };

    // Authentication errors
    if (err.code === "PGRST301" || err.message?.includes("JWT")) {
      return new CardError("セッションが切れました。ページを更新してください", "AUTH_EXPIRED", error);
    }

    // Network errors
    if (err.message?.includes("fetch") || err.message?.includes("network")) {
      return new CardError("ネットワークエラー。接続を確認してください", "NETWORK_ERROR", error);
    }

    // Validation errors
    if (err.code?.startsWith("23") || err.message?.includes("violates")) {
      return new CardError("入力内容に問題があります。もう一度お試しください", "VALIDATION_ERROR", error);
    }

    // Permission errors
    if (err.code === "42501" || err.message?.includes("permission")) {
      return new CardError("この操作を行う権限がありません", "PERMISSION_DENIED", error);
    }

    // Generic Postgres errors
    if (err.code || err.details) {
      console.error("Supabase error:", { code: err.code, message: err.message, details: err.details });
      return new CardError("カードの保存に失敗しました。しばらくしてからお試しください", "DB_ERROR", error);
    }
  }

  // Unknown errors
  console.error("Unknown card error:", error);
  return new CardError("予期しないエラーが発生しました", "UNKNOWN_ERROR", error);
}

export async function fetchCards(): Promise<DbCard[]> {
  try {
    const { data, error } = await supabase
      .from("cards")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw parseSupabaseError(error);
    return (data ?? []) as DbCard[];
  } catch (err) {
    if (err instanceof CardError) throw err;
    throw parseSupabaseError(err);
  }
}

export async function insertCard(card: NewDbCard): Promise<DbCard> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new CardError("ログインが必要です。ページを更新してログインしてください", "NOT_AUTHENTICATED");
    }

    const { data, error } = await supabase
      .from("cards")
      .insert({ ...card, user_id: user.id })
      .select()
      .single();

    if (error) throw parseSupabaseError(error);
    return data as DbCard;
  } catch (err) {
    if (err instanceof CardError) throw err;
    throw parseSupabaseError(err);
  }
}

export async function updateCard(id: string, updates: DbCardUpdates): Promise<void> {
  try {
    const { error } = await supabase.from("cards").update(updates).eq("id", id);
    if (error) throw parseSupabaseError(error);
  } catch (err) {
    if (err instanceof CardError) throw err;
    throw parseSupabaseError(err);
  }
}

export async function deleteCards(ids: string[]): Promise<void> {
  try {
    const { error } = await supabase.from("cards").delete().in("id", ids);
    if (error) throw parseSupabaseError(error);
  } catch (err) {
    if (err instanceof CardError) throw err;
    throw parseSupabaseError(err);
  }
}

export async function uploadFile(cardId: string, file: File): Promise<string> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new CardError("ログインが必要です。ページを更新してログインしてください", "NOT_AUTHENTICATED");
    }

    const path = `${user.id}/${cardId}/${file.name}`;
    const { error } = await supabase.storage.from("shinen-files").upload(path, file, { upsert: true });

    if (error) throw parseSupabaseError(error);

    const { data } = supabase.storage.from("shinen-files").getPublicUrl(path);
    return data.publicUrl;
  } catch (err) {
    if (err instanceof CardError) throw err;
    throw parseSupabaseError(err);
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
