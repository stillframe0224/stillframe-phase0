# openclaw tsc branch-local note — main-based gap-repair PR branch では再現しなかった

**Status:** superseded / branch-local observation
**Observed:** 2026-04-18 (`claudecode/freeze-matrix-release-packet` source branch 上)
**Scope:** openclaw/web — source branch 側の branch-local 汚染メモ
**Owner:** openclaw 担当 (必要なら別途切り出し)
**Blocks:** なし (`array0224-cloud/openclaw#5` の merge gate ではない)

---

## 背景

source branch (`claudecode/freeze-matrix-release-packet`) 上で
`npx tsc -p tsconfig.json --noEmit` を走らせたところ、PR scope 外の
エラーが 22件検出されたため、当初は baseline 汚染として切り出した。

ただし 2026-04-18 に `origin/main` 起点で再作成した
`feat/gap-repair-review-required-rule-b-c` branch
(`array0224-cloud/openclaw#5`) では、`triad-protocol-v0.ts` を同梱した
最小 6 ファイル差分で `npx tsc -p tsconfig.json --noEmit` が **pass**。

つまりこの 22 errors / 11 files は `openclaw/main` baseline ではなく、
source branch 側の branch-local contamination だった。

## 検出エラー一覧 (22件 / 11 files)

| # | ファイル | 件数 | エラー内容（抜粋） |
|---|---------|------|-------------------|
| 1 | `scripts/kaijo-shakai-*.ts` | 7 | `subject` field が `ScoringPipelineInput` に無い |
| 2 | `src/__tests__/examSessionRoute.test.ts` | 1 | `normalizeLegacyFixturePayload` export 欠落 |
| 3 | `src/__tests__/runtimePresetQuestions.test.ts` | 3 | `social_domain` / `social_region_id` 型未定義 |
| 4 | `src/app/api/exam/session/route.ts` | 2 | 5 引数 vs 4 期待、型不一致 |
| 5 | `src/lib/scoring/__tests__/kernel_v1_penalty.test.ts` | 9 | `typo_count` / `kanji_violation` が `ExtractV1` に無い |

## 推定原因

- `scoring_pipeline.ts` のシグネチャ更新 (subject 削除 or 追加) に追従漏れ
- `jam-adapter.ts` 削除 (現 branch で `D web/src/lib/scoring/jam-adapter.ts`) に伴う連鎖
- `ExtractV1` / `ScoringPipelineInput` 型定義の minor bump が test 側に反映されていない

## 推奨アクション

1. 影響範囲の洗い出し (git blame + 最近の scoring_pipeline / ExtractV1 変更履歴)
2. 型定義 SSOT (`scoring_pipeline.ts`, `ExtractV1`) に合わせて test + script を追従
3. `jam-adapter.ts` 削除に伴う参照箇所の掃除
4. CI に `tsc --noEmit` gate を入れて同種汚染の再発を防ぐ

## 判定基準 (merge gate)

`array0224-cloud/openclaw#5` については、merge gate を
**「`npx tsc -p tsconfig.json --noEmit` pass」** として扱える。

このメモは PR #5 の blocker ではなく、source branch 側の別件追跡用として残す。

## 参照

- 関連 PR: `OPS/openclaw_pr_draft_review_required_v0_b_plus_c.md`
- main-based 実 PR: <https://github.com/array0224-cloud/openclaw/pull/5>
- source branch 観測時のフル tsc 出力: 未保存
