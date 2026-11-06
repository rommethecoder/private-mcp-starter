import { z } from 'zod';
export const noteSchema = z
  .object({
    title: z.string().trim().min(1).max(180),
    body: z.string().trim().max(8000).default(''),
  })
  .strict();
const uuid = z.uuid();
const fail = (message, status) => Object.assign(new Error(message), { status });
export async function handleApi(request, env, user) {
  const url = new URL(request.url),
    owner = user.email.toLowerCase();
  if ([...url.searchParams.keys()].length)
    throw fail(
      'This starter exposes only your own records; query overrides are not supported.',
      403,
    );
  if (request.method === 'GET' && url.pathname === '/api/state') {
    const result = await env.DB.prepare(
      'SELECT id,data FROM notes WHERE owner_email=? ORDER BY updated_at DESC',
    )
      .bind(owner)
      .all();
    return Response.json({
      user: { email: owner, local: !!user.local },
      notes: result.results.map((r) => ({ id: r.id, ...JSON.parse(r.data) })),
    });
  }
  const match = url.pathname.match(/^\/api\/notes(?:\/([0-9a-f-]{36}))?$/);
  if (!match || !['POST', 'PUT', 'DELETE'].includes(request.method))
    return Response.json({ error: 'Not found' }, { status: 404 });
  if (request.headers.get('Origin') !== url.origin) throw fail('Request origin rejected.', 403);
  const id = match[1];
  if (id && !uuid.safeParse(id).success) throw fail('Invalid record identifier.', 400);
  if ((request.method === 'POST' && id) || (request.method !== 'POST' && !id))
    throw fail('Invalid record URL.', 400);
  const existing = id
    ? await env.DB.prepare('SELECT id,data FROM notes WHERE id=? AND owner_email=?')
        .bind(id, owner)
        .first()
    : null;
  if (id && !existing) throw fail('Record not found.', 404);
  if (request.method === 'DELETE') {
    await env.DB.prepare('DELETE FROM notes WHERE id=? AND owner_email=?').bind(id, owner).run();
    return Response.json({ ok: true });
  }
  if (!request.headers.get('Content-Type')?.startsWith('application/json'))
    throw fail('JSON required.', 415);
  const raw = await request.text();
  if (raw.length > 64000) throw fail('Record too large.', 413);
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    throw fail('Invalid JSON.', 400);
  }
  const parsed = noteSchema.safeParse(input);
  if (!parsed.success)
    throw fail('Provide a title and optional body; ownership is assigned from login.', 400);
  const data = parsed.data,
    encoded = JSON.stringify(data),
    now = new Date().toISOString();
  if (id) {
    await env.DB.prepare('UPDATE notes SET data=?,updated_at=? WHERE id=? AND owner_email=?')
      .bind(encoded, now, id, owner)
      .run();
    return Response.json({ id, ...data });
  }
  const key = request.headers.get('Idempotency-Key');
  if (!uuid.safeParse(key).success)
    throw fail(
      'Use a UUID Idempotency-Key for each creation; reuse it for identical retries.',
      400,
    );
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(encoded));
  const fingerprint = Array.from(new Uint8Array(digest), (x) =>
    x.toString(16).padStart(2, '0'),
  ).join('');
  async function replay() {
    const prior = await env.DB.prepare(
      'SELECT fingerprint,result FROM tool_requests WHERE owner_email=? AND request_key=?',
    )
      .bind(owner, key)
      .first();
    if (!prior) return null;
    if (prior.fingerprint !== fingerprint)
      throw fail('Request ID already used for different data.', 409);
    return Response.json(JSON.parse(prior.result));
  }
  const prior = await replay();
  if (prior) return prior;
  const record = { id: crypto.randomUUID(), ...data };
  try {
    await env.DB.batch([
      env.DB.prepare('INSERT INTO notes(id,owner_email,data,updated_at) VALUES(?,?,?,?)').bind(
        record.id,
        owner,
        encoded,
        now,
      ),
      env.DB.prepare(
        'INSERT INTO tool_requests(owner_email,request_key,fingerprint,result,created_at) VALUES(?,?,?,?,?)',
      ).bind(owner, key, fingerprint, JSON.stringify(record), now),
    ]);
  } catch (e) {
    const saved = await replay();
    if (saved) return saved;
    throw e;
  }
  return Response.json(record, { status: 201 });
}
