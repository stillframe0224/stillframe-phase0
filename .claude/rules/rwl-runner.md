--- globs: .rwl/runner.js,.rwl/Current/** ---

# RWL Runner 実装ルール

## executeAndVerify 2段階パイプライン

タスク実行は必ず以下の順序で行う:

1. Step 1: `claude -p` で実装実行（`--output-format json` で session_id 取得）
2. Step 2: `claude -p --resume $sessionId --json-schema VERIFY_SCHEMA` で検証
3. `verified === true` の場合のみ `commitTaskResult()` → `markDone()`
4. `verified === false` の場合は `failure_count++` → circuit breaker判定

## タスクタイプ別制約

| type | maxTurns | 検証 | allowedTools制限 |
|------|----------|------|-----------------|
| research | 15 | スキップ | Read系のみ |
| implement | 30 | 必須（10ターン） | git commit系除外 |
| verify | 10 | スキップ（自身が検証） | Read + テスト系のみ |

## エラー分類

- retryable（TIMEOUT, RATE_LIMIT, NETWORK）→ failure_count を増やさない
- permanent（AUTH, CONTEXT_OVERFLOW, GIT_CONFLICT）→ failure_count++

## 禁止プロンプト注入

`FORBIDDEN_GIT_OPS_PROMPT` は全タスクに `--append-system-prompt` で注入する。
省略・除外は禁止。
