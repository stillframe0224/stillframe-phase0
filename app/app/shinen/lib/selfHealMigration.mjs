export const SELFHEAL_MIGRATION_VERSION = "20260225";
export const SELFHEAL_MIGRATION_STORAGE_KEY = `shinen_migration_selfheal_v${SELFHEAL_MIGRATION_VERSION}`;
export const SELFHEAL_MIGRATION_FORCE_KEY = "shinen_migration_selfheal_force";
export const SELFHEAL_MIGRATION_MAX_PER_RUN = 30;

const GENERIC_X_THUMB_PATTERNS = [
  /https?:\/\/abs\.twimg\.com\/.*\/og\/image\.png(?:[?#].*)?$/i,
  /https?:\/\/abs\.twimg\.com\/responsive-web\/client-web\/og\/image\.png(?:[?#].*)?$/i,
];

function normalizeMaybeUrl(input) {
  const raw = String(input || "").trim();
  if (!raw) return null;
  let candidate = raw;
  if (candidate.startsWith("//")) candidate = `https:${candidate}`;
  if (!/^https?:\/\//i.test(candidate)) {
    if (/^(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s]*)?$/i.test(candidate)) {
      candidate = `https://${candidate.replace(/^www\./i, "www.")}`;
    } else {
      return null;
    }
  }
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.href;
  } catch {
    return null;
  }
}

function hostFromUrl(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function extractUrlOnlyText(text) {
  const raw = String(text || "").trim();
  if (!raw || /\s/.test(raw)) return null;
  return normalizeMaybeUrl(raw);
}

function extractYoutubeId(url) {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1).split("?")[0] || null;
    if (u.hostname.includes("youtube.com")) {
      if (u.pathname.startsWith("/shorts/")) return u.pathname.slice(8).split("?")[0] || null;
      return u.searchParams.get("v");
    }
  } catch {
    // Ignore malformed URLs.
  }
  return null;
}

function inferEmbedFromUrl(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (host === "x.com" || host.endsWith(".x.com") || host === "twitter.com" || host.endsWith(".twitter.com")) {
      const status = u.pathname.match(/^\/([^/]+)\/status(?:es)?\/(\d+)/i);
      if (!status) return null;
      const statusUrl = `${u.origin}/${status[1]}/status/${status[2]}`;
      return {
        provider: "x",
        embedUrl: `https://platform.twitter.com/embed/Tweet.html?dnt=1&url=${encodeURIComponent(statusUrl)}`,
      };
    }
    if (host === "instagram.com" || host.endsWith(".instagram.com") || host === "instagr.am") {
      const ig = u.pathname.match(/^\/(p|reel|tv)\/([A-Za-z0-9_-]+)/i);
      if (!ig) return null;
      return {
        provider: "instagram",
        embedUrl: `https://www.instagram.com/${ig[1].toLowerCase()}/${ig[2]}/embed/`,
      };
    }
  } catch {
    // Ignore malformed URLs.
  }
  return null;
}

function hasUsableMedia(media) {
  if (!media) return false;
  if (media.type === "youtube") return Boolean(media.youtubeId);
  if (media.type === "embed" || media.kind === "embed") return Boolean(media.embedUrl);
  return Boolean(media.url);
}

function dedupeActions(actions) {
  const seen = new Set();
  const out = [];
  for (const action of actions) {
    const key = `${action.type}:${action.url || ""}:${action.reason || ""}:${action.cardId ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(action);
  }
  return out;
}

function summarizeCard(card) {
  return {
    type: card.type,
    sourceUrl: card.source?.url || null,
    mediaType: card.media?.type || null,
    mediaKind: card.media?.kind || null,
    mediaUrl: card.media?.url || null,
    embedUrl: card.media?.embedUrl || null,
  };
}

function makeEnqueueAction(url, reason) {
  return { type: "enqueue_unfurl", url, reason };
}

function makeDropThumbnailAction(reason) {
  return { type: "drop_thumbnail", reason };
}

export function isGenericXLoginThumb(url) {
  if (!url) return false;
  const normalized = String(url).trim();
  if (!normalized) return false;
  return GENERIC_X_THUMB_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function migrateCard(card) {
  const source = card.source ? { ...card.source } : undefined;
  let media = card.media ? { ...card.media } : undefined;
  const next = { ...card, ...(source ? { source } : {}), ...(media ? { media } : {}) };
  const reasons = [];
  const actions = [];
  let changed = false;

  const sourceUrl = normalizeMaybeUrl(next.source?.url || "");
  const textUrl = extractUrlOnlyText(next.text);
  const canonicalUrl = sourceUrl ?? textUrl;

  if (canonicalUrl && next.type !== 8) {
    next.type = 8;
    next.source = {
      ...(next.source || {}),
      url: canonicalUrl,
      site: next.source?.site || hostFromUrl(canonicalUrl) || canonicalUrl,
    };
    reasons.push("normalize_url_note_to_clip");
    changed = true;
    if (!hasUsableMedia(next.media)) {
      actions.push(makeEnqueueAction(canonicalUrl, "normalize_url_note_to_clip"));
    }
  }

  if (media) {
    const badMediaUrl = isGenericXLoginThumb(media.url);
    const badThumb = isGenericXLoginThumb(media.thumbnail);
    const badPoster = isGenericXLoginThumb(media.posterUrl);
    if (badMediaUrl || badThumb || badPoster) {
      if (media.type === "image" && badMediaUrl) {
        next.media = undefined;
        media = undefined;
      } else {
        if (badThumb) delete media.thumbnail;
        if (badPoster) delete media.posterUrl;
        if (badMediaUrl && (media.type === "embed" || media.kind === "embed")) {
          media.url = canonicalUrl ?? media.embedUrl ?? media.url;
        }
        next.media = media;
      }
      reasons.push("drop_x_generic_thumb");
      actions.push(makeDropThumbnailAction("x_generic_login_wall_thumb"));
      if (canonicalUrl) {
        actions.push(makeEnqueueAction(canonicalUrl, "drop_x_generic_thumb"));
      }
      changed = true;
    }
  }

  media = next.media ? { ...next.media } : undefined;
  if (media && (media.kind === "embed" || media.type === "embed")) {
    const embedUrl = normalizeMaybeUrl(media.embedUrl || "");
    if (!embedUrl) {
      const inferenceBase = canonicalUrl ?? normalizeMaybeUrl(media.url || "");
      const inferred = inferenceBase ? inferEmbedFromUrl(inferenceBase) : null;
      if (inferred) {
        media.type = "embed";
        media.kind = "embed";
        media.embedUrl = inferred.embedUrl;
        media.provider = media.provider || inferred.provider;
        media.url = canonicalUrl ?? media.url ?? inferred.embedUrl;
        next.media = media;
        reasons.push("repair_embed_missing_url");
        changed = true;
      } else if (canonicalUrl) {
        actions.push(makeEnqueueAction(canonicalUrl, "embed_missing_url"));
      }
    } else if (!media.url) {
      media.url = canonicalUrl ?? embedUrl;
      next.media = media;
      reasons.push("repair_embed_missing_media_url");
      changed = true;
    }
  }

  return {
    changed,
    card: changed ? next : card,
    reasons,
    actions: dedupeActions(actions),
  };
}

export function runSelfHealMigration(cards, opts = {}) {
  const limit = Number.isFinite(opts.limit) && opts.limit > 0
    ? Math.floor(opts.limit)
    : SELFHEAL_MIGRATION_MAX_PER_RUN;
  let applied = 0;
  let changedCount = 0;
  let candidates = 0;
  const actions = [];
  const fixes = [];

  const nextCards = cards.map((card) => {
    const outcome = migrateCard(card);
    const hasWork = outcome.changed || outcome.actions.length > 0;
    if (!hasWork) return card;
    candidates += 1;
    if (applied >= limit) return card;
    applied += 1;

    const nextCard = outcome.changed ? outcome.card : card;
    if (outcome.changed) {
      changedCount += 1;
      fixes.push({
        cardId: card.id,
        reasons: outcome.reasons,
        before: summarizeCard(card),
        after: summarizeCard(nextCard),
        actions: outcome.actions,
      });
    }
    for (const action of outcome.actions) {
      actions.push({ ...action, cardId: card.id });
    }
    return nextCard;
  });

  return {
    cards: nextCards,
    changedCount,
    appliedCount: applied,
    candidateCount: candidates,
    remainingCount: Math.max(0, candidates - applied),
    actions: dedupeActions(actions),
    fixes,
    limit,
  };
}

export function applyUnfurlResultToCard(card, preview) {
  if (!card?.source?.url || !preview || typeof preview !== "object") return card;

  const next = {
    ...card,
    source: card.source ? { ...card.source } : card.source,
    media: card.media ? { ...card.media } : card.media,
  };
  let changed = false;

  if (next.source && typeof preview.favicon === "string" && preview.favicon && !next.source.favicon) {
    next.source.favicon = preview.favicon;
    changed = true;
  }

  const mediaKind = preview.mediaKind;
  const embedUrl = typeof preview.embedUrl === "string" ? preview.embedUrl : null;
  const image = typeof preview.image === "string" ? preview.image : null;
  const poster = typeof preview.posterUrl === "string" ? preview.posterUrl : image;

  if ((mediaKind === "embed" || embedUrl) && embedUrl) {
    next.type = 8;
    next.media = {
      type: "embed",
      kind: "embed",
      url: next.source?.url ?? embedUrl,
      embedUrl,
      posterUrl: poster || undefined,
      provider: preview.provider || next.media?.provider,
    };
    changed = true;
  } else if (image) {
    const canReplace =
      !next.media ||
      next.media.type === "image" ||
      isGenericXLoginThumb(next.media.url) ||
      ((next.media.type === "embed" || next.media.kind === "embed") && !next.media.posterUrl);
    if (canReplace) {
      if (next.media && (next.media.type === "embed" || next.media.kind === "embed")) {
        next.media = { ...next.media, posterUrl: poster || undefined };
      } else {
        next.media = { type: "image", kind: "image", url: image };
      }
      changed = true;
    }
  }

  return changed ? next : card;
}
