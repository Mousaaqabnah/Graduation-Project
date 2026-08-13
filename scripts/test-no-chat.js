/**
 * Phase 3 — internal chat removal regression suite.
 * Verifies chat is gone while support + notifications remain.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const BASE = process.env.API_BASE || 'http://127.0.0.1:3000';

let passed = 0;
let failed = 0;
const failures = [];

function record(name, ok, detail) {
  if (ok) {
    passed += 1;
    console.log('PASS', name);
  } else {
    failed += 1;
    failures.push(detail ? `${name}: ${detail}` : name);
    console.log('FAIL', name, detail || '');
  }
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

function listHtmlUnder(relDir) {
  const abs = path.join(ROOT, relDir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs).filter((n) => n.endsWith('.html')).map((n) => path.join(relDir, n));
}

function req(method, urlPath) {
  return new Promise((resolve) => {
    const u = new URL(urlPath, BASE);
    const r = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method,
        headers: { Accept: 'application/json' },
        timeout: 8000
      },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => resolve({ status: res.statusCode, body }));
      }
    );
    r.on('error', (e) => resolve({ status: 0, body: String(e.message || e) }));
    r.on('timeout', () => {
      r.destroy();
      resolve({ status: 0, body: 'timeout' });
    });
    r.end();
  });
}

async function main() {
  console.log('\n=== No-chat regression suite ===\n');

  // 1–3 navigation
  const playerPages = listHtmlUnder('pages/player');
  const ownerPages = listHtmlUnder('pages/owner');
  const adminPages = listHtmlUnder('pages/admin');

  const playerHasChatLink = playerPages.some((p) => /href=["']chat\.html["']/.test(read(p)));
  const ownerHasChatLink = ownerPages.some((p) => /href=["']chat\.html["']/.test(read(p)));
  record('player navigation has no internal Chat link', !playerHasChatLink && !exists('pages/player/chat.html'));
  record('owner navigation has no internal Chat link', !ownerHasChatLink && !exists('pages/owner/chat.html'));

  const adminMessages = exists('pages/admin/messages.html') ? read('pages/admin/messages.html') : '';
  const adminIsSupport =
    /support/i.test(adminMessages) &&
    !/socket\.io/i.test(adminMessages) &&
    exists('scripts/admin/messages.js') &&
    /supportGetConversations/.test(read('scripts/admin/messages.js'));
  record(
    'admin Messages page is support inbox (kept)',
    adminIsSupport && !exists('pages/admin/chat.html')
  );

  // 4–5 API unavailable
  const r1 = await req('GET', '/api/messages/conversations');
  const r2 = await req('POST', '/api/messages/attachment');
  record('internal chat API route unavailable (404)', r1.status === 404, String(r1.status));
  record('chat upload route unavailable (404)', r2.status === 404, String(r2.status));

  // 6–8 frontend helpers / pages / Message Owner
  const apiJs = read('scripts/utils/api.js');
  record(
    'frontend API helper exposes no internal chat methods',
    !/messagesAPI|uploadChatAttachment|getSocketOrigin/.test(apiJs) && !/\bmessages:\s*messagesAPI/.test(apiJs)
  );
  record(
    'no frontend internal-chat page linked',
    !exists('pages/player/chat.html') &&
      !exists('pages/owner/chat.html') &&
      !exists('scripts/shared/matchfield-chat.js')
  );
  const fieldInfo = read('scripts/player/field-info.js');
  record(
    'no Message Owner / Message venue internal-chat action',
    !/messageVenueBtn|Message venue|chat\.html\?userId/.test(fieldInfo)
  );

  // 9–11 support + notifications
  record('support routes still exist', exists('routes/support.js'));
  record(
    'contact functionality still exists',
    exists('pages/shared/contact-us.html') || exists('pages/owner/contact-us.html')
  );
  record(
    'notification functionality still exists',
    exists('routes/notifications.js') && /notificationsAPI/.test(apiJs)
  );

  // 12–13 Prisma models
  const schema = read('prisma/schema.prisma');
  record('Notification model remains in Prisma', /model Notification\b/.test(schema));
  record('UserNotification model remains in Prisma', /model UserNotification\b/.test(schema));
  record(
    'Conversation/Message chat models removed from Prisma schema',
    !/model Conversation\b/.test(schema) &&
      !/model Message\b/.test(schema) &&
      !/model ConversationParticipant\b/.test(schema) &&
      !/model MessageAttachment\b/.test(schema)
  );

  // 14–15 uploads / storage exposure
  record(
    'chat upload route module deleted',
    !exists('routes/chatUpload.js') && !exists('routes/messages.js')
  );
  const serverJs = read('server.js');
  record(
    'chat storage not publicly exposed',
    !/storage\/private\/chat/.test(serverJs) &&
      /never expose storage\/private/.test(serverJs)
  );

  // 16–17 Socket.IO
  const pkg = JSON.parse(read('package.json'));
  const deps = Object.assign({}, pkg.dependencies, pkg.devDependencies);
  record(
    'Socket.IO not initialized in server (chat-only case)',
    !/socket\.io/.test(serverJs) && !/attachSocketChat|setChatIo|new Server\(/.test(serverJs)
  );
  record('socket.io package removed', !deps['socket.io'] && !deps['socket.io-client']);

  // 18–19 no runtime Prisma chat queries
  function walkJs(dir, acc) {
    if (!fs.existsSync(dir)) return acc;
    for (const name of fs.readdirSync(dir)) {
      const abs = path.join(dir, name);
      const st = fs.statSync(abs);
      if (st.isDirectory()) {
        if (name === 'node_modules' || name === '.git') continue;
        walkJs(abs, acc);
      } else if (name.endsWith('.js') && !name.startsWith('test-') && !name.includes('api-smoke')) {
        acc.push(abs);
      }
    }
    return acc;
  }
  const runtimeDirs = ['lib', 'routes', 'middleware', 'scripts/utils', 'scripts/player', 'scripts/owner', 'scripts/admin', 'scripts/shared'].map(
    (d) => path.join(ROOT, d)
  );
  let chatPrismaHits = [];
  for (const d of runtimeDirs) {
    for (const file of walkJs(d, [])) {
      const src = fs.readFileSync(file, 'utf8');
      if (/prisma\.(conversation|message|messageAttachment|conversationParticipant)\b/.test(src)) {
        chatPrismaHits.push(path.relative(ROOT, file));
      }
    }
  }
  record('no active runtime Prisma Conversation queries', !chatPrismaHits.some((f) => /conversation/i.test(f)), chatPrismaHits.join(', '));
  record(
    'no active runtime Prisma Message chat-model queries',
    !chatPrismaHits.length,
    chatPrismaHits.join(', ')
  );

  // 20 app starts
  const health = await req('GET', '/health');
  record(
    'application starts successfully (health)',
    health.status === 200 && /ok/i.test(health.body),
    String(health.status)
  );

  // Extra: pending migration present but tables may still exist (not required for pass)
  record(
    'pending drop-chat migration file present (unapplied by design)',
    exists('prisma/migrations/20260811160000_remove_internal_chat/migration.sql')
  );

  console.log('\n---');
  console.log(`PASS ${passed} / FAIL ${failed}`);
  if (failures.length) {
    console.log('Failures:');
    failures.forEach((f) => console.log(' -', f));
  }
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
