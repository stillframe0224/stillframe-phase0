#!/usr/bin/env node

import process from 'node:process';

function parseArgs(argv) {
  const out = {
    title: '',
    message: '',
    priority: '',
    tags: '',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--title') {
      out.title = argv[i + 1] ?? '';
      i += 1;
    } else if (a === '--message') {
      out.message = argv[i + 1] ?? '';
      i += 1;
    } else if (a === '--priority') {
      out.priority = argv[i + 1] ?? '';
      i += 1;
    } else if (a === '--tags') {
      out.tags = argv[i + 1] ?? '';
      i += 1;
    }
  }

  return out;
}

function buildAuthHeader(env) {
  if (env.NTFY_TOKEN) {
    return `Bearer ${env.NTFY_TOKEN}`;
  }
  if (env.NTFY_USER && env.NTFY_PASS) {
    const encoded = Buffer.from(`${env.NTFY_USER}:${env.NTFY_PASS}`).toString('base64');
    return `Basic ${encoded}`;
  }
  return '';
}

function normalizePriority(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '3';

  if (/^[1-5]$/.test(raw)) return raw;

  const map = {
    min: '1',
    low: '2',
    default: '3',
    high: '4',
    max: '5',
  };

  return map[raw] || '3';
}

function toHeaderLatin1(s) {
  // Node fetch header values must be byte-safe. Convert UTF-8 bytes to latin1 string.
  return Buffer.from(String(s), 'utf8').toString('latin1');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const server = process.env.NTFY_SERVER || 'https://ntfy.sh';
  const topic = process.env.NTFY_TOPIC || '';
  const priority = normalizePriority(args.priority || process.env.NTFY_PRIORITY || '3');

  if (!topic) {
    console.error('[ntfy] fail missing NTFY_TOPIC');
    process.exit(2);
  }
  if (!args.title) {
    console.error('[ntfy] fail missing --title');
    process.exit(2);
  }
  if (!args.message) {
    console.error('[ntfy] fail missing --message');
    process.exit(2);
  }

  const url = `${server.replace(/\/+$/, '')}/${encodeURIComponent(topic)}`;
  const headers = {
    'Content-Type': 'text/plain; charset=utf-8',
    'Title': toHeaderLatin1(args.title),
    'Priority': priority,
  };

  const auth = buildAuthHeader(process.env);
  if (auth) headers.Authorization = auth;
  if (args.tags) headers['Tags'] = args.tags;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: args.message,
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[ntfy] fail status=${res.status} body=${body.slice(0, 160)}`);
      process.exit(1);
    }

    console.error(`[ntfy] ok topic=${topic} priority=${priority}`);
    process.exit(0);
  } catch (error) {
    console.error(`[ntfy] fail error=${error?.message || String(error)}`);
    process.exit(1);
  }
}

main();
