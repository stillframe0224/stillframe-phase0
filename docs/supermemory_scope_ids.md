# Supermemory scope policy anchors (v1.0)

| Scope | Memo ID | Purpose |
|---|---|---|
| sm_stillframe | sNbAZDLti5PZnY1cn7g3MY | Dev & Ops |
| sm_shinen | XzPFCpjwieiEDpCBBzFT4e | Product & UX |
| sm_n8n | dLUBg3uyuvEr4QmcmvzVqS | Ops Safety Kit |
| sm_rwlaas | qxXrTH2oDy7ekg57kvrocT | SaaS Design & Sales |

## Rotation (key expired / needs auth)

```bash
bash ~/bin/sm_rekey_manual.sh
```

## Policy

- SSOT = Git (this repo). Supermemory = recall cache only.
- Each scope's first memo contains the full save/deny rules (v1.0).
- See user's policy spec for details on OK/NG per scope.

Created: 2026-03-01
