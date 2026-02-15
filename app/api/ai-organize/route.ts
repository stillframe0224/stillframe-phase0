import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

interface OrganizeRequest {
  cardId: string;
  force?: boolean;
}

interface AIResult {
  summary: string;
  tags: string[];
  action: "buy" | "read" | "watch" | "do" | "hold";
}

export async function POST(request: NextRequest) {
  try {
    // 1. Auth check
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse request
    const body: OrganizeRequest = await request.json();
    const { cardId, force = false } = body;

    if (!cardId) {
      return NextResponse.json({ error: "cardId required" }, { status: 400 });
    }

    // 3. Check OpenAI key
    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY not configured" },
        { status: 500 }
      );
    }

    // 4. Fetch card
    const { data: card, error: fetchError } = await supabase
      .from("cards")
      .select(
        "id, user_id, title, text, source_url, site_name, notes, media_kind, ai_updated_at, created_at"
      )
      .eq("id", cardId)
      .single();

    if (fetchError || !card) {
      return NextResponse.json(
        { error: { code: "CARD_NOT_FOUND", message: "Card not found" } },
        { status: 404 }
      );
    }

    // 5. Ownership check
    if (card.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 6. Skip if recently analyzed (within 24h) and not forced
    if (!force && card.ai_updated_at) {
      const lastUpdate = new Date(card.ai_updated_at);
      const hoursSince = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60);
      if (hoursSince < 24) {
        return NextResponse.json(
          { error: "Already analyzed within 24h. Use force=true to re-analyze." },
          { status: 429 }
        );
      }
    }

    // 7. Build context for AI
    const context = buildContext(card);

    // 8. Call OpenAI Responses API
    const aiResult = await callOpenAI(context);

    // 9. Update card
    const { error: updateError } = await supabase
      .from("cards")
      .update({
        ai_summary: aiResult.summary,
        ai_tags: aiResult.tags,
        ai_action: aiResult.action,
        ai_model: OPENAI_MODEL,
        ai_updated_at: new Date().toISOString(),
      })
      .eq("id", cardId);

    if (updateError) {
      console.error("Update error:", updateError);
      return NextResponse.json(
        { error: "Failed to update card" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      result: aiResult,
    });
  } catch (error: any) {
    console.error("AI organize error:", error);
    return NextResponse.json(
      { error: error.message || "Internal error" },
      { status: 500 }
    );
  }
}

function buildContext(card: any): string {
  const parts: string[] = [];

  if (card.title) parts.push(`Title: ${card.title}`);
  parts.push(`Text: ${card.text}`);
  if (card.source_url) parts.push(`URL: ${card.source_url}`);
  if (card.site_name) parts.push(`Site: ${card.site_name}`);
  if (card.notes) parts.push(`Notes: ${card.notes}`);
  if (card.media_kind) parts.push(`Media: ${card.media_kind}`);

  return parts.join("\n");
}

async function callOpenAI(context: string): Promise<AIResult> {
  const systemPrompt = `You are an AI assistant organizing saved content. Analyze the card and provide:
1. summary: One-line summary (max 100 chars)
2. tags: Array of 1-5 relevant tags (lowercase, no spaces)
3. action: Choose ONE: "buy" (product/purchase), "read" (article/doc), "watch" (video/media), "do" (task/action), "hold" (reference/archive)

Return ONLY valid JSON with these exact keys. No markdown, no explanation.`;

  const userPrompt = `Analyze this saved content:\n\n${context}`;

  const payload = {
    model: OPENAI_MODEL,
    instructions: systemPrompt,
    input: userPrompt,
    response_format: { type: "json_object" },
    temperature: 0.2,
  };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const content = data.output;

  if (!content) {
    throw new Error("No output in OpenAI response");
  }

  // Parse JSON
  let result: AIResult;
  try {
    result = JSON.parse(content);
  } catch (parseError) {
    // Retry with stricter prompt
    const retryPayload = {
      model: OPENAI_MODEL,
      instructions: systemPrompt + "\n\nIMPORTANT: Return ONLY raw JSON, no backticks, no markdown.",
      input: userPrompt,
      response_format: { type: "json_object" },
      temperature: 0.2,
    };

    const retryResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify(retryPayload),
    });

    if (!retryResponse.ok) {
      throw new Error("Retry failed");
    }

    const retryData = await retryResponse.json();
    const retryContent = retryData.output;
    result = JSON.parse(retryContent);
  }

  // Validate structure
  if (
    !result.summary ||
    !Array.isArray(result.tags) ||
    !result.action ||
    !["buy", "read", "watch", "do", "hold"].includes(result.action)
  ) {
    throw new Error("Invalid AI response structure");
  }

  // Sanitize
  result.summary = result.summary.slice(0, 200);
  result.tags = result.tags.slice(0, 5).map((t) => String(t).toLowerCase().slice(0, 30));

  return result;
}
