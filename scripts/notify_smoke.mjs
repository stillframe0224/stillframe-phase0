#!/usr/bin/env node

import http from 'node:http';
import { spawn } from 'node:child_process';
import process from 'node:process';

const expected = {
  title: 'Smoke Title',
  message: 'Smoke Message',
  priority: '4',
  token: 'smoke-token',
};

const server = http.createServer((req, res) => {
  let body = '';
  req.setEncoding('utf8');
  req.on('data', (chunk) => {
    body += chunk;
  });

  req.on('end', () => {
    const title = req.headers.title || req.headers['x-title'] || '';
    const priority = req.headers.priority || req.headers['x-priority'] || '';
    const authExists = Boolean(req.headers.authorization);

    const ok =
      req.method === 'POST' &&
      req.url === '/smoke-topic' &&
      title === expected.title &&
      priority === expected.priority &&
      body === expected.message &&
      authExists;

    if (!ok) {
      console.error('[notify:smoke] fail request mismatch');
      console.error(
        JSON.stringify({
          method: req.method,
          url: req.url,
          title,
          priority,
          authPresent: authExists,
          body,
        })
      );
      res.statusCode = 400;
      res.end('bad request');
      process.exitCode = 1;
      server.close();
      return;
    }

    res.statusCode = 200;
    res.end('ok');
    console.log('[notify:smoke] pass');
    server.close();
  });
});

server.on('error', (error) => {
  console.error(`[notify:smoke] fail server ${error.message}`);
  process.exit(1);
});

server.listen(0, '127.0.0.1', () => {
  const addr = server.address();
  if (!addr || typeof addr === 'string') {
    console.error('[notify:smoke] fail could not get listen addr');
    process.exit(1);
  }

  const env = {
    ...process.env,
    NTFY_SERVER: `http://127.0.0.1:${addr.port}`,
    NTFY_TOPIC: 'smoke-topic',
    NTFY_TOKEN: expected.token,
  };

  const child = spawn('node', ['tools/notify/ntfy.mjs', '--title', expected.title, '--priority', expected.priority, '--message', expected.message], {
    stdio: 'inherit',
    env,
  });

  child.on('exit', (code) => {
    if (code !== 0) {
      console.error(`[notify:smoke] fail notifier exit=${code}`);
      process.exitCode = 1;
      server.close();
    }
  });
});
