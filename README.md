# Private MCP Starter

An owner-scoped notes application showing how a browser dashboard and an MCP server can share authentication, schema validation, D1 storage and duplicate-safe creation. Extracted and generalized from personal Garage and Trip Ledger applications; no personal records, account IDs, API credentials or bank integrations are included.

**Architecture:** browser or MCP client → Cloudflare Access / Managed OAuth → verified signed Access assertion → owner-scoped API → D1. The example is a notes app so the authentication and ownership boundaries are easy to inspect.

## Features

- Stateless Streamable HTTP MCP using the official TypeScript SDK.
- Cloudflare Access JWT signature, issuer, audience, expiry, required identity and email-allowlist verification.
- Read/create/update tools; no MCP deletion tool or cross-user administrator bypass.
- UUID idempotency keys with atomic record/result writes for identical create retries.
- Authenticated static assets, same-origin browser mutations and validated JSON.
- Separate loopback-only local entry point; production never enables that bypass.
- A minimal responsive dashboard with safely rendered note text.

## Try locally

Node.js 24+ is required for the test harness (Node's SQLite module). Node 26 was used for local verification.

```sh
npm ci
npm run db:local
npm run dev
```

Open http://127.0.0.1:8110. This uses an isolated local D1 database and the synthetic identity local@example.test. It is not the production OAuth flow. Keep development bound to loopback.

```sh
npm test
npm run check
```

Tests cover signed JWT validation and rejection, owner isolation, schema rejection, fake identity headers, duplicate-safe creation and actual MCP initialization/tool calls. The dry run validates bundling without creating cloud resources.

## Deploy your own instance

Follow [Deployment and OAuth setup](docs/DEPLOYMENT.md). Deployment is intentionally unconfigured: replace the D1 UUID and Access issuer/audience/allowlist, attach your own hostname and protect it with your Access application. Never copy someone else's issuer audience or allowlist.

Cloudflare Managed OAuth handles discovery/token exchange at the edge. The Worker trusts only a verified Cf-Access-Jwt-Assertion. This repository does not implement an OAuth authorization server or accept a bare client-supplied email header.

## Tools and ownership

- `get_notes`: current authenticated user's identity and notes.
- `create_note`: `{requestId: UUID, record: {title, body}}`.
- `update_note`: `{recordId: UUID, record: {title, body}}`.

Read before replacing a note. Owner overrides in query/body fields are rejected. Email comes from the verified Access identity, not a prompt. Email changes create a different workspace in this example. Reusing a create request ID with changed data returns a conflict. Idempotency results remain stored after deletion so old request retries cannot resurrect a deleted note.

## Scope and limitations

This is a reviewed example, not a managed service or a security certification. The extracted starter has not been deployed with a fresh user's Access account; the underlying pattern runs in the author's private apps. You must verify your own login/OAuth and two-user isolation after configuring it. There is no pagination, sharing, edit history, optimistic concurrency, rate limiting, backup/restore UI or idempotency-record retention policy. Full-record updates may overwrite concurrent edits. D1 exports contain private notes. Scale and harden the example deliberately before broader use.

See [Maintenance](docs/MAINTENANCE.md) for migrations, backups, dependency updates and contribution checks. Do not store passwords or tokens in notes.

## Provenance

Original example by Terry (Romme) Felton, extracted with AI assistance from owner-scoped personal applications. MIT licensed. Cloudflare, OpenAI and the MCP SDK are independent projects; this is not an official template or an endorsement.

## How this started

[Read the project history](docs/PROJECT_HISTORY.md) for the original problem, the choices behind the first release and the checks that still need hands-on verification.
