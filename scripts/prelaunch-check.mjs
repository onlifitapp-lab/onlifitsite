import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function assertRule(condition, passMessage, failMessage, results) {
  if (condition) {
    results.push({ ok: true, message: passMessage });
  } else {
    results.push({ ok: false, message: failMessage });
  }
}

function run() {
  const results = [];

  const authJs = read('auth.js');
  const loginGoogleJs = read('login-google.js');
  const supportSchema = read('SUPPORT_TICKETS_SCHEMA.sql');
  const supportHtml = read('support.html');
  const createTicketApi = read(path.join('api', 'create-ticket.js'));

  assertRule(
    /function\s+resolveAuthBaseUrl\s*\(/.test(authJs),
    'Auth: resolveAuthBaseUrl exists',
    'Auth: resolveAuthBaseUrl is missing',
    results
  );

  assertRule(
    /const\s+authBase\s*=\s*resolveAuthBaseUrl\(\)/.test(authJs),
    'Auth: OAuth redirect uses canonical auth base',
    'Auth: OAuth redirect does not use canonical auth base',
    results
  );

  assertRule(
    /resolveAuthBaseUrl/.test(loginGoogleJs),
    'Reset password: canonical auth base is used',
    'Reset password: canonical auth base is not used',
    results
  );

  assertRule(
    /VALUES\s*\(\s*'ticket_attachments'\s*,\s*'ticket_attachments'\s*,\s*false\s*\)/i.test(supportSchema),
    'Support storage: ticket_attachments bucket is private',
    'Support storage: ticket_attachments bucket is not private',
    results
  );

  assertRule(
    !/CREATE\s+POLICY\s+"Ticket attachments are publicly accessible"/i.test(supportSchema),
    'Support storage: public read policy removed',
    'Support storage: public read policy still present',
    results
  );

  assertRule(
    /Users can read own ticket attachments/.test(supportSchema) && /Users can upload own ticket attachments/.test(supportSchema),
    'Support storage: owner-scoped read/write policies exist',
    'Support storage: owner-scoped policies are incomplete',
    results
  );

  assertRule(
    /attachmentPath/.test(supportHtml) && !/getPublicUrl\(/.test(supportHtml),
    'Support UI: uploads store private path only',
    'Support UI: still deriving public URL for attachments',
    results
  );

  assertRule(
    /attachmentPath/.test(createTicketApi) && /ticket_attachments/.test(createTicketApi) && /expectedPrefix/.test(createTicketApi),
    'Support API: attachment path validation and persistence enabled',
    'Support API: attachment validation/persistence is missing',
    results
  );

  const failed = results.filter((r) => !r.ok);
  const passed = results.filter((r) => r.ok);

  console.log('Pre-launch smoke check results');
  console.log('--------------------------------');
  for (const result of results) {
    console.log(`${result.ok ? 'PASS' : 'FAIL'}: ${result.message}`);
  }
  console.log('--------------------------------');
  console.log(`Passed: ${passed.length}`);
  console.log(`Failed: ${failed.length}`);

  if (failed.length > 0) {
    process.exitCode = 1;
    return;
  }

  console.log('All required launch gates passed.');
}

run();
