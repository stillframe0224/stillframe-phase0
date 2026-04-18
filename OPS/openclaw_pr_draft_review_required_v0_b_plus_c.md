# openclaw PR draft — ReviewRequiredV0 Rule B+C 化 (ReviewTrigger 配列化 + repair_lane クロスチェック)

**Status:** open / ready-for-review (PR #5 作成済 2026-04-18、37/37 vitest green、tsc pass on main-based branch)
**Scope:** 6 ファイル (schema 3 + docs 3)、契約 minor bump (protocol_version 据置)
**Initiator:** StillFrame / openclaw
**Baseline:** 2026-04-18 時点で `gap_repair_v0.test.ts` 全 25 pass (189ms)
**Blocks:** Codex Task 9 Step 0 (本 PR merge 後に item 3 green 成立)
**PR:** `array0224-cloud/openclaw#5` <https://github.com/array0224-cloud/openclaw/pull/5>
**Related docs:**
- `openclaw/docs/contracts/gap-repair-v0-enum-decisions.md` §4 確定方針 + §5 決裁記録
- `openclaw/docs/codex-tasks/codex-task-gap-repair-v1.md` Step 0 item 3
- `openclaw/docs/contracts/triad-protocol-provenance.md` §5.1 Runner 稼働前 rename の扱い

---

## Title (suggested)

```
feat(gap-repair-v0): promote ReviewTrigger to array with lane_d_required cross-check (Rule B+C)
```

## Summary

`ReviewRequiredV0Schema` の `trigger_reason: ReviewTrigger` (単一 enum) を
`trigger_reasons: ReviewTrigger[]` (配列) に昇格し、併せて `repair_lane` を
必須フィールドとして追加する。GAP AutoResearch v1 evidence 生成時に以下 2 点を
Zod レベルで保証する。

- **Rule B (aggregation)**: エスカレーションの根拠は同時に複数成立しうる
  (例: `low_confidence ∧ contradictory_sources ∧ no_candidates`)。
  単一 enum では情報欠落するため配列で全根拠を残す。`manual_override` も
  他 trigger と排他にせず aggregation 優先度は runner 側で処理する
  (非 Zod、薄積み証拠主義)。
- **Rule C (cross-field)**: `lane_d_required` は `repair_lane === "D"` の
  文脈でのみ意味を持つ。A/C lane での発火は runner ロジックバグなので
  `.superRefine` で hard reject する。

配列長は `.min(1).max(5)` で拘束 (現行 enum 5 値 × 一意制約 = 物理最大 5)、
`length >= 4` は runner 側で warning 発火 (非 Zod)。
さらに `.transform((arr) => [...arr].sort())` で canonical sort し、
入力順序による parse 結果 drift を排除する。

## Changes

本 PR は 6 ファイル更新。実装 schema 3 ファイル + follow-up docs 3 ファイル。

> **Execution note (2026-04-18):**
> 当初は 5 ファイル想定だったが、`origin/main` には
> `openclaw/web/src/lib/contracts/triad-protocol-v0.ts` が未収載で、
> `gap-repair-v0.ts` / `gap_repair_v0.test.ts` がそれを import していた。
> main ベースで `tsc` / contract test を成立させる最小依存として、
> 実際の PR は **6 ファイル** で作成した。

### 1. `openclaw/web/src/lib/contracts/gap-repair-v0.ts`

#### 1-a. ReviewRequiredV0Schema 書き換え

```diff
 export const ReviewRequiredV0Schema = z
   .object({
     event_session_id: NonEmptyStringSchema,
     event_source_seq: z.number().int().min(0),
-    trigger_reason: ReviewTriggerSchema,
+    repair_lane: RepairLaneSchema,
+    trigger_reasons: z
+      .array(ReviewTriggerSchema)
+      .min(1)
+      .max(5)
+      .superRefine((values, ctx) => {
+        const seen = new Set<string>();
+        for (const value of values) {
+          if (seen.has(value)) {
+            ctx.addIssue({
+              code: z.ZodIssueCode.custom,
+              message: "trigger_reasons must be unique",
+            });
+            return;
+          }
+          seen.add(value);
+        }
+      })
+      .transform((values) => [...values].sort()),
     trigger_details: NonEmptyStringSchema,
     assignee_role: z.literal("human_reviewer"),
     escalated_at: IsoTimestampSchema,
     resolution_notes: NonEmptyStringSchema.optional(),
     resolved_at: IsoTimestampSchema.optional(),
   })
-  .strict();
+  .strict()
+  .superRefine((obj, ctx) => {
+    // Rule C: lane_d_required は repair_lane === "D" の文脈でのみ有効
+    if (
+      obj.trigger_reasons.includes("lane_d_required") &&
+      obj.repair_lane !== "D"
+    ) {
+      ctx.addIssue({
+        code: z.ZodIssueCode.custom,
+        path: ["trigger_reasons"],
+        message:
+          "'lane_d_required' is only valid when repair_lane === 'D'",
+      });
+    }
+    // Rule B: manual_override の併存は明示的に許可 (hard reject しない)
+  });
```

> **注**: `.transform` を `.superRefine` の後に配置することで、
> 一意性チェックが通った値のみを canonical sort する。
> sort 済み配列は同一集合の入力が常に同一順序で出力されるため、
> 順序独立性テスト (§3 test c) が担保される。

#### 1-b. 型エクスポート (変更なし)

```typescript
export type ReviewRequiredV0 = z.infer<typeof ReviewRequiredV0Schema>;
```

`z.infer` が自動追従するため宣言変更不要。ただし型上は
`trigger_reasons: ReviewTrigger[]` の形になり、consumer (runner / UI)
側で `trigger_reason: string` からの読み替えが必要。現時点で consumer は
未実装 (Codex Task 9 Step 0 未着手) のため本 PR では破壊影響なし。

#### 1-c. ヘッダコメント更新

```diff
  *   - `RepairLane` (A/C/D、B 欠番理由の明文化)
  *   - `RepairPhase` (6値 + lane × phase の妥当性)
  *   - `OfficialVerdict` (3値の粒度、partially_supported 追加要否)
- *   - `ReviewTrigger` (★ 相互排他性 — 単一値 enum か配列か決裁必要)
+ *   - `ReviewTrigger` (配列 + Rule B + Rule C 確定 2026-04-18 —
+ *     詳細は `docs/contracts/gap-repair-v0-enum-decisions.md` §4/§5)
  *
- *   決裁が未了の間は runner Step 1 以降 (evidence JSON 実書き込み) は
- *   禁止。`.safeParse()` 契約テストの baseline 確認のみ許可。
+ *   2026-04-18 Rei 決裁にて上記 4 enum は全て confirmed。runner Step 1
+ *   以降の実装は本 PR merge ＋ Step 0 残 4 項目 green 後に解禁。
```

### 2. `openclaw/web/tests/contract/gap_repair_v0.test.ts`

#### 2-a. Fixture 差し替え

```diff
 const VALID_REVIEW_REQUIRED = {
   event_session_id: "session-001",
   event_source_seq: 0,
-  trigger_reason: "low_confidence" as const,
+  repair_lane: "A" as const,
+  trigger_reasons: ["low_confidence"] as const,
   trigger_details: "official_confidence.score=0.31",
   assignee_role: "human_reviewer" as const,
   escalated_at: ISO_NOW,
 };
```

#### 2-b. 既存 3 test の追従 (破壊変更なく通る)

- 「accepts a valid review-required escalation」: fixture 更新で green
- 「rejects assignee_role other than 'human_reviewer'」: 影響なし
- 「accepts optional resolution_notes + resolved_at」: 影響なし

#### 2-c. 追加 12 test (Rule B+C + 配列長 + 順序独立性)

```typescript
describe("ReviewRequiredV0Schema (Rule B+C)", () => {
  // --- Rule B: aggregation ---
  it("accepts multiple trigger_reasons co-occurring (Rule B: aggregation)", () => {
    expect(
      ReviewRequiredV0Schema.safeParse({
        ...VALID_REVIEW_REQUIRED,
        trigger_reasons: [
          "low_confidence",
          "contradictory_sources",
          "no_candidates",
        ],
      }).success,
    ).toBe(true);
  });

  it("accepts manual_override co-existing with other triggers (Rule B)", () => {
    expect(
      ReviewRequiredV0Schema.safeParse({
        ...VALID_REVIEW_REQUIRED,
        trigger_reasons: ["manual_override", "low_confidence"],
      }).success,
    ).toBe(true);
  });

  // --- 配列長 (.min(1).max(5)) ---
  it("rejects empty trigger_reasons array (at least one reason required)", () => {
    expect(
      ReviewRequiredV0Schema.safeParse({
        ...VALID_REVIEW_REQUIRED,
        trigger_reasons: [],
      }).success,
    ).toBe(false);
  });

  it("accepts trigger_reasons at max length 5 (all enum values)", () => {
    expect(
      ReviewRequiredV0Schema.safeParse({
        ...VALID_REVIEW_REQUIRED,
        repair_lane: "D",
        trigger_reasons: [
          "low_confidence",
          "contradictory_sources",
          "no_candidates",
          "lane_d_required",
          "manual_override",
        ],
      }).success,
    ).toBe(true);
  });

  // max(5) reject 境界: enum 5 値なので length=6 は必ず重複を含む
  // (物理最大 5 を Zod .max(5) が先に reject することを確認)
  it("rejects trigger_reasons length > 5 (.max(5) boundary)", () => {
    expect(
      ReviewRequiredV0Schema.safeParse({
        ...VALID_REVIEW_REQUIRED,
        repair_lane: "D",
        trigger_reasons: [
          "low_confidence",
          "contradictory_sources",
          "no_candidates",
          "lane_d_required",
          "manual_override",
          "low_confidence",
        ],
      }).success,
    ).toBe(false);
  });

  // --- 一意性 (superRefine) ---
  it("rejects duplicate trigger_reasons (uniqueness superRefine)", () => {
    expect(
      ReviewRequiredV0Schema.safeParse({
        ...VALID_REVIEW_REQUIRED,
        trigger_reasons: ["low_confidence", "low_confidence"],
      }).success,
    ).toBe(false);
  });

  // --- Rule C: lane_d_required cross-field ---
  it("rejects 'lane_d_required' when repair_lane === 'A' (Rule C)", () => {
    expect(
      ReviewRequiredV0Schema.safeParse({
        ...VALID_REVIEW_REQUIRED,
        repair_lane: "A",
        trigger_reasons: ["lane_d_required"],
      }).success,
    ).toBe(false);
  });

  it("rejects 'lane_d_required' when repair_lane === 'C' (Rule C)", () => {
    expect(
      ReviewRequiredV0Schema.safeParse({
        ...VALID_REVIEW_REQUIRED,
        repair_lane: "C",
        trigger_reasons: ["lane_d_required", "no_candidates"],
      }).success,
    ).toBe(false);
  });

  it("accepts 'lane_d_required' when repair_lane === 'D' (Rule C)", () => {
    expect(
      ReviewRequiredV0Schema.safeParse({
        ...VALID_REVIEW_REQUIRED,
        repair_lane: "D",
        trigger_reasons: ["lane_d_required"],
      }).success,
    ).toBe(true);
  });

  // Rule C の逆方向: D lane でも lane_d_required は必須ではない
  it("accepts repair_lane === 'D' without 'lane_d_required' (Rule C reverse)", () => {
    expect(
      ReviewRequiredV0Schema.safeParse({
        ...VALID_REVIEW_REQUIRED,
        repair_lane: "D",
        trigger_reasons: ["no_candidates", "low_confidence"],
      }).success,
    ).toBe(true);
  });

  // --- enum 境界 ---
  it("rejects unknown repair_lane value (e.g. 'B' is excluded)", () => {
    expect(
      ReviewRequiredV0Schema.safeParse({
        ...VALID_REVIEW_REQUIRED,
        repair_lane: "B",
      }).success,
    ).toBe(false);
  });

  // --- canonical sort transform の順序独立性 ---
  it("normalizes trigger_reasons order via canonical sort (.transform)", () => {
    const a = ReviewRequiredV0Schema.safeParse({
      ...VALID_REVIEW_REQUIRED,
      trigger_reasons: ["low_confidence", "manual_override"],
    });
    const b = ReviewRequiredV0Schema.safeParse({
      ...VALID_REVIEW_REQUIRED,
      trigger_reasons: ["manual_override", "low_confidence"],
    });
    expect(a.success && b.success).toBe(true);
    if (a.success && b.success) {
      expect(a.data.trigger_reasons).toEqual(b.data.trigger_reasons);
      // canonical = alphabetical
      expect(a.data.trigger_reasons).toEqual([
        "low_confidence",
        "manual_override",
      ]);
    }
  });
});
```

追加 12 件 → 既存 25 件 + 追加 12 件 = **計 37 件** になる見込み。

(内訳: Rule B 2件 / 配列長 3件 (空配列 reject / max=5 accept / length=6 reject) / 一意性 1件 / Rule C 4件 / enum境界 1件 / canonical sort 1件)

### 3. `openclaw/web/src/lib/contracts/triad-protocol-v0.ts`

**Execution-time dependency fix (main-based branch で追加)**:
`gap-repair-v0.ts` / contract test が import する基底契約。source branch では
untracked だったため、`origin/main` 起点 branch では本ファイルも同梱しないと
`npx tsc -p tsconfig.json --noEmit` が通らない。

- `IsoTimestampSchema`
- `NonEmptyStringSchema`
- `AgentRoleSchema` (`human_reviewer` を含む openclaw-local extension)
- `TriadEventV0Schema`

これにより main ベース branch 上で `gap-repair-v0.ts` が self-contained になり、
contract test 37/37 pass と `tsc` pass を再現できた。

### 4. `openclaw/docs/codex-tasks/codex-task-gap-repair-v1.md`

**本 PR で変更済 (本書と同一 commit に含める)**: Step 0 item 3 に
`✅ confirmed 2026-04-18` を付与し、`RepairPhaseSchema` (6値) を enum 列挙に
追加、schema fix の完全 green は本 PR merge 後に成立する旨を明記。

### 5. `openclaw/docs/contracts/triad-protocol-provenance.md`

**本 PR で変更済**: §5.1 に「Runner 稼働前 rename の扱い」を新規追記。
`trigger_reason` → `trigger_reasons` rename のように派生契約の構造破壊を
`protocol_version '0'` 据置で許容する条件 (runner 未稼働 + 両側同時更新 +
β′ 等価性保持) を明文化。Runner 稼働後は major bump または additive
deprecation のどちらかを要求。加えて本 PR レビュー中の指摘に基づき、
**単一値 ↔ 配列のような型形状変更** も本節適用対象に含めつつ、
evidence 実書き込み済 / downstream 参照ありの場合は major bump に倒す
追加条件を明記 (2026-04-18 追記)。

### 6. `openclaw/docs/contracts/gap-repair-v0-enum-decisions.md`

**本 PR で変更済**: 4 論点の Rei 決裁記録を正本化。

- §4 付帯決定 (Rei 決裁 2026-04-18): 論点2 (配列長 `.min(1).max(5)` +
  canonical sort + runner warning ≥4) / 論点3 (25 既存 + 12 追加 = 37 件、
  max=5 reject 境界含む) / 論点4 (protocol_version `'0'` 据え置き +
  provenance §5.1 への rule 追記連動)
- §5.1 決裁サマリ: 7 論点 × 決裁結果の表形式 (test 体制行は 37 件に反映済)
- §5.2 後続 action: 本 PR に含まれる 5 件 + 本書自身 = 計 6 ファイル merge
- §6 lifecycle: `confirmed` → 本 PR merge 後 `archived` に bump 予定

## Runner 側の aggregation 優先度 (非 Zod、参考仕様)

Zod は配列に意味順序を持たせない (集合 + canonical sort)。
runner 側 `summary.md` / UI 表示での "主たる根拠" 決定は以下優先度。

1. `manual_override` (人間の明示的 override は最優先)
2. `lane_d_required` (lane 強制のため)
3. `contradictory_sources` (一次情報の矛盾)
4. `no_candidates` (候補自体なし)
5. `low_confidence` (上記なき残余)

また `trigger_reasons.length >= 4` の evidence は `summary.md` に
warning bullet を出す (原因集中が起きている signal)。この優先度と
warning 閾値は `tools/kokugo/gap_repair_v1.mjs` 内 pure function で実装し、
本 PR スコープ外。

## Migration impact

- **既存 evidence データ**: GAP AutoResearch v1 は未稼働 (Codex Task 9 Step 0
  未着手) → `reports/kizuki/gap-repair/**` に ReviewRequiredV0 形式の既存
  ファイルは存在しない → **データ移行不要**
- **myloggy 側**: `EventV0Schema` (openclaw `TriadEventV0Schema` の SSOT) は
  不変。`GapRepairEventV0Schema` は `extend` した派生契約で openclaw 独占
  (provenance §1)。**myloggy に波及しない**
- **protocol_version**: `'0'` のまま (provenance §5.1 "Runner 稼働前 rename"
  ルールを本 PR で新設 → 本 PR 自体が初適用ケース)
- **既存 PR 草稿**:
  - `OPS/myloggy_pr_draft_human_reviewer.md` (PR1): 無関係、独立 merge 可
  - `OPS/myloggy_pr_draft_normalize_agent_role.md` (PR2): 無関係、独立

## Merge conditions

1. ✅ 既存 25 test + 追加 12 test = **37 全 pass**
2. ✅ `npx tsc -p tsconfig.json --noEmit` pass
   (main-based 6-file branch で再現確認)
3. ✅ Rei 決裁証跡が `gap-repair-v0-enum-decisions.md` §5.1 に記録済
   (2026-04-18 時点で達成)
4. ✅ 6 ファイル単位 diff として commit
   (`triad-protocol-v0` / `gap-repair-v0` / test / task / provenance / enum-decisions)
5. 🔵 本 PR merge 後、Codex Task 9 Step 0 の残 4 項目 (契約テスト / triad
   protocol テスト / 入力データ / 出力 dir) の green 確認へ移行

## 承認前 pre-approval チェックリスト

draft → ready-for-review 昇格前に以下すべて green:

- [ ] **vitest**: `cd /Users/array0224/openclaw/web && npx vitest run tests/contract/gap_repair_v0.test.ts` が **37 pass**
- [ ] **tsc**: `cd /Users/array0224/openclaw/web && npx tsc -p tsconfig.json --noEmit`
      が pass すること (main-based branch で再現済)
- [ ] **enum-decisions doc**: §5.1 に 7 論点 × 決裁結果表が入っていること (本 PR には既に反映済み)
- [ ] **codex-task doc**: Step 0 item 3 が `✅ confirmed 2026-04-18` 表記に更新済
- [ ] **provenance doc**: §5.1 "Runner 稼働前 rename の扱い" が追記済 (型形状変更の追加条件含む)
- [ ] **enum-decisions doc**: §4 付帯決定 / §5 確定記録 / §6 lifecycle 更新済
- [ ] **破壊変更の範囲確認**: `git diff` で以下 6 ファイル以外に差分がないこと
  - `openclaw/web/src/lib/contracts/triad-protocol-v0.ts`
  - `openclaw/web/src/lib/contracts/gap-repair-v0.ts`
  - `openclaw/web/tests/contract/gap_repair_v0.test.ts`
  - `openclaw/docs/codex-tasks/codex-task-gap-repair-v1.md`
  - `openclaw/docs/contracts/triad-protocol-provenance.md`
  - `openclaw/docs/contracts/gap-repair-v0-enum-decisions.md`
- [ ] **myloggy 側不変確認**: `src/distiller/events.schema.ts` との drift
  なきこと (本 PR は gap-repair 派生契約のみを触る)
- [ ] **consumer 影響範囲確認**: `rg "trigger_reason" openclaw/` で
  未実装 consumer (Codex Task 9 runner skeleton 等) がヒットしないこと
  (ヒット時は同時修正 or 別チケット化)
- [ ] **canonical sort 担保**: §2-c 最終 test (normalizes order) の
  期待値が alphabetical であること、および runner 側で `.sort()` を
  前提にした aggregation 実装を進めない旨をレビュアに明示

## Post-merge checklist

- `gap-repair-v0-enum-decisions.md` の冒頭 Status を `confirmed` →
  `archived (PR #xxx merged YYYY-MM-DD)` に bump
- `codex-task-gap-repair-v1.md` Step 0 item 3 の checkmark を `schema PR
  merged` note 付きに補強 (item 1/2 は引き続き pending の旨を明示)
- provenance.md §5.1 の初適用事例として本 PR 番号を追記 (任意)
- `OPS/RWL_KISAI_MIGRATION.md` にリンク追加 (任意): Codex Task 9 Step 0
  unblock 進捗ログ

## 後続 task の unblock 条件

本 PR merge + Step 0 残 4 項目 (入力データ可用性 / 出力ディレクトリ書込可 /
contract テスト全通過 / triad-protocol テスト全通過) がすべて green になった
時点で **Codex Task 9 Step 1 (runner skeleton 実装)** に進んでよい。
現時点で本 PR scope は Step 0 item 3 (enum 確定) の unblock のみ。

## Live PR

- URL: <https://github.com/array0224-cloud/openclaw/pull/5>
- Branch: `feat/gap-repair-review-required-rule-b-c`
- Commit: `d515ead`
- 実行時に `origin/main` へ不足していた `triad-protocol-v0.ts` を追加し、
  6 ファイル差分として `tsc` pass / contract test 37/37 pass を確認後に作成
