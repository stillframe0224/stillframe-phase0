# 2026-02-25 merge-safe fallback hardening

## Purpose
- `scripts/gh_pr_merge_safe.sh` が GitHub API 接続系エラーで失敗しても、checks PASS 確認済みなら自動フォールバックで完走できるようにする。

## Changes
- `scripts/gh_pr_merge_safe.sh`
  - GitHub接続系エラー判定を追加（`error connecting to api.github.com`, `Could not resolve host`, `timeout`, `EOF`, `connection reset` 等）。
  - `gh repo view` 失敗時の `REPO_SLUG` 解決を `git remote origin` からフォールバック可能に変更。
  - `gh pr checks --watch` をラップし、失敗時に:
    - 接続系エラーかつ `gh pr checks --required` がPASSなら継続（`CHECKS_CONFIRMED=1`）。
    - それ以外は従来通り停止。
  - `gh pr merge --squash --delete-branch` 失敗時に:
    - `CHECKS_CONFIRMED=1` かつ接続系エラーなら、同コマンドを fallback として再実行。
    - fallback 成功時は exit 0。
    - checks 未確認または非接続系失敗は従来通り停止。

## Safety model
- fallback merge は `checks PASS` が確認できた場合にのみ実行。
- checks 未確認のケースでは、従来どおり安全側で停止。

## Validation
- `bash -n scripts/gh_pr_merge_safe.sh` -> PASS

## Risks
- 一時的な接続断で fallback の再試行が同じエラーになる可能性はある（その場合は失敗終了）。
- エラーパターンの網羅漏れがあると fallback 条件に入らない可能性がある。

## Rollback
1. `scripts/gh_pr_merge_safe.sh` を変更前に戻す。
2. `bash -n scripts/gh_pr_merge_safe.sh` を再実行して構文確認。
