import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, SignJWT } from 'jose';
import { setup } from './db.js';
import { settings, verifyToken } from '../src/auth.js';
import worker, { handle } from '../src/worker.js';
import { handleMcp } from '../src/mcp.js';
const issuer = 'https://example.cloudflareaccess.com',
  audience = 'a'.repeat(64),
  config = { issuer, audience, allowed: ['person@example.com'] };
test('signed identity verifies signature, issuer, audience, expiry and approved normalized email', async () => {
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  async function token(payload = { email: 'PERSON@example.com' }, claims = {}) {
    return new SignJWT(payload)
      .setProtectedHeader({ alg: 'RS256' })
      .setSubject('subject')
      .setIssuer(claims.issuer || issuer)
      .setAudience(claims.audience || audience)
      .setIssuedAt()
      .setExpirationTime(claims.expiry || '5m')
      .sign(privateKey);
  }
  assert.equal((await verifyToken(await token(), config, publicKey)).email, 'person@example.com');
  for (const value of [
    await token({ email: 'other@example.com' }),
    await token({}, {}),
    await token(undefined, { audience: 'wrong' }),
    await token(undefined, { issuer: 'https://wrong.cloudflareaccess.com' }),
    await token(undefined, { expiry: 1 }),
  ])
    await assert.rejects(() => verifyToken(value, config, publicKey));
  const other = await generateKeyPair('RS256'),
    signed = await token();
  await assert.rejects(() => verifyToken(signed, config, other.publicKey));
});
test('placeholder config, plain email and fake cookies cannot open production routes', async () => {
  assert.throws(() => settings({}));
  assert.throws(() =>
    settings({
      ACCESS_ISSUER: issuer,
      ACCESS_AUDIENCE: 'REPLACE',
      ALLOWED_EMAILS: 'person@example.com',
    }),
  );
  const env = {
    ACCESS_ISSUER: issuer,
    ACCESS_AUDIENCE: audience,
    ALLOWED_EMAILS: 'person@example.com',
  };
  for (const path of ['/', '/app.js', '/api/state', '/mcp']) {
    assert.equal(
      (
        await worker.fetch(
          new Request('https://notes.example.com' + path, {
            headers: {
              'Cf-Access-Authenticated-User-Email': 'person@example.com',
              Cookie: 'fake=session',
            },
          }),
          env,
        )
      ).status,
      401,
    );
    assert.equal((await worker.fetch(new Request('http://localhost' + path), {})).status, 503);
  }
  assert.equal((await handle(new Request('https://not-local.example.com/'), {}, true)).status, 503);
});
test('notes are scoped for reads, ID writes and deletes, and ownership cannot be supplied', async () => {
  const { call, db } = setup();
  assert.equal((await call('a@example.com', 'missing')).status, 404);
  const a = await (
    await call(
      'a@example.com',
      'notes',
      'POST',
      { title: 'Private', body: 'Own note' },
      crypto.randomUUID(),
    )
  ).json();
  assert.equal((await (await call('b@example.com')).json()).notes.length, 0);
  assert.equal(
    (await call('b@example.com', 'notes/' + a.id, 'PUT', { title: 'Stolen' })).status,
    404,
  );
  assert.equal((await call('b@example.com', 'notes/' + a.id, 'DELETE')).status, 404);
  assert.equal((await call('b@example.com', 'state?owner=a@example.com')).status, 403);
  assert.equal(
    (
      await call(
        'a@example.com',
        'notes',
        'POST',
        { title: 'Bad', owner_email: 'b@example.com' },
        crypto.randomUUID(),
      )
    ).status,
    400,
  );
  assert.throws(() =>
    db.prepare('UPDATE notes SET owner_email=? WHERE id=?').run('b@example.com', a.id),
  );
});
test('identical create retries are atomic and changed payloads conflict', async () => {
  const { call, db } = setup(),
    key = crypto.randomUUID();
  const first = await (await call('a@example.com', 'notes', 'POST', { title: 'One' }, key)).json(),
    second = await (await call('a@example.com', 'notes', 'POST', { title: 'One' }, key)).json();
  assert.equal(first.id, second.id);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM notes').get().n, 1);
  assert.equal(
    (await call('a@example.com', 'notes', 'POST', { title: 'Changed' }, key)).status,
    409,
  );
  assert.equal(
    (await call('a@example.com', 'notes', 'POST', { title: 'Missing key' })).status,
    400,
  );
  assert.equal(
    (await call('b@example.com', 'notes', 'POST', { title: 'Different owner' }, key)).status,
    201,
  );
});
test('browser mutations reject cross-origin and invalid inputs', async () => {
  const { env, call } = setup();
  const { handleApi } = await import('../src/api.js');
  await assert.rejects(
    () =>
      handleApi(
        new Request('https://notes.example.com/api/notes', {
          method: 'POST',
          headers: { Origin: 'https://attacker.example' },
        }),
        env,
        { email: 'a@example.com' },
      ),
    (e) => e.status === 403,
  );
  for (const title of ['', 'x'.repeat(181)])
    assert.equal(
      (await call('a@example.com', 'notes', 'POST', { title }, crypto.randomUUID())).status,
      400,
    );
});
async function rpc(env, email, method, params = {}) {
  const r = await handleMcp(
    new Request('https://notes.example.com/mcp', {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    }),
    env,
    { email },
  );
  return r.json();
}
test('MCP initializes and exposes read/create/update without delete; tools share owner and retry rules', async () => {
  const { env, db } = setup();
  const init = await rpc(env, 'a@example.com', 'initialize', {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'test', version: '1' },
  });
  assert.equal(init.result.serverInfo.name, 'private-notes-starter');
  const list = await rpc(env, 'a@example.com', 'tools/list');
  assert.deepEqual(list.result.tools.map((t) => t.name).sort(), [
    'create_note',
    'get_notes',
    'update_note',
  ]);
  const args = { requestId: crypto.randomUUID(), record: { title: 'Tool note', body: 'Saved' } };
  for (let n = 0; n < 2; n++)
    assert.equal(
      (await rpc(env, 'a@example.com', 'tools/call', { name: 'create_note', arguments: args }))
        .result.isError,
      false,
    );
  assert.equal(db.prepare('SELECT COUNT(*) n FROM notes').get().n, 1);
  const read = await rpc(env, 'b@example.com', 'tools/call', { name: 'get_notes', arguments: {} });
  assert.equal(JSON.parse(read.result.content[0].text).notes.length, 0);
});
