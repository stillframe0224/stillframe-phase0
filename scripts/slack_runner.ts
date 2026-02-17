#!/usr/bin/env tsx
/**
 * shinen-runner — Slack Socket Mode bot (Bolt JS)
 *
 * Minimal viable handler:
 *   DM "ping" → replies "pong"
 *
 * Secrets loaded from environment (never committed):
 *   SLACK_BOT_TOKEN      — xoxb-...
 *   SLACK_APP_TOKEN       — xapp-... (connections:write)
 *   SLACK_SIGNING_SECRET  — from App Credentials
 */

import { App, LogLevel } from "@slack/bolt";

/* ── validate secrets ──────────────────────────────── */
const required = [
  "SLACK_BOT_TOKEN",
  "SLACK_APP_TOKEN",
  "SLACK_SIGNING_SECRET",
] as const;

const missing = required.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error(
    `[shinen-runner] FATAL: missing env vars: ${missing.join(", ")}\n` +
      `Run: bash scripts/slack_secrets_setup.sh`
  );
  process.exit(1);
}

/* ── init Bolt ─────────────────────────────────────── */
const app = new App({
  token: process.env.SLACK_BOT_TOKEN!,
  signingSecret: process.env.SLACK_SIGNING_SECRET!,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN!,
  logLevel: LogLevel.INFO,
});

/* ── handlers ──────────────────────────────────────── */

// DM "ping" → "pong"  (ignore bot messages & subtypes to avoid loops)
app.message(async ({ message, say }) => {
  // skip bot messages, edits, and non-DM channels
  if (message.subtype) return;
  if (!("user" in message)) return;
  if (!("channel_type" in message)) return;
  if ((message as any).channel_type !== "im") return;
  if ((message as any).bot_id) return;

  const text = ("text" in message ? message.text : "") || "";

  if (text.trim().toLowerCase() === "ping") {
    await say("pong");
    return;
  }

  // Echo usage for any other DM
  await say(
    "Commands:\n" +
      "• `ping` — health check (replies pong)\n" +
      "• _(more coming soon)_"
  );
});

/* ── start ─────────────────────────────────────────── */
(async () => {
  try {
    await app.start();
    console.log("[shinen-runner] ⚡ Bolt Socket Mode running");
  } catch (err) {
    console.error("[shinen-runner] startup failed:", err);
    process.exit(1);
  }
})();
