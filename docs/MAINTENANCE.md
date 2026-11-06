# Maintenance

Keep `.env`, `.dev.vars`, local D1 state, database exports and real notes out of Git. The example config uses placeholders only. Report security problems privately to the repository owner; do not attach personal records or bearer tokens to a public issue.

Before a schema change, export the correct D1 database into an ignored private directory. Test a restore into a separate database, review the migration, then apply it to the explicitly selected environment. `npm run db:local` never updates the production database. Pushing GitHub source does not automatically deploy this template.

Run `npm ci`, `npm test`, `npm run check`, and browser checks for changed UI. Dependency versions are locked; review upgrades and rerun auth/ownership/MCP tests. The tests use synthetic keys and temporary SQLite databases; no real identity provider or bank account is required.

The app intentionally has no cross-user administrator role. Add sharing through an explicit data model/authorization review rather than an owner field supplied by the client. Keep stored note content separate from tool instructions. Read/update tools replace full records, so a client must read first and preserve unchanged fields.

For production use add appropriate abuse limits, data-size/pagination controls, conflict handling, export/restore procedures, monitoring and a retention policy for idempotency results. Test account removal and email/identity changes explicitly. A successful deployment is not proof of successful OAuth or authorization.
