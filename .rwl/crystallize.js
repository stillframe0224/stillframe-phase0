#!/usr/bin/env node
/**
 * crystallize.js — Weekly NFD Report Generator
 *
 * Usage:
 *   node .rwl/crystallize.js              # current week
 *   node .rwl/crystallize.js --week 2026-W11
 *   node .rwl/crystallize.js --all        # all weeks in EVENTS.jsonl
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, '..');
const RWL = path.join(ROOT, '.rwl');
const EVENTS_JSONL = path.join(RWL, 'EVENTS.jsonl');
const DONE_JSON = path.join(RWL, 'DONE.json');
const POSTMORTEMS_DIR = path.join(RWL, 'postmortems');
const ANTI_PATTERNS_JSON = path.join(RWL, 'anti-patterns.json');
const SESSIONS_DIR = path.join(os.homedir(), '.claude', 'sessions');
const OUT_DIR = path.join(os.homedir(), 'company', 'secretary', 'crystallization');

// ── ISO Week Utilities ──────────────────────────────────────────────────────

function getISOWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return {
    year: d.getUTCFullYear(),
    week: Math.ceil((((d - yearStart) / 86400000) + 1) / 7),
  };
}

function getWeekBounds(weekStr) {
  // weekStr: "2026-W11"
  const m = weekStr.match(/^(\d{4})-W(\d{1,2})$/);
  if (!m) throw new Error(`Invalid week format: ${weekStr}`);
  const year = parseInt(m[1]);
  const week = parseInt(m[2]);

  // ISO week 1 = week containing first Thursday
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Dow = jan4.getUTCDay() || 7;
  const week1Mon = new Date(jan4);
  week1Mon.setUTCDate(jan4.getUTCDate() - (jan4Dow - 1));

  const monday = new Date(week1Mon);
  monday.setUTCDate(week1Mon.getUTCDate() + (week - 1) * 7);

  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  sunday.setUTCHours(23, 59, 59, 999);

  return { start: monday, end: sunday };
}

function currentWeekStr() {
  const now = new Date();
  const { year, week } = getISOWeekNumber(now);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

function formatDate(d) {
  return d.toISOString().slice(0, 10);
}

// ── Data Loaders ─────────────────────────────────────────────────────────────

function loadEvents() {
  try {
    const text = fs.readFileSync(EVENTS_JSONL, 'utf8');
    return text.split('\n').filter(Boolean).map(l => {
      try { return JSON.parse(l); } catch { return null; }
    }).filter(Boolean);
  } catch {
    return [];
  }
}

function loadDoneJson() {
  try {
    const list = JSON.parse(fs.readFileSync(DONE_JSON, 'utf8'));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function loadPostmortems() {
  try {
    return fs.readdirSync(POSTMORTEMS_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        try { return JSON.parse(fs.readFileSync(path.join(POSTMORTEMS_DIR, f), 'utf8')); } catch { return null; }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function loadAntiPatterns() {
  try {
    const list = JSON.parse(fs.readFileSync(ANTI_PATTERNS_JSON, 'utf8'));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function loadSessionLogs(start, end) {
  try {
    return fs.readdirSync(SESSIONS_DIR)
      .filter(f => f.endsWith('.json') && !f.includes('pre-compact'))
      .map(f => {
        try { return JSON.parse(fs.readFileSync(path.join(SESSIONS_DIR, f), 'utf8')); } catch { return null; }
      })
      .filter(Boolean)
      .filter(s => {
        if (!s.ended_at) return false;
        const t = new Date(s.ended_at);
        return t >= start && t <= end;
      });
  } catch {
    return [];
  }
}

function loadPrevReport(prevWeekStr) {
  const jsonPath = path.join(OUT_DIR, `${prevWeekStr}.json`);
  try {
    return JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  } catch {
    return null;
  }
}

// ── Metrics ───────────────────────────────────────────────────────────────────

function calcPreflightHitRate(events) {
  const byRun = {};
  for (const e of events) {
    if (!e.run_id) continue;
    if (!byRun[e.run_id]) byRun[e.run_id] = [];
    byRun[e.run_id].push(e);
  }

  let warnings = 0, hits = 0, falsePositives = 0;
  for (const runEvents of Object.values(byRun)) {
    const hasWarning = runEvents.some(e => e.event_type === 'preflight_warning');
    if (!hasWarning) continue;
    warnings++;
    const hasFailed = runEvents.some(e => e.event_type === 'task_failed');
    const hasSucceeded = runEvents.some(e => e.event_type === 'task_succeeded');
    if (hasFailed) hits++;
    else if (hasSucceeded) falsePositives++;
  }

  return {
    warnings,
    hits,
    false_positives: falsePositives,
    hit_rate: warnings > 0 ? Math.round((hits / warnings) * 100) / 100 : null,
  };
}

function calcRepeatFailures(events) {
  const byCat = {};
  for (const e of events.filter(e => e.event_type === 'task_failed')) {
    const tag = e.error_tag || e.error_category || 'unknown';
    byCat[tag] = (byCat[tag] || 0) + 1;
  }
  return byCat;
}

function calcSessionPatterns(sessions) {
  const totals = {};
  for (const s of sessions) {
    for (const p of (s.patterns_detected || [])) {
      totals[p.type] = (totals[p.type] || 0) + p.count;
    }
  }
  return totals;
}

// ── Prev week string ──────────────────────────────────────────────────────────

function prevWeekStr(weekStr) {
  const { start } = getWeekBounds(weekStr);
  const prevMon = new Date(start);
  prevMon.setUTCDate(start.getUTCDate() - 7);
  const { year, week } = getISOWeekNumber(prevMon);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

// ── Report Generator ──────────────────────────────────────────────────────────

function generateReport(weekStr, allEvents, allDone, allPostmortems, antiPatterns) {
  const { start, end } = getWeekBounds(weekStr);

  const events = allEvents.filter(e => {
    const t = new Date(e.ts);
    return t >= start && t <= end;
  });

  const sessions = loadSessionLogs(start, end);

  // Task counts (from events)
  const succeededIds = new Set(events.filter(e => e.event_type === 'task_succeeded').map(e => e.task_id));
  const failedIds = new Set(events.filter(e => e.event_type === 'task_failed').map(e => e.task_id));
  // started but no outcome yet: ignore
  const nSucceeded = succeededIds.size;
  const nFailed = failedIds.size;
  const nTotal = succeededIds.size + failedIds.size;
  const successRate = nTotal > 0 ? Math.round((nSucceeded / nTotal) * 100) / 100 : null;

  // From DONE.json for this week (metadata)
  const doneThisWeek = allDone.filter(d => {
    const t = new Date(d.completed_at || d.failed_at);
    return t >= start && t <= end;
  });

  // Postmortems this week
  const pmThisWeek = allPostmortems.filter(pm => {
    const t = new Date(pm.failed_at);
    return t >= start && t <= end;
  });

  // Metrics
  const preflight = calcPreflightHitRate(events);
  const repeatFailures = calcRepeatFailures(events);
  const sessionPatterns = calcSessionPatterns(sessions);

  // breaker activations
  const breakerActivations = events.filter(e => e.event_type === 'preflight_blocked').length;

  // prev week comparison
  const prev = prevWeekStr(weekStr);
  const prevReport = loadPrevReport(prev);
  const prevMetrics = prevReport ? prevReport.metrics : null;

  const metrics = {
    nightly_success_rate: successRate,
    nightly_total: nTotal,
    nightly_succeeded: nSucceeded,
    nightly_failed: nFailed,
    repeat_failures: repeatFailures,
    preflight_warnings: preflight.warnings,
    preflight_hits: preflight.hits,
    preflight_hit_rate: preflight.hit_rate,
    preflight_false_positives: preflight.false_positives,
    breaker_activations: breakerActivations,
    session_count: sessions.length,
    session_patterns: sessionPatterns,
  };

  // ── Markdown ─────────────────────────────────────────────────────────────

  const successPct = successRate !== null ? `${Math.round(successRate * 100)}%` : 'N/A';
  const prevSuccessPct = prevMetrics?.nightly_success_rate !== null && prevMetrics?.nightly_success_rate !== undefined
    ? `${Math.round(prevMetrics.nightly_success_rate * 100)}%`
    : 'N/A';
  const successDelta = (successRate !== null && prevMetrics?.nightly_success_rate !== null && prevMetrics?.nightly_success_rate !== undefined)
    ? `${Math.round((successRate - prevMetrics.nightly_success_rate) * 100) >= 0 ? '+' : ''}${Math.round((successRate - prevMetrics.nightly_success_rate) * 100)}pp`
    : 'N/A';

  const hitRatePct = preflight.hit_rate !== null ? `${Math.round(preflight.hit_rate * 100)}%` : 'N/A';

  // repeat failures table
  const repeatLines = Object.entries(repeatFailures).map(([cat, n]) => {
    const prev_n = prevMetrics?.repeat_failures?.[cat];
    const arrow = prev_n !== undefined ? (n > prev_n ? ' ↑' : n < prev_n ? ' ↓' : ' →') : '';
    const prevStr = prev_n !== undefined ? ` (前週: ${prev_n}回)` : '';
    return `- ${cat}: ${n}回${prevStr}${arrow}`;
  });

  // postmortem lines
  const pmLines = pmThisWeek.map(pm =>
    `- **${pm.task_id}**: \`${pm.error_tag}\` — ${pm.root_cause_hypothesis}\n  予防策候補: ${pm.preventive_rule_candidate}`
  );

  // anti-patterns status
  const apLines = antiPatterns.map(p =>
    `- ${p.tag}: failure_count=${p.failure_count}, last_seen=${p.last_seen ? p.last_seen.slice(0, 10) : 'N/A'}`
  );
  const apEscalate = antiPatterns.filter(p => (p.failure_count || 0) >= 3).map(p => `- ${p.tag} → guardrail 化を検討`);

  // session patterns
  const spLines = sessions.length > 0
    ? Object.entries(sessionPatterns).map(([type, count]) => `- ${type}: ${count}件`)
    : [];
  const skillCandidates = sessions.flatMap(s => s.skill_candidates || [])
    .reduce((acc, sc) => {
      const existing = acc.find(x => x.pattern === sc.pattern);
      if (existing) existing.count += sc.count;
      else acc.push({ ...sc });
      return acc;
    }, [])
    .filter(sc => sc.count >= 2);

  const md = `# Weekly NFD Report: ${weekStr}

期間: ${formatDate(start)} 〜 ${formatDate(end)}
生成日時: ${new Date().toISOString().slice(0, 19).replace('T', ' ')} UTC
データソース: EVENTS.jsonl (${events.length}件), session logs (${sessions.length}件)

---

## 1. Summary

| 項目 | 値 |
|------|----|
| Nightly タスク | ${nSucceeded} 成功 / ${nFailed} 失敗 / ${nTotal} 合計 |
| 対話セッション | ${sessions.length} 件 |
| EVENTS.jsonl | ${events.length} イベント |

---

## 2. Eval Metrics

### 2a. Nightly Success Rate
- 成功率: ${successPct}${nTotal > 0 ? ` (${nSucceeded}/${nTotal})` : ''}
- 前週比: ${successDelta} (前週: ${prevSuccessPct})

### 2b. Repeat Failure Rate
${repeatLines.length > 0 ? repeatLines.join('\n') : '- 失敗なし'}

### 2c. Preflight Hit Rate
- preflight 警告: ${preflight.warnings} 件
- うち実際に失敗: ${preflight.hits} 件
- 的中率: ${hitRatePct}
- 誤検出: ${preflight.false_positives} 件

### 2d. Breaker / Block
- preflight_blocked: ${breakerActivations} 回

---

## 3. Error Trends
${repeatLines.length > 0 ? repeatLines.join('\n') : '- エラーなし'}

---

## 4. Pattern Observations

**anti-patterns.json 現状:**
${apLines.length > 0 ? apLines.join('\n') : '- なし（初期値）'}

${apEscalate.length > 0 ? `**昇格候補（failure_count >= 3）:**\n${apEscalate.join('\n')}` : '**昇格候補:** なし'}

---

## 5. Session Insights
${sessions.length > 0 ? `
**検出されたパターン:**
${spLines.length > 0 ? spLines.join('\n') : '- なし'}

**skill 候補:**
${skillCandidates.length > 0 ? skillCandidates.map(sc => `- ${sc.pattern} (検出${sc.count}回)`).join('\n') : '- なし'}
` : '対話セッションデータなし'}

---

## 6. Postmortem Summary
${pmLines.length > 0 ? pmLines.join('\n') : '- 今週の失敗タスクなし（またはpostmortemデータなし）'}

---

## 7. Action Items

- [ ] Eval 指標を確認（成功率 ${successPct}, 前週比 ${successDelta}）
- [ ] 再発パターンを確認し、必要なら guardrail 追加
- [ ] Preflight 的中率 ${hitRatePct} — 低ければ anti-patterns.json のキーワードを調整
${sessions.length > 0 ? '- [ ] Session insights のパターンをトリアージ' : ''}
${pmLines.length > 0 ? '- [ ] Postmortem の予防策候補を anti-patterns.json に反映するか判断' : ''}
${apEscalate.length > 0 ? apEscalate.map(l => `- [ ] ${l}`).join('\n') : ''}
`;

  return { md, json: { week: weekStr, generated_at: new Date().toISOString(), metrics, prev_week: prev, prev_metrics: prevMetrics } };
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const allFlag = args.includes('--all');
  const weekIdx = args.indexOf('--week');
  const specifiedWeek = weekIdx >= 0 ? args[weekIdx + 1] : null;

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const allEvents = loadEvents();
  const allDone = loadDoneJson();
  const allPostmortems = loadPostmortems();
  const antiPatterns = loadAntiPatterns();

  let weeksToProcess = [];

  if (allFlag) {
    if (allEvents.length === 0) {
      // No events: process current week only
      weeksToProcess = [currentWeekStr()];
      console.log('EVENTS.jsonl is empty — generating current week report only.');
    } else {
      // Collect all unique weeks from events
      const weekSet = new Set();
      for (const e of allEvents) {
        const d = new Date(e.ts);
        if (isNaN(d)) continue;
        const { year, week } = getISOWeekNumber(d);
        weekSet.add(`${year}-W${String(week).padStart(2, '0')}`);
      }
      // Also include weeks from DONE.json entries
      for (const d of allDone) {
        const t = new Date(d.completed_at || d.failed_at);
        if (isNaN(t)) continue;
        const { year, week } = getISOWeekNumber(t);
        weekSet.add(`${year}-W${String(week).padStart(2, '0')}`);
      }
      weeksToProcess = [...weekSet].sort();
    }
  } else if (specifiedWeek) {
    weeksToProcess = [specifiedWeek];
  } else {
    weeksToProcess = [currentWeekStr()];
  }

  for (const weekStr of weeksToProcess) {
    try {
      const { md, json } = generateReport(weekStr, allEvents, allDone, allPostmortems, antiPatterns);

      const mdPath = path.join(OUT_DIR, `${weekStr}.md`);
      const jsonPath = path.join(OUT_DIR, `${weekStr}.json`);

      fs.writeFileSync(mdPath, md);
      fs.writeFileSync(jsonPath, JSON.stringify(json, null, 2));

      const { nightly_succeeded: s, nightly_failed: f, nightly_total: t } = json.metrics;
      console.log(`[${weekStr}] OK — ${s}成功/${f}失敗/${t}合計 → ${mdPath}`);
    } catch (err) {
      console.error(`[${weekStr}] ERROR: ${err.message}`);
    }
  }
}

main();
