import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { handleApi } from '../src/api.js';
export function setup() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../migrations/0001_notes.sql', import.meta.url), 'utf8'));
  const DB = {
    prepare(sql) {
      let args = [];
      const s = {
        bind(...values) {
          args = values;
          return s;
        },
        async first() {
          return db.prepare(sql).get(...args) || null;
        },
        async all() {
          return { results: db.prepare(sql).all(...args) };
        },
        async run() {
          return db.prepare(sql).run(...args);
        },
      };
      return s;
    },
    async batch(statements) {
      db.exec('BEGIN');
      try {
        const result = [];
        for (const s of statements) result.push(await s.all());
        db.exec('COMMIT');
        return result;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
  };
  const env = { DB };
  async function call(email, path = 'state', method = 'GET', record, key) {
    try {
      const headers = { Origin: 'https://notes.example.com', 'Content-Type': 'application/json' };
      if (key) headers['Idempotency-Key'] = key;
      return await handleApi(
        new Request('https://notes.example.com/api/' + path, {
          method,
          headers,
          body: record === undefined ? undefined : JSON.stringify(record),
        }),
        env,
        { email },
      );
    } catch (e) {
      return Response.json({ error: e.message }, { status: e.status || 500 });
    }
  }
  return { db, env, call };
}
