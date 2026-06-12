# Recent Failure Patterns

このファイルはrunner.jsが自動更新する。最大7項目を維持。

<!-- 以下にrunner.jsが自動追記 -->
- **20260606-081000-fix-mobile-ui-bugs**: Task failed (attempt 2): Error: Reached max turns (20). 回避策: 未特定
- **20260606-082000-fix-waitlist-form-validation**: triad_review_missing. 回避策: Blocked: triad_review missing for non-low-risk task
- **20260610-080500-fix-mobile-layout-bug**: Task failed (attempt 1): Error: Reached max turns (20). 回避策: 未特定
- **20260610-080500-fix-mobile-layout-bug**: Task failed (attempt 2): You've hit your weekly limit · resets 11pm (Asia/Tokyo)
- **20260610-080500-fix-mobile-layout-bug**: Task failed (attempt 3): You've hit your weekly limit · resets 11pm (Asia/Tokyo)
- **20260610-080500-fix-mobile-layout-bug**: Task failed (attempt 4): You've hit your weekly limit · resets 11pm (Asia/Tokyo)
- **20260610-080500-fix-mobile-layout-bug**: Task failed (attempt 5): You've hit your weekly limit · resets 11pm (Asia/Tokyo)
. 回避策: R2 follow-upで、再現条件/allowed_files/失敗証跡がないためproduct修正は作らずQuarantine退避。`npm run build`通過後にbreaker reset
