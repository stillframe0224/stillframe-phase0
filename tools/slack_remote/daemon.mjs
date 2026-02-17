#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const ROOT = process.env.STILLFRAME_ROOT || "/Users/array0224/stillframe-phase0";
const BOT_TOKEN = process.env.SLACK_BOT_TOKEN || "";
const APP_TOKEN = process.env.SLACK_APP_TOKEN || "";
const ALLOWED_USER_IDS = (process.env.SLACK_ALLOWED_USER_IDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const LOG_DIR = path.join(ROOT, ".rwl", "logs");
const JSONL_PATH = path.join(LOG_DIR, "slack_remote.jsonl");
const RUN_LOG_PREFIX = path.join(LOG_DIR, "slack_remote_run");
const LOCK_PATH = "/tmp/stillframe-slack-runner.lock";
const APPROVAL_TTL_MS = 30 * 60 * 1000;
const MAX_OUTPUT_BYTES = 1024 * 512;

const pendingApprovals = new Map();

function die(msg) {
  console.error(msg);
  process.exit(1);
}

function nowIso() {
  return new Date().toISOString();
}

function ensureDirs() {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function writeLog(entry) {
  try {
    fs.appendFileSync(
      JSONL_PATH,
      `${JSON.stringify({ ts: nowIso(), ...entry })}\n`,
      "utf8"
    );
  } catch (_error) {
    // Logging must never crash daemon.
  }
}

function shortId() {
  return `${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

function textSummary(s, limit = 700) {
  if (!s) return "(empty)";
  return s.length <= limit ? s : `${s.slice(0, limit)}...`;
}

function trimOutputForSlack(raw) {
  const lines = raw.split(/\r?\n/);
  const head = lines.slice(0, 20);
  const tail = lines.slice(-20);
  if (lines.length <= 40) {
    return lines.join("\n");
  }
  return [...head, "...(snip)...", ...tail].join("\n");
}

async function slackApi(method, body) {
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${BOT_TOKEN}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.ok) {
    throw new Error(`slack api ${method} failed: ${json.error || "unknown_error"}`);
  }
  return json;
}

async function postMessage(channel, text, blocks) {
  const payload = { channel, text };
  if (blocks) payload.blocks = blocks;
  return slackApi("chat.postMessage", payload);
}

async function updateMessage(channel, ts, text, blocks) {
  const payload = { channel, ts, text };
  if (blocks) payload.blocks = blocks;
  return slackApi("chat.update", payload);
}

async function commandStatus() {
  const run = (cmd, args) =>
    new Promise((resolve) => {
      const ps = spawn(cmd, args, { cwd: ROOT });
      let out = "";
      let err = "";
      ps.stdout.on("data", (d) => (out += d.toString()));
      ps.stderr.on("data", (d) => (err += d.toString()));
      ps.on("close", (code) => resolve({ code, out, err }));
      ps.on("error", (e) => resolve({ code: 1, out: "", err: String(e) }));
    });

  const head = await run("git", ["rev-parse", "--short", "HEAD"]);
  const status = await run("git", ["status", "--porcelain"]);
  const recent = await run("git", ["log", "--oneline", "-n", "3"]);

  return [
    `HEAD: ${head.out.trim() || "(unknown)"}`,
    "STATUS:",
    status.out.trim() || "(clean)",
    "RECENT:",
    recent.out.trim() || "(no commits)",
  ].join("\n");
}

function parseRunCommand(text) {
  const t = text.trim();
  if (t === "run ship-main") {
    return {
      label: "run ship-main",
      shell: "IMAC_SOUND=1 scripts/ship-main",
    };
  }
  if (t === "run ship-subframe") {
    return {
      label: "run ship-subframe",
      shell: "IMAC_SOUND=1 scripts/ship-subframe",
    };
  }
  if (t.startsWith("run codex ")) {
    const prompt = t.slice("run codex ".length).trim();
    if (!prompt) return null;
    return {
      label: "run codex",
      shell: `IMAC_SOUND=1 scripts/codex-safe ${shellQuote(prompt)}`,
    };
  }
  if (t.startsWith("run claude ")) {
    const argsRaw = t.slice("run claude ".length).trim();
    if (!argsRaw) return null;
    return {
      label: "run claude",
      shell: `IMAC_SOUND=1 scripts/claude-safe ${argsRaw}`,
    };
  }
  return null;
}

function shellQuote(s) {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

function approvalBlocks(requestId, cmdText) {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Execution approval required*\n\`${cmdText}\`\nThis request expires in 30 minutes.`,
      },
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Approve" },
          style: "primary",
          action_id: "approve_run",
          value: requestId,
        },
        {
          type: "button",
          text: { type: "plain_text", text: "Cancel" },
          style: "danger",
          action_id: "cancel_run",
          value: requestId,
        },
      ],
    },
  ];
}

function requestExpired(req) {
  return Date.now() - req.createdAt > APPROVAL_TTL_MS;
}

function cleanupExpiredApprovals() {
  for (const [id, req] of pendingApprovals.entries()) {
    if (requestExpired(req)) {
      pendingApprovals.delete(id);
    }
  }
}

function runWithLock(shellCommand) {
  return new Promise((resolve) => {
    const child = spawn("flock", ["-n", LOCK_PATH, "bash", "-lc", shellCommand], {
      cwd: ROOT,
      env: { ...process.env, IMAC_SOUND: "1" },
    });

    let out = "";
    let err = "";

    child.stdout.on("data", (d) => {
      if (out.length < MAX_OUTPUT_BYTES) out += d.toString();
    });
    child.stderr.on("data", (d) => {
      if (err.length < MAX_OUTPUT_BYTES) err += d.toString();
    });

    child.on("error", (e) => {
      resolve({ code: 1, out, err: `${err}\n${String(e)}` });
    });

    child.on("close", (code) => {
      resolve({ code: code ?? 1, out, err });
    });
  });
}

function isAllowedUser(userId) {
  if (!userId) return false;
  if (ALLOWED_USER_IDS.length === 0) return true;
  return ALLOWED_USER_IDS.includes(userId);
}

function usageText() {
  return [
    "Commands:",
    "- status",
    "- run ship-main",
    "- run ship-subframe",
    "- run codex <prompt...>",
    "- run claude <args...>",
  ].join("\n");
}

async function handleMessageEvent(event) {
  if (!event || event.type !== "message") return;
  if (event.channel_type !== "im") return;
  if (event.subtype) return;

  const userId = event.user || "";
  const channel = event.channel;
  const text = (event.text || "").trim();

  if (!isAllowedUser(userId)) {
    await postMessage(channel, "Unauthorized user.");
    writeLog({ type: "unauthorized", userId, text });
    return;
  }

  cleanupExpiredApprovals();

  if (text === "status") {
    const summary = await commandStatus();
    await postMessage(channel, `\`\`\`\n${textSummary(summary, 2900)}\n\`\`\``);
    writeLog({ type: "status", userId });
    return;
  }

  const runSpec = parseRunCommand(text);
  if (!runSpec) {
    await postMessage(channel, usageText());
    return;
  }

  const requestId = shortId();
  pendingApprovals.set(requestId, {
    requestId,
    userId,
    channel,
    shell: runSpec.shell,
    label: runSpec.label,
    createdAt: Date.now(),
  });

  const posted = await postMessage(channel, `Approval required: ${runSpec.label}`, approvalBlocks(requestId, text));
  const req = pendingApprovals.get(requestId);
  if (req) {
    req.promptTs = posted.ts;
  }
  writeLog({ type: "approval_requested", userId, requestId, cmd: text });
}

async function executeApproved(requestId, actorUserId) {
  const req = pendingApprovals.get(requestId);
  if (!req) {
    return { ok: false, reason: "Request not found or expired." };
  }
  if (requestExpired(req)) {
    pendingApprovals.delete(requestId);
    return { ok: false, reason: "Request expired (30m)." };
  }
  if (req.userId !== actorUserId) {
    return { ok: false, reason: "Only the requester can approve/cancel this run." };
  }

  pendingApprovals.delete(requestId);

  await postMessage(req.channel, `Started: \`${req.label}\``);
  writeLog({ type: "run_started", requestId, userId: actorUserId, shell: req.shell });

  const runId = shortId();
  const result = await runWithLock(req.shell);
  const combined = `${result.out || ""}${result.err ? `\n${result.err}` : ""}`.trim();
  const short = trimOutputForSlack(combined || "(no output)");
  const logPath = `${RUN_LOG_PREFIX}_${runId}.log`;
  try {
    fs.writeFileSync(logPath, combined || "(no output)\n", "utf8");
  } catch (_error) {
    // Ignore file write failures.
  }

  if (result.code !== 0 && /Resource temporarily unavailable|would block|failed to get lock/i.test(result.err || "")) {
    await postMessage(req.channel, "BUSY: another command is running.");
    writeLog({ type: "busy", requestId, userId: actorUserId });
    return { ok: true };
  }

  const doneText =
    result.code === 0
      ? `Finished: \`${req.label}\` (exit=0)`
      : `Failed: \`${req.label}\` (exit=${result.code})`;

  await postMessage(
    req.channel,
    `${doneText}\n\`\`\`\n${textSummary(short, 3000)}\n\`\`\`\nlog: ${logPath}`
  );

  writeLog({
    type: "run_finished",
    requestId,
    userId: actorUserId,
    exitCode: result.code,
    logPath,
  });
  return { ok: true };
}

async function handleInteractive(payload) {
  const userId = payload?.user?.id || "";
  if (!isAllowedUser(userId)) {
    return;
  }

  const actions = payload?.actions || [];
  const action = actions[0];
  if (!action) return;

  const requestId = action.value || "";
  const channel = payload?.channel?.id;
  const messageTs = payload?.message?.ts;

  if (action.action_id === "cancel_run") {
    pendingApprovals.delete(requestId);
    if (channel && messageTs) {
      await updateMessage(channel, messageTs, "Canceled.", undefined);
    }
    writeLog({ type: "approval_canceled", requestId, userId });
    return;
  }

  if (action.action_id === "approve_run") {
    if (channel && messageTs) {
      await updateMessage(channel, messageTs, "Approved. Executing...", undefined);
    }
    await executeApproved(requestId, userId);
  }
}

async function openSocketModeWebSocket() {
  const res = await fetch("https://slack.com/api/apps.connections.open", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${APP_TOKEN}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });
  const json = await res.json();
  if (!json.ok || !json.url) {
    throw new Error(`apps.connections.open failed: ${json.error || "unknown_error"}`);
  }
  return json.url;
}

function ack(ws, envelopeId) {
  if (!envelopeId) return;
  ws.send(JSON.stringify({ envelope_id: envelopeId }));
}

async function handleEnvelope(ws, envelope) {
  ack(ws, envelope.envelope_id);
  const payload = envelope.payload;
  if (!payload) return;

  try {
    if (payload.type === "event_callback" && payload.event?.type === "message") {
      await handleMessageEvent(payload.event);
      return;
    }
    if (payload.type === "block_actions") {
      await handleInteractive(payload);
      return;
    }
  } catch (error) {
    writeLog({
      type: "handler_error",
      error: String(error?.stack || error),
    });
  }
}

async function start() {
  ensureDirs();
  if (!BOT_TOKEN || !APP_TOKEN) {
    die("Missing SLACK_BOT_TOKEN or SLACK_APP_TOKEN");
  }

  writeLog({ type: "daemon_start" });

  for (;;) {
    try {
      const wsUrl = await openSocketModeWebSocket();
      const ws = new WebSocket(wsUrl);

      await new Promise((resolve, reject) => {
        ws.addEventListener("open", () => {
          writeLog({ type: "socket_open" });
        });

        ws.addEventListener("message", async (event) => {
          try {
            const data = JSON.parse(String(event.data || "{}"));
            await handleEnvelope(ws, data);
          } catch (error) {
            writeLog({ type: "socket_message_error", error: String(error?.stack || error) });
          }
        });

        ws.addEventListener("close", () => {
          writeLog({ type: "socket_close" });
          resolve();
        });

        ws.addEventListener("error", (err) => {
          writeLog({ type: "socket_error", error: String(err?.message || err) });
          reject(err);
        });
      });
    } catch (error) {
      writeLog({ type: "socket_loop_error", error: String(error?.stack || error) });
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

start().catch((error) => {
  die(String(error?.stack || error));
});
