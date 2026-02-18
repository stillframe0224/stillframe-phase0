# TRIAD 20260218_always_reorder_notes_ig — CLOSE ✅

- Status: **Complete / Closed**
- Scope: Always-on manual reorder, MEMO always-open, Instagram thumbnail persistence

---

## 1) Changes (3 files)

### A) `app/app/page.tsx` — DnD always enabled

**Before:** `DndContext` / `SortableContext` only rendered when `sortOrder === "custom"`.
Cards showed `isDraggable={false}` in Newest/Oldest modes. A gate prevented dragging.

**After:**
- Single `DndContext` always wraps the grid (no `sortOrder` conditional).
- `isDraggable={!isBulkMode}` — drag handle ⋮⋮ always visible (hidden only in bulk-select mode).
- Added `onDragStart={handleDragStart}`:
  - If `sortOrder !== "custom"`: snapshots current `filteredCards` order to localStorage, calls `setSortOrder("custom")`, syncs URL (`?sort=custom`) via `router.replace`.
  - Result: user drags in Newest mode → UI auto-switches to Custom, drag completes cleanly.
- `DragStartEvent` added to `@dnd-kit/core` imports.

### B) `app/app/AppCard.tsx` — MEMO always opens + IG thumbnail

**MEMO fix:**
- Removed `card.notes !== undefined` gate from chip `onClick` — modal now always opens.
- `cursor: "pointer"` and `title="Click to add/edit notes"` unconditional.
- Added ● indicator (5px dot) when `card.notes?.trim() || memoText.trim()` is truthy.
- localStorage persistence (`stillframe.card:memo:{id}`) was already in place — no change needed.

**Instagram CDN image fix:**
- Added `isInstagramCdnUrl(url)` helper: detects `*.cdninstagram.com` and `*.fbcdn.net` hosts.
- `imgSrc` logic: IG CDN images bypass the image proxy (`isIgCdnImage` flag) — render directly with `referrerPolicy="no-referrer"`.
- After `link-preview` API returns an IG CDN image, persist it to `preview_image_url` via Supabase update (best-effort, one-time, only if `card.preview_image_url` was previously empty).
- `MAX_PREVIEW_ATTEMPTS=2` breaker maintained.

---

## 2) Build & Smoke

```
npm run build          → ✅ PASS (0 errors)
link_preview_smoke.mjs → ✅ 11/11 PASS
```

---

## 3) Manual verification checklist

| # | Action | Expected |
|---|--------|---------|
| 1 | sort=Newest のままカードの⋮⋮ハンドルをドラッグ | ドラッグ開始瞬間にsort dropdownが "Custom order (drag)" に切替わり、カードが並び替わる |
| 2 | リロード後にCustomが維持されURLが `?sort=custom` | ✅ (localStorage + URL sync) |
| 3 | MEMOチップ（カード種別ラベル）をクリック | モーダルが必ず開く（notes未定義でも） |
| 4 | モーダルでテキスト入力 → 保存ボタンまたはモーダル外クリックで閉じる | メモがlocalStorageに保存される |
| 5 | ページリロード後にMEMOをクリック | 入力したテキストが残っている |
| 6 | InstagramカードでサムネがoEmbed経由で返る場合 | サムネが表示される（proxy経由でなく直接） |
| 7 | Instagram画像が返らない場合 | SVGフォールバック表示、クラッシュなし |

---

## 4) Notes

- link-preview の oEmbed エンドポイントは Instagram のレート制限/ログイン要件により本番では `image: null` になることが多い（スモークで確認済み）。取れる時は表示・永続される設計。
- MEMO の DB 永続化は既存の `onUpdate` コールバック経由（保存ボタン押下時）。localStorage はオフライン/DB失敗時のフォールバック。
- IG CDN の `*.cdninstagram.com` / `*.fbcdn.net` は `remotePatterns` に登録済み（`next.config.ts`）だが、ワイルドカードのサブドメイン一致が不安定なため `<img>` 直接レンダリングに切替。
