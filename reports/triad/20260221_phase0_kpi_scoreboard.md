# Phase0 KPI Scoreboard — Adoption Note

* **Added:**
  * `app/api/phase0-kpi/route.ts` — server endpoint returning aggregated counts (no PII)
  * `.github/workflows/phase0_kpi_scoreboard.yml` — daily GitHub Issue updater
  * `OPS/PHASE0_KPI.md` — operations doc

* **Data available:**
  * From Supabase: total_cards, distinct_users, cards_7d, cards_1d
  * External (null placeholders): waitlist_total, payment_intent, preorders

* **Thresholds:** WL 300 / intent 30 / preorders 5

* **Verification:**
  * `curl /api/phase0-kpi` returns JSON with ok:true
  * `gh workflow run phase0-kpi-scoreboard` creates/updates the Issue
  * Issue title: "Phase0 KPI Scoreboard"

## Done when

* PR merged, workflow triggered, Issue body populated with current data.
